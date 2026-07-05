import { randomBytes } from "node:crypto";

/**
 * Telegram account linking (slice 10, PRD §12). One-time codes, strictly
 * opt-in, one-tap unlink. Codes live in clp_tg_link_codes (service-role only —
 * public read would allow account takeover, see the slice-09 security fix).
 * Deps injected: tests run against an in-memory double, never the network.
 */
export const LINK_CODES_TABLE = "clp_tg_link_codes";
export const CODE_TTL_MINUTES = 15;

export type LinkDb = {
  insertCode(row: {
    code: string;
    wallet_address: string;
    chain_id: number;
    expires_at: string;
  }): Promise<{ error?: string }>;
  findCode(code: string): Promise<{
    wallet_address: string;
    chain_id: number;
    expires_at: string;
  } | null>;
  deleteCode(code: string): Promise<void>;
  setTelegram(
    wallet: string,
    chainId: number,
    tg: { telegram_user_id: string | null; telegram_handle: string | null },
  ): Promise<{ error?: string }>;
};

export function generateCode(): string {
  // URL/deep-link safe, 20 hex chars — Telegram start payload limit is 64
  return randomBytes(10).toString("hex");
}

export async function createLinkCode(
  db: LinkDb,
  wallet: string,
  chainId: number,
  nowMs: number,
): Promise<{ code: string; deepLink: string; expiresAt: string } | { error: string }> {
  const code = generateCode();
  const expiresAt = new Date(nowMs + CODE_TTL_MINUTES * 60_000).toISOString();
  const { error } = await db.insertCode({
    code,
    wallet_address: wallet.toLowerCase(),
    chain_id: chainId,
    expires_at: expiresAt,
  });
  if (error) return { error };
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "Chmpi0nz_Pr3dict0r_bot";
  return { code, deepLink: `https://t.me/${bot}?start=${code}`, expiresAt };
}

export type ConsumeResult =
  | { ok: true; wallet: string; chainId: number }
  | { ok: false; reason: "unknown_code" | "expired" | "db_error" };

/** Called by the bot (webhook or poller) on `/start <code>`. Single-use. */
export async function consumeLinkCode(
  db: LinkDb,
  code: string,
  telegram: { userId: string; handle: string | null },
  nowMs: number,
): Promise<ConsumeResult> {
  const row = await db.findCode(code);
  if (!row) return { ok: false, reason: "unknown_code" };
  await db.deleteCode(code); // single-use regardless of outcome below
  if (new Date(row.expires_at).getTime() < nowMs) return { ok: false, reason: "expired" };
  const { error } = await db.setTelegram(row.wallet_address, row.chain_id, {
    telegram_user_id: telegram.userId,
    telegram_handle: telegram.handle,
  });
  if (error) return { ok: false, reason: "db_error" };
  return { ok: true, wallet: row.wallet_address, chainId: row.chain_id };
}

export async function unlinkTelegram(
  db: LinkDb,
  wallet: string,
  chainId: number,
): Promise<{ ok: boolean }> {
  const { error } = await db.setTelegram(wallet.toLowerCase(), chainId, {
    telegram_user_id: null,
    telegram_handle: null,
  });
  return { ok: !error };
}
