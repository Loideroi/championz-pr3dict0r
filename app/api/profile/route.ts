/**
 * /api/profile — read + signature-verified write of clp_user_profiles
 * (PRD §13). GET ?address=0x…&chainId=88882 · POST { address, chainId,
 * username, country, message, signature }.
 *
 * Writes are verified with the dual EOA / ERC-1271 path (Socios.com Wallet
 * is a smart-contract account) and rate-limited per wallet in the database.
 * This file only wires real dependencies — the logic lives in
 * lib/profile/service.ts and is unit-tested with injected mocks.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import {
  PREDICTOR_ABI,
  PREDICTOR_ADDRESS,
  STAGE_KNOCKOUT,
  STAGE_LEAGUE,
} from "@/lib/predictor/abi";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  getProfile,
  saveProfile,
  type EntryTier,
  type ProfileDb,
} from "@/lib/profile/service";
import { isHexAddress, isSupportedChainId } from "@/lib/profile/validate";
import {
  ERC1271_ABI,
  recoverSignerViem,
  verifyWalletSignature,
  type Hex,
} from "@/lib/profile/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rpcClient() {
  const url =
    process.env.CHILIZ_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    "https://spicy-rpc.chiliz.com";
  return createPublicClient({ transport: http(url) });
}

/** entered(stage, wallet) on-chain → profile entry tier; null when unknown. */
async function readEntryTier(address: Hex): Promise<EntryTier> {
  if (!PREDICTOR_ADDRESS) return null;
  const client = rpcClient();
  const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;
  const fullSeason = (await client.readContract({
    ...contract,
    functionName: "entered",
    args: [STAGE_LEAGUE, address],
  })) as boolean;
  if (fullSeason) return "full_season";
  const knockout = (await client.readContract({
    ...contract,
    functionName: "entered",
    args: [STAGE_KNOCKOUT, address],
  })) as boolean;
  return knockout ? "knockout" : null;
}

async function verifySignature(params: {
  address: Hex;
  message: string;
  signature: Hex;
}) {
  const client = rpcClient();

  // Primary: viem's universal check — one call that covers EOA, deployed
  // ERC-1271 wallets AND ERC-6492-wrapped signatures (the Socios.com Wallet
  // SDK can return wrapped signatures a raw isValidSignature call rejects).
  try {
    const valid = await client.verifyMessage({
      address: params.address,
      message: params.message,
      signature: params.signature,
    });
    if (valid) return { valid: true, path: "erc1271" as const };
  } catch {
    /* fall through to the manual dual-path below */
  }

  return verifyWalletSignature(params, {
    getCode: async (address) => client.getCode({ address }),
    callIsValidSignature: async (address, hash, signature) =>
      (await client.readContract({
        address,
        abi: ERC1271_ABI,
        functionName: "isValidSignature",
        args: [hash, signature],
      })) as Hex,
    recoverSigner: recoverSignerViem,
  });
}

export async function GET(request: NextRequest) {
  const db = getServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: "Profiles not configured." }, { status: 503 });
  }
  const address = request.nextUrl.searchParams.get("address") ?? "";
  const chainId = Number(request.nextUrl.searchParams.get("chainId"));
  if (!isHexAddress(address) || !isSupportedChainId(chainId)) {
    return NextResponse.json(
      { error: "address and chainId (88882|88888) are required." },
      { status: 400 },
    );
  }
  const result = await getProfile(db as unknown as ProfileDb, address, chainId);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const db = getServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: "Profiles not configured." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const result = await saveProfile(body as Record<string, unknown>, {
    db: db as unknown as ProfileDb,
    verifySignature,
    readEntryTier,
    now: () => Date.now(),
  });
  const headers =
    result.status === 429 && typeof result.body.retryAfterSeconds === "number"
      ? { "Retry-After": String(result.body.retryAfterSeconds) }
      : undefined;
  return NextResponse.json(result.body, { status: result.status, headers });
}
