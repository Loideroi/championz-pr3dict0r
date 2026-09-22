import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HttpRequestError,
  InvalidInputRpcError,
  InvalidParamsRpcError,
  RpcRequestError,
  UnknownRpcError,
  type PublicClient,
} from "viem";
import {
  chainFor,
  CHAIN_MAINNET,
  CHAIN_SPICY,
  deployBlockFor,
  LOG_SCAN_CHUNK,
  LOG_SCAN_MIN_CHUNK,
  rpcCandidatesFor,
  rpcErrorDetail,
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

  it("halves the chunk when the node refuses a window, until it fits — still contiguous", async () => {
    const cap = 50_000n; // publicnode's measured cap
    const latest = 1_000_000n;
    const sizes = new Set<bigint>();
    const accepted: [bigint, bigint][] = [];
    const logs = await scanLogs(clientAt(latest), 0n, async (a, b) => {
      const size = b - a + 1n;
      sizes.add(size);
      if (size > cap) throw new UnknownRpcError(new Error("exceed maximum block range: 50000"));
      accepted.push([a, b]);
      return [a];
    });
    expect(sizes.has(LOG_SCAN_CHUNK)).toBe(true);
    expect(logs).toHaveLength(Number((latest + 1n) / cap) + 1); // exactly the 50k pass, not 25k
    expect(logs[0]).toBe(0n);
    accepted.sort((x, y) => (x[0] < y[0] ? -1 : 1));
    expect(accepted[0][0]).toBe(0n);
    expect(accepted.at(-1)?.[1]).toBe(latest);
    for (let i = 1; i < accepted.length; i++) expect(accepted[i][0]).toBe(accepted[i - 1][1] + 1n);
  });

  it("gives up below the minimum chunk so the caller can move to the next RPC", async () => {
    // Ankr: 1,000-block cap, answered with the provider-specific code -32062 —
    // viem leaves that as a raw RpcRequestError, which must still count as a refusal.
    const fetchRange = vi.fn(async () => {
      throw new RpcRequestError({
        body: {},
        error: { code: -32062, message: "Block range is too large" },
        url: "https://rpc.ankr.com/chiliz",
      });
    });
    await expect(scanLogs(clientAt(500_000n), 0n, fetchRange)).rejects.toThrow("Block range is too large");
    // 200k → 100k → 50k → 25k, then stop: four rounds of at most four in-flight windows.
    expect(LOG_SCAN_CHUNK / LOG_SCAN_MIN_CHUNK).toBe(8n);
    expect(fetchRange.mock.calls.length).toBeGreaterThan(4); // it did halve past round one
    expect(fetchRange.mock.calls.length).toBeLessThanOrEqual(16);
  });

  it("treats a standard-code refusal (-32602) the same way", async () => {
    const fetchRange = vi.fn(async () => {
      throw new InvalidParamsRpcError(new Error("Block range is too large"));
    });
    await expect(scanLogs(clientAt(500_000n), 0n, fetchRange)).rejects.toThrow("Block range is too large");
    expect(fetchRange.mock.calls.length).toBeGreaterThan(4);
  });

  it("does not halve on a transport failure — a smaller window cannot fix a 429", async () => {
    const fetchRange = vi.fn(async () => {
      throw new HttpRequestError({ url: "https://rpc.example", status: 429, details: "rate limited" });
    });
    await expect(scanLogs(clientAt(500_000n), 0n, fetchRange)).rejects.toBeInstanceOf(HttpRequestError);
    expect(fetchRange.mock.calls.length).toBeLessThanOrEqual(4); // one round, then propagate
  });

  it("keeps at most four windows in flight, including while a round fails and retries", async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchRange = async (a: bigint, b: bigint) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, a === 0n ? 1 : 5)); // first window fails fast
      inFlight--;
      if (b - a + 1n > 100_000n) throw new UnknownRpcError(new Error("range too large"));
      return [a];
    };
    const logs = await scanLogs(clientAt(LOG_SCAN_CHUNK * 3n - 1n), 0n, fetchRange);
    expect(peak).toBeLessThanOrEqual(4);
    expect(logs).toHaveLength(6); // 600k blocks at 100k
  });

  it("returns nothing when the deploy block is past the head", async () => {
    const fetchRange = vi.fn(async () => [1]);
    expect(await scanLogs(clientAt(10n), 11n, fetchRange)).toEqual([]);
    expect(fetchRange).not.toHaveBeenCalled();
  });
});

describe("rpcErrorDetail", () => {
  it("prefers the node's own message over viem's generic -32000 summary", () => {
    // rpc.chiliz.com answers a too-wide range with -32000; this is the 502 text production showed.
    const err = new InvalidInputRpcError(
      new Error("requested block range too large: 2258204 blocks, limit is 250000"),
    );
    expect(err.shortMessage.split("\n")[0]).toBe("Missing or invalid parameters.");
    expect(rpcErrorDetail(err)).toBe("requested block range too large: 2258204 blocks, limit is 250000");
  });

  it("falls back to the first line of the message, and stringifies non-errors", () => {
    expect(rpcErrorDetail(new Error("boom\nURL: https://secret.example/key"))).toBe("boom");
    expect(rpcErrorDetail("plain")).toBe("plain");
    expect(rpcErrorDetail(undefined)).toBe("undefined");
  });
});
