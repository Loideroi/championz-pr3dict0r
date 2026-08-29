/**
 * /api/standings — the leaderboard, derived from chain state, computed once.
 *
 * The page used to do this in the browser: getLogs from block 0, then six
 * eth_calls and one /api/profile round trip per entrant, then one resultOf per
 * match for the provisional badge — all serial. Measured on mainnet at 51
 * entrants and 144 matches: ~16s of RPC plus ~30s of profile fetches, per
 * visitor, every visit. Here it is one multicall3 sweep (~0.9s) plus one
 * Supabase query, cached at the edge for 30s, shared by everyone.
 *
 * Chain remains truth — this reads it, it does not shadow it. Points only move
 * when the oracle pushes a result, so a 30s TTL is invisible in practice and
 * stale-while-revalidate keeps the board instant across a matchday evening.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, http, parseAbiItem, type PublicClient } from "viem";
import {
  PREDICTOR_ABI,
  PREDICTOR_ADDRESS,
  STAGE_KNOCKOUT,
  STAGE_LEAGUE,
} from "@/lib/predictor/abi";
import {
  chainFor,
  deployBlockFor,
  isSupportedChain,
  readBatch,
  rpcCandidatesFor,
} from "@/lib/predictor/chains";
import { toRowJson, type StandingsPayload } from "@/lib/predictor/standingsPayload";
import type { StandingRow } from "@/lib/predictor/standings";
import { PROFILES_TABLE } from "@/lib/profile/service";
import { getServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTERED_EVENT = parseAbiItem(
  "event Entered(address indexed wallet, uint8 indexed stage, bool fullSeasonPass)",
);

/** Edge TTL. Results land minutes after a whistle; 30s is well inside the noise. */
const CACHE_SECONDS = 30;
const STALE_SECONDS = 300;

/** Warm-lambda memo, so a CDN miss storm still costs one chain sweep. */
const memo = new Map<number, { at: number; payload: StandingsPayload }>();

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;

type ProfileLite = { username?: string; countryCode?: string };

/** One query for every entrant's profile, instead of one HTTP call each. */
async function loadProfiles(
  addresses: string[],
  chainId: number,
): Promise<Map<string, ProfileLite>> {
  const out = new Map<string, ProfileLite>();
  const db = getServiceRoleClient();
  if (!db || addresses.length === 0) return out;
  const { data, error } = await db
    .from(PROFILES_TABLE)
    .select("wallet_address, username, country_code")
    .eq("chain_id", chainId)
    .in("wallet_address", addresses);
  if (error || !data) return out; // profiles are decoration; the board still renders
  for (const row of data as { wallet_address: string; username: string; country_code: string }[]) {
    out.set(row.wallet_address.toLowerCase(), {
      username: row.username,
      countryCode: row.country_code,
    });
  }
  return out;
}

/** Entrants, from the only enumeration the contract offers: the Entered log. */
async function loadEntrants(client: PublicClient, chainId: number): Promise<Map<string, boolean>> {
  const logs = await client.getLogs({
    address: PREDICTOR_ADDRESS,
    event: ENTERED_EVENT,
    fromBlock: deployBlockFor(chainId),
    toBlock: "latest",
  });
  const wallets = new Map<string, boolean>(); // address → holds a Full Season pass
  for (const log of logs) {
    const wallet = String(log.args.wallet).toLowerCase();
    wallets.set(wallet, (wallets.get(wallet) ?? false) || Boolean(log.args.fullSeasonPass));
  }
  return wallets;
}

/**
 * The season-wide log scan is the one query a Chiliz RPC can refuse: Ankr's
 * free tier — what production is configured with — caps `eth_getLogs` at 1,000
 * blocks. So try the endpoints in order and keep the client that could answer,
 * rather than assuming the configured one can. Contract reads then run on the
 * same client, which is also the one the timings were measured on.
 */
async function scanEntrants(
  chainId: number,
): Promise<{ client: PublicClient; wallets: Map<string, boolean> }> {
  const candidates = rpcCandidatesFor(chainId);
  let lastError: unknown;
  for (const url of candidates) {
    const client = createPublicClient({
      chain: chainFor(chainId),
      transport: http(url),
    }) as PublicClient;
    try {
      return { client, wallets: await loadEntrants(client, chainId) };
    } catch (err) {
      lastError = err;
    }
  }
  const detail = lastError instanceof Error ? lastError.message.split("\n")[0] : String(lastError);
  throw new Error(`no RPC could scan entrants (tried ${candidates.length}): ${detail}`);
}

const big = (v: unknown): bigint => (typeof v === "bigint" ? v : BigInt(Number(v ?? 0)));

