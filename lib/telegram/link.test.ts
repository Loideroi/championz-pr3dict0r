import { describe, expect, it } from "vitest";
import { consumeLinkCode, createLinkCode, generateCode, unlinkTelegram, type LinkDb } from "./link";

function memoryDb() {
  const codes = new Map<string, { wallet_address: string; chain_id: number; expires_at: string }>();
  const profiles = new Map<string, { telegram_user_id: string | null; telegram_handle: string | null }>();
  const db: LinkDb = {
    async insertCode(row) {
      codes.set(row.code, row);
      return {};
    },
    async findCode(code) {
      return codes.get(code) ?? null;
    },
    async deleteCode(code) {
      codes.delete(code);
    },
    async setTelegram(wallet, chainId, tg) {
      profiles.set(`${wallet}:${chainId}`, tg);
      return {};
    },
  };
  return { db, codes, profiles };
}

const NOW = 1_700_000_000_000;

describe("telegram link codes (slice 10)", () => {
  it("generates deep-link-safe single-use codes", async () => {
    const { db, codes } = memoryDb();
    const res = await createLinkCode(db, "0xABC", 88882, NOW);
    if ("error" in res) throw new Error(res.error);
    expect(res.code).toMatch(/^[0-9a-f]{20}$/);
    expect(res.deepLink).toContain(`?start=${res.code}`);
    expect(codes.has(res.code)).toBe(true);
    expect(generateCode()).not.toBe(generateCode());
  });

  it("consume links the wallet and burns the code", async () => {
    const { db, codes, profiles } = memoryDb();
    const res = await createLinkCode(db, "0xAbCd", 88882, NOW);
    if ("error" in res) throw new Error(res.error);
    const out = await consumeLinkCode(db, res.code, { userId: "42", handle: "mark" }, NOW + 60_000);
    expect(out).toEqual({ ok: true, wallet: "0xabcd", chainId: 88882 });
    expect(profiles.get("0xabcd:88882")).toEqual({ telegram_user_id: "42", telegram_handle: "mark" });
    expect(codes.size).toBe(0); // burned
    // replay rejected
    expect(await consumeLinkCode(db, res.code, { userId: "42", handle: null }, NOW)).toEqual({
      ok: false,
      reason: "unknown_code",
    });
  });

  it("expired codes are rejected AND burned", async () => {
    const { db, codes } = memoryDb();
    const res = await createLinkCode(db, "0xA", 88882, NOW);
    if ("error" in res) throw new Error(res.error);
    const out = await consumeLinkCode(db, res.code, { userId: "1", handle: null }, NOW + 16 * 60_000);
    expect(out).toEqual({ ok: false, reason: "expired" });
    expect(codes.size).toBe(0);
  });

  it("unlink clears both telegram fields", async () => {
    const { db, profiles } = memoryDb();
    await db.setTelegram("0xa", 88882, { telegram_user_id: "42", telegram_handle: "m" });
    expect((await unlinkTelegram(db, "0xA", 88882)).ok).toBe(true);
    expect(profiles.get("0xa:88882")).toEqual({ telegram_user_id: null, telegram_handle: null });
  });
});
