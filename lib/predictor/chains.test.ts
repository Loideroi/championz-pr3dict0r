import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import {
  chainFor,
  CHAIN_MAINNET,
  CHAIN_SPICY,
  deployBlockFor,
  LOG_SCAN_CHUNK,
  LOG_SCAN_MIN_CHUNK,
  rpcCandidatesFor,
  scanLogs,
} from "./chains";

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("chain resolution", () => {
  it("gives mainnet a multicall3 and Spicy none — every bulk reader branches on this", () => {
    expect(chainFor(CHAIN_MAINNET).contracts?.multicall3?.address).toBeTruthy();
    expect(chainFor(CHAIN_SPICY).contracts?.multicall3).toBeUndefined();
  });

  it("refuses an unknown chain loudly rather than defaulting to one", () => {
    expect(() => chainFor(1)).toThrow("unsupported chainId 1");
  });

  it("pins the mainnet deploy block so the entrant scan stays O(season)", () => {
    expect(deployBlockFor(CHAIN_MAINNET)).toBe(35_505_430n);
    expect(deployBlockFor(999)).toBe(0n); // unknown chain: scan from genesis
  });
});

describe("rpcCandidatesFor", () => {
  it("tries the configured endpoint first, then the chain's own", () => {
    process.env.CHILIZ_RPC_URL = "https://private.example/chiliz";
    delete process.env.NEXT_PUBLIC_RPC_URL;
    const candidates = rpcCandidatesFor(CHAIN_MAINNET);
    expect(candidates[0]).toBe("https://private.example/chiliz");
    expect(candidates).toContain(chainFor(CHAIN_MAINNET).rpcUrls.default.http[0]);
  });

  it("always keeps a fallback — production's Ankr endpoint caps eth_getLogs at 1,000 blocks", () => {
    process.env.CHILIZ_RPC_URL = "https://rpc.ankr.com/chiliz";
    process.env.NEXT_PUBLIC_RPC_URL = "https://rpc.ankr.com/chiliz";
    const candidates = rpcCandidatesFor(CHAIN_MAINNET);
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates).toEqual([...new Set(candidates)]); // the duplicate collapses
  });

  it("falls back to the chain default when nothing is configured", () => {
    delete process.env.CHILIZ_RPC_URL;
    delete process.env.NEXT_PUBLIC_RPC_URL;
    expect(rpcCandidatesFor(CHAIN_SPICY)).toEqual(chainFor(CHAIN_SPICY).rpcUrls.default.http);
  });

  it("ignores an empty env var instead of trying to fetch from \"\"", () => {
    process.env.CHILIZ_RPC_URL = "";
    delete process.env.NEXT_PUBLIC_RPC_URL;
    expect(rpcCandidatesFor(CHAIN_MAINNET)).not.toContain("");
  });
});

describe("scanLogs", () => {
  const clientAt = (latest: bigint) =>
    ({ getBlockNumber: vi.fn(async () => latest) }) as unknown as PublicClient;

  it("covers deploy→head in contiguous, non-overlapping windows under the chunk size", async () => {
    const seen: [bigint, bigint][] = [];
    const from = 35_505_430n;
    const latest = from + LOG_SCAN_CHUNK * 3n + 17n; // three full windows and a stub
    const logs = await scanLogs(clientAt(latest), from, async (a, b) => {
      seen.push([a, b]);
      return [`${a}-${b}`];
    });
    expect(seen[0][0]).toBe(from);
    expect(seen.at(-1)?.[1]).toBe(latest);
    for (let i = 1; i < seen.length; i++) expect(seen[i][0]).toBe(seen[i - 1][1] + 1n);
    for (const [a, b] of seen) expect(b - a + 1n).toBeLessThanOrEqual(LOG_SCAN_CHUNK);
    expect(seen).toHaveLength(4);
    // Order is the log order the caller relies on (last StageFrozen wins).
    expect(logs).toEqual(seen.map(([a, b]) => `${a}-${b}`));
  });

  it("halves the chunk when the endpoint refuses a window, until it fits", async () => {
    const cap = 50_000n; // publicnode's measured cap
    const sizes = new Set<bigint>();
    const logs = await scanLogs(clientAt(1_000_000n), 0n, async (a, b) => {
      const size = b - a + 1n;
      sizes.add(size);
      if (size > cap) throw new Error("exceed maximum block range: 50000");
      return [a];
    });
    expect(sizes.has(LOG_SCAN_CHUNK)).toBe(true);
    expect([...sizes].filter((s) => s <= cap).length).toBeGreaterThan(0);
    expect(logs).toHaveLength(Number(1_000_001n / cap) + 1);
    expect(logs[0]).toBe(0n);
  });

  it("gives up below the minimum chunk so the caller can move to the next RPC", async () => {
    // Ankr: 1,000-block cap — never reachable by halving from 200k above the floor.
    const fetch = vi.fn(async () => {
      throw new Error("Block range is too large");
    });
    await expect(scanLogs(clientAt(500_000n), 0n, fetch)).rejects.toThrow("Block range is too large");
    // 200k → 100k → 50k → 25k, then stop: four rounds of at most four in-flight windows.
    expect(LOG_SCAN_CHUNK / LOG_SCAN_MIN_CHUNK).toBe(8n);
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(16);
  });

  it("returns nothing when the deploy block is past the head", async () => {
    const fetch = vi.fn(async () => [1]);
    expect(await scanLogs(clientAt(10n), 11n, fetch)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