async function buildPayload(chainId: number): Promise<StandingsPayload> {
  const { client, wallets } = await scanEntrants(chainId);
  const matchCount = Number(
    (await client.readContract({ ...contract, functionName: "matchCount" })) ?? 0,
  );
  const addresses = [...wallets.keys()];

  // One flat call list: six per entrant, one per match. Order is reconstructed
  // positionally below, so this array and the readers must stay in lockstep.
  const calls = [];
  for (const address of addresses) {
    calls.push(
      { ...contract, functionName: "pointsOf", args: [address, STAGE_LEAGUE] },
      { ...contract, functionName: "pointsOf", args: [address, STAGE_KNOCKOUT] },
      { ...contract, functionName: "exactCountOf", args: [address, STAGE_LEAGUE] },
      { ...contract, functionName: "exactCountOf", args: [address, STAGE_KNOCKOUT] },
      { ...contract, functionName: "enteredAt", args: [STAGE_LEAGUE, address] },
      { ...contract, functionName: "enteredAt", args: [STAGE_KNOCKOUT, address] },
    );
  }
  const walletCalls = calls.length;
  for (let id = 1; id <= matchCount; id++) {
    calls.push({ ...contract, functionName: "resultOf", args: [id] });
  }

  const [results, profiles] = await Promise.all([
    readBatch(client, calls as never),
    loadProfiles(addresses, chainId),
  ]);

  const rows: StandingRow[] = addresses.map((address, i) => {
    const base = i * 6;
    const fullSeason = wallets.get(address) ?? false;
    const profile = profiles.get(address) ?? {};
    const enteredLeague = Number(results[base + 4] ?? 0);
    const enteredKO = Number(results[base + 5] ?? 0);
    return {
      address: address as `0x${string}`,
      ...(profile.username ? { username: profile.username } : {}),
      ...(profile.countryCode ? { countryCode: profile.countryCode } : {}),
      fullSeason,
      // Stage 1 points are meaningless for a knockout-only wallet — null renders "—"
      leaguePoints: fullSeason ? big(results[base]) : null,
      knockoutPoints: big(results[base + 1]),
      exactCount: (fullSeason ? big(results[base + 2]) : 0n) + big(results[base + 3]),
      enteredAt: BigInt(enteredLeague || enteredKO || 0),
    };
  });

  // D9 provisional badge: any completed result still flagged provisional.
  const hasProvisional = results.slice(walletCalls).some((r) => {
    const tuple = r as readonly unknown[] | null;
    return Array.isArray(tuple) && Boolean(tuple[5]) && Boolean(tuple[6]);
  });

  return {
    chainId,
    matchCount,
    hasProvisional,
    updatedAt: new Date().toISOString(),
    rows: rows.map(toRowJson),
  };
}

export async function GET(request: NextRequest) {
  if (!PREDICTOR_ADDRESS) {
    return NextResponse.json({ error: "Contract address not configured." }, { status: 503 });
  }
  // A deployment serves exactly one chain: PREDICTOR_ADDRESS, the RPC URL and
  // the profile rows are all single-chain. The `chainId` query parameter is an
  // assertion by the caller, never a selector — honouring it would happily
  // read a mainnet block range off the Spicy RPC and return an empty board.
  const configured = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "88882");
  if (!isSupportedChain(configured)) {
    return NextResponse.json({ error: "Server chain is not configured." }, { status: 503 });
  }
  const asserted = request.nextUrl.searchParams.get("chainId");
  if (asserted !== null && Number(asserted) !== configured) {
    return NextResponse.json(
      { error: `This deployment serves chain ${configured}, not ${asserted}.` },
      { status: 400 },
    );
  }
  const requested = configured;

  const cached = memo.get(requested);
  if (cached && Date.now() - cached.at < CACHE_SECONDS * 1_000) {
    return NextResponse.json(cached.payload, { headers: cacheHeaders() });
  }

  try {
    const payload = await buildPayload(requested);
    memo.set(requested, { at: Date.now(), payload });
    return NextResponse.json(payload, { headers: cacheHeaders() });
  } catch (err) {
    // Serve the last good board rather than an empty one when the RPC blinks.
    if (cached) {
      return NextResponse.json(cached.payload, { headers: cacheHeaders(5) });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 200) : "Chain read failed." },
      { status: 502 },
    );
  }
}

function cacheHeaders(seconds = CACHE_SECONDS): Record<string, string> {
  return {
    "cache-control": `public, s-maxage=${seconds}, stale-while-revalidate=${STALE_SECONDS}`,
  };
}
