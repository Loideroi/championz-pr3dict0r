/**
 * saveProfile / getProfile against a mocked Supabase client injected as a
 * parameter — no network, no real database.
 */
import { describe, expect, it, vi } from "vitest";
import {
  saveProfile,
  getProfile,
  type ProfileDb,
  type ProfileRow,
  type SaveProfileDeps,
} from "./service";
import { buildProfileMessage } from "./validate";
import type { Hex } from "./verify";

const NOW = Date.parse("2026-07-04T12:00:00.000Z");
const ADDRESS = ("0x" + "ab".repeat(20)) as Hex;
const TS = new Date(NOW - 60_000).toISOString(); // signed one minute ago

function row(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    wallet_address: ADDRESS,
    chain_id: 88882,
    username: "rikkert",
    country_code: "NL",
    telegram_user_id: null,
    telegram_handle: null,
    entry_tier: null,
    last_write_at: null,
    window_started_at: null,
    window_writes: 0,
    created_at: new Date(NOW - 86_400_000).toISOString(),
    updated_at: new Date(NOW - 86_400_000).toISOString(),
    ...overrides,
  };
}

/** Chainable mock covering exactly the query shapes the service issues. */
function mockDb(opts: {
  existing?: ProfileRow | null;
  duplicates?: Pick<ProfileRow, "wallet_address">[];
  upsertError?: { message: string; code?: string } | null;
}) {
  const upsert = vi.fn((r: Partial<ProfileRow>, o: { onConflict: string }) => {
    void o; // recorded via mock.calls; asserted in the happy-path test
    return {
      select: () => ({
        single: async () =>
          opts.upsertError
            ? { data: null, error: opts.upsertError }
            : { data: row(r as ProfileRow), error: null },
      }),
    };
  });
  const db: ProfileDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: opts.existing ?? null, error: null }),
          }),
          ilike: () => ({
            neq: () => ({
              limit: async () => ({ data: opts.duplicates ?? [], error: null }),
            }),
          }),
        }),
      }),
      upsert,
    }),
  };
  return { db, upsert };
}

function makeDeps(
  db: ProfileDb,
  overrides: Partial<SaveProfileDeps> = {},
): SaveProfileDeps {
  return {
    db,
    verifySignature: vi.fn(async () => ({ valid: true, path: "eoa" as const })),
    readEntryTier: vi.fn(async () => "full_season" as const),
    now: () => NOW,
    ...overrides,
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    address: ADDRESS,
    chainId: 88882,
    username: "rikkert",
    country: "NL",
    message: buildProfileMessage("rikkert", "NL", TS),
    signature: "0x" + "ab".repeat(65),
    ...overrides,
  };
}

describe("saveProfile — happy path", () => {
  it("verifies, rate-limits, upserts and returns the public profile", async () => {
    const { db, upsert } = mockDb({ existing: null });
    const deps = makeDeps(db);
    const r = await saveProfile(validInput(), deps);
    expect(r.status).toBe(200);
    expect(r.body.path).toBe("eoa");
    expect(upsert).toHaveBeenCalledOnce();
    const [written, conflict] = upsert.mock.calls[0];
    expect(conflict).toEqual({ onConflict: "wallet_address,chain_id" });
    expect(written).toMatchObject({
      wallet_address: ADDRESS,
      chain_id: 88882,
      username: "rikkert",
      country_code: "NL",
      entry_tier: "full_season",
      window_writes: 1,
    });
    // Rate-limit bookkeeping never leaks to the client.
    expect(JSON.stringify(r.body)).not.toContain("window_writes");
  });

  it("keeps the previous tier when the chain read fails", async () => {
    const { db, upsert } = mockDb({ existing: row({ entry_tier: "knockout" }) });
    const deps = makeDeps(db, {
      readEntryTier: vi.fn(async () => {
        throw new Error("rpc down");
      }),
    });
    const r = await saveProfile(validInput(), deps);
    expect(r.status).toBe(200);
    expect(upsert.mock.calls[0][0]).toMatchObject({ entry_tier: "knockout" });
  });
});

describe("saveProfile — validation gate", () => {
  it("rejects bad addresses, chains, usernames and countries", async () => {
    const { db } = mockDb({});
    const deps = makeDeps(db);
    expect((await saveProfile(validInput({ address: "nope" }), deps)).status).toBe(400);
    expect((await saveProfile(validInput({ chainId: 1 }), deps)).status).toBe(400);
    expect(
      (await saveProfile(validInput({ username: "x" }), deps)).status,
    ).toBe(400);
    expect(
      (await saveProfile(validInput({ country: "XX" }), deps)).status,
    ).toBe(400);
  });

  it("rejects when the signed message disagrees with the submitted fields", async () => {
    const { db } = mockDb({});
    const deps = makeDeps(db);
    const r = await saveProfile(
      validInput({ message: buildProfileMessage("other_name", "NL", TS) }),
      deps,
    );
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/does not match/);
  });

  it("rejects stale signed messages (replay guard)", async () => {
    const { db } = mockDb({});
    const deps = makeDeps(db);
    const staleTs = new Date(NOW - 11 * 60_000).toISOString();
    const r = await saveProfile(
      validInput({ message: buildProfileMessage("rikkert", "NL", staleTs) }),
      deps,
    );
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/expired/);
  });

  it("returns 401 when signature verification fails", async () => {
    const { db, upsert } = mockDb({});
    const deps = makeDeps(db, {
      verifySignature: vi.fn(async () => ({ valid: false, path: "erc1271" as const })),
    });
    const r = await saveProfile(validInput(), deps);
    expect(r.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("saveProfile — rate limit and duplicates", () => {
  it("429s a rapid second write from the same wallet", async () => {
    const { db, upsert } = mockDb({
      existing: row({
        last_write_at: new Date(NOW - 5_000).toISOString(),
        window_started_at: new Date(NOW - 5_000).toISOString(),
        window_writes: 1,
      }),
    });
    const r = await saveProfile(validInput(), makeDeps(db));
    expect(r.status).toBe(429);
    expect(r.body.retryAfterSeconds).toBe(25);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("409s a username already taken on the same chain", async () => {
    const { db, upsert } = mockDb({
      existing: null,
      duplicates: [{ wallet_address: "0x" + "cd".repeat(20) }],
    });
    const r = await saveProfile(validInput(), makeDeps(db));
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/already taken on this chain/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("maps a raced unique-constraint violation (23505) to 409", async () => {
    const { db } = mockDb({
      existing: null,
      upsertError: { message: "duplicate key", code: "23505" },
    });
    const r = await saveProfile(validInput(), makeDeps(db));
    expect(r.status).toBe(409);
  });
});

describe("getProfile", () => {
  it("returns 404 with profile:null when unknown", async () => {
    const { db } = mockDb({ existing: null });
    const r = await getProfile(db, ADDRESS, 88882);
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ profile: null });
  });

  it("returns the public shape when found", async () => {
    const { db } = mockDb({ existing: row({ entry_tier: "full_season" }) });
    const r = await getProfile(db, ADDRESS, 88882);
    expect(r.status).toBe(200);
    expect(r.body.profile).toMatchObject({
      username: "rikkert",
      countryCode: "NL",
      entryTier: "full_season",
    });
  });
});
