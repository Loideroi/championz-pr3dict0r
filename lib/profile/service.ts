/**
 * Profile read/write orchestration for /api/profile (PRD §13).
 *
 * All I/O comes in through {@link SaveProfileDeps} — Supabase client,
 * signature verifier, chain reader and clock are injected, so the whole
 * flow is unit-testable without a network. The route file only wires
 * real dependencies.
 */
import {
  checkRateLimit,
  EMPTY_RATE_LIMIT_STATE,
  type RateLimitState,
} from "./rate-limit";
import {
  isHexAddress,
  isMessageFresh,
  isSupportedChainId,
  parseProfileMessage,
  validateCountry,
  validateUsername,
} from "./validate";
import type { Hex, VerifyResult } from "./verify";

export const PROFILES_TABLE = "clp_user_profiles";

export type EntryTier = "full_season" | "knockout" | null;

export type ProfileRow = {
  wallet_address: string;
  chain_id: number;
  username: string;
  country_code: string;
  telegram_user_id: string | null;
  telegram_handle: string | null;
  entry_tier: EntryTier;
  last_write_at: string | null;
  window_started_at: string | null;
  window_writes: number;
  created_at: string;
  updated_at: string;
};

/** The narrow slice of the Supabase query API this module uses. */
export type ProfileDb = {
  from(table: string): {
    select(columns: string): {
      eq(
        col: string,
        value: string | number,
      ): {
        eq(
          col: string,
          value: string | number,
        ): {
          maybeSingle(): Promise<{
            data: ProfileRow | null;
            error: { message: string } | null;
          }>;
        };
        ilike(
          col: string,
          pattern: string,
        ): {
          neq(
            col: string,
            value: string,
          ): {
            limit(n: number): Promise<{
              data: Pick<ProfileRow, "wallet_address">[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
    upsert(
      row: Partial<ProfileRow>,
      options: { onConflict: string },
    ): {
      select(): {
        single(): Promise<{
          data: ProfileRow | null;
          error: { message: string; code?: string } | null;
        }>;
      };
    };
  };
};

export type SaveProfileDeps = {
  db: ProfileDb;
  verifySignature: (params: {
    address: Hex;
    message: string;
    signature: Hex;
  }) => Promise<VerifyResult>;
  /** Read entered(stage, wallet) from chain; null when unavailable. */
  readEntryTier: (address: Hex) => Promise<EntryTier>;
  now: () => number;
};

export type SaveProfileInput = {
  address?: unknown;
  chainId?: unknown;
  username?: unknown;
  country?: unknown;
  message?: unknown;
  signature?: unknown;
};

export type ServiceResult = {
  status: number;
  body: Record<string, unknown>;
};

/** Strip rate-limit bookkeeping before returning a row to clients. */
export function publicProfile(row: ProfileRow) {
  return {
    walletAddress: row.wallet_address,
    chainId: row.chain_id,
    username: row.username,
    countryCode: row.country_code,
    telegramHandle: row.telegram_handle,
    entryTier: row.entry_tier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProfile(
  db: ProfileDb,
  address: string,
  chainId: number,
): Promise<ServiceResult> {
  const { data, error } = await db
    .from(PROFILES_TABLE)
    .select("*")
    .eq("wallet_address", address.toLowerCase())
    .eq("chain_id", chainId)
    .maybeSingle();
  if (error) return { status: 500, body: { error: "Profile lookup failed." } };
  if (!data) return { status: 404, body: { profile: null } };
  return { status: 200, body: { profile: publicProfile(data) } };
}

export async function saveProfile(
  input: SaveProfileInput,
  deps: SaveProfileDeps,
): Promise<ServiceResult> {
  const { address, chainId, username, country, message, signature } = input;

  // 1. Shape validation ---------------------------------------------------
  if (!isHexAddress(address)) {
    return { status: 400, body: { error: "Invalid wallet address." } };
  }
  if (!isSupportedChainId(chainId)) {
    return { status: 400, body: { error: "Unsupported chain id." } };
  }
  const usernameError = validateUsername(username);
  if (usernameError) return { status: 400, body: { error: usernameError } };
  const countryError = validateCountry(country);
  if (countryError) return { status: 400, body: { error: countryError } };
  if (typeof signature !== "string" || !signature.startsWith("0x")) {
    return { status: 400, body: { error: "Missing signature." } };
  }

  // 2. Signed message must match the submitted fields and be fresh --------
  const parsed = parseProfileMessage(message);
  if (!parsed || parsed.username !== username || parsed.country !== country) {
    return {
      status: 400,
      body: { error: "Signed message does not match the submitted profile." },
    };
  }
  if (!isMessageFresh(parsed.timestampIso, deps.now())) {
    return {
      status: 400,
      body: { error: "Signed message expired — please sign again." },
    };
  }

  // 3. Dual-path signature verification (ERC-1271 / EOA) ------------------
  const verdict = await deps.verifySignature({
    address,
    message: message as string,
    signature: signature as Hex,
  });
  if (!verdict.valid) {
    return {
      status: 401,
      body: { error: "Signature verification failed.", path: verdict.path },
    };
  }

  const wallet = address.toLowerCase();

  // 4. DB-backed rate limit (state lives on the profile row) --------------
  const existing = await deps.db
    .from(PROFILES_TABLE)
    .select("*")
    .eq("wallet_address", wallet)
    .eq("chain_id", chainId)
    .maybeSingle();
  if (existing.error) {
    return { status: 500, body: { error: "Profile lookup failed." } };
  }
  const state: RateLimitState = existing.data
    ? {
        lastWriteAt: existing.data.last_write_at,
        windowStartedAt: existing.data.window_started_at,
        windowWrites: existing.data.window_writes ?? 0,
      }
    : EMPTY_RATE_LIMIT_STATE;
  const decision = checkRateLimit(state, deps.now());
  if (!decision.allowed) {
    return {
      status: 429,
      body: { error: decision.reason, retryAfterSeconds: decision.retryAfterSeconds },
    };
  }

  // 5. Stake gate: usernames are for entrants only (chain is truth) --------
  // A wallet must have entered a stage (staked CHZ) before it can claim a
  // name on the leaderboard. If the chain read fails we fall back to the
  // stored tier so an RPC blip never locks out an existing entrant — but a
  // wallet with no proven entry is refused rather than silently allowed.
  let entryTier: EntryTier = null;
  let chainReadFailed = false;
  try {
    entryTier = await deps.readEntryTier(address);
  } catch {
    chainReadFailed = true;
    entryTier = existing.data?.entry_tier ?? null;
  }
  if (entryTier === null) {
    if (chainReadFailed) {
      return {
        status: 503,
        body: { error: "Could not verify your entry on-chain — please try again." },
      };
    }
    return {
      status: 403,
      body: { error: "Enter the pool first — stake CHZ, then claim your name." },
    };
  }

  // 6. Username unique per chain (case-insensitive precheck + constraint) -
  const dup = await deps.db
    .from(PROFILES_TABLE)
    .select("wallet_address")
    .eq("chain_id", chainId)
    .ilike("username", username as string)
    .neq("wallet_address", wallet)
    .limit(1);
  if (dup.error) {
    return { status: 500, body: { error: "Username check failed." } };
  }
  if (dup.data && dup.data.length > 0) {
    return {
      status: 409,
      body: { error: `Username "${username}" is already taken on this chain.` },
    };
  }

  // 7. Upsert ---------------------------------------------------------------
  const nowIso = new Date(deps.now()).toISOString();
  const { data, error } = await deps.db
    .from(PROFILES_TABLE)
    .upsert(
      {
        wallet_address: wallet,
        chain_id: chainId,
        username: username as string,
        country_code: country as string,
        entry_tier: entryTier,
        last_write_at: decision.nextState.lastWriteAt,
        window_started_at: decision.nextState.windowStartedAt,
        window_writes: decision.nextState.windowWrites,
        updated_at: nowIso,
      },
      { onConflict: "wallet_address,chain_id" },
    )
    .select()
    .single();

  if (error) {
    // Unique (username, chain_id) violation raced past the precheck.
    if (error.code === "23505") {
      return {
        status: 409,
        body: { error: `Username "${username}" is already taken on this chain.` },
      };
    }
    return { status: 500, body: { error: "Profile save failed." } };
  }

  return {
    status: 200,
    body: { profile: data ? publicProfile(data) : null, path: verdict.path },
  };
}
