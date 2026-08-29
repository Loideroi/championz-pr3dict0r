import { afterEach, describe, expect, it } from "vitest";
import { chainFor, CHAIN_MAINNET, CHAIN_SPICY, deployBlockFor, rpcCandidatesFor } from "./chains";

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
