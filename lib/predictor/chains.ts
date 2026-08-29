/**
 * Server-side chain resolution for Chiliz (88888) and Spicy (88882).
 *
 * viem ships both chains; mainnet carries a multicall3 deployment
 * (`0xcA11…CA11`) and Spicy does not, so every bulk reader has to branch on
 * `chain.contracts.multicall3` rather than assume it. The relayer learned this
 * the hard way: 288 sequential eth_calls exhausted Ankr's free-tier rate limit
 * mid-run (PR #60). Anything that loops over entrants or matches goes through
 * {@link readBatch}.
 */
import { chiliz, spicy } from "viem/chains";
import type { Chain, PublicClient } from "viem";

export const CHAIN_MAINNET = chiliz.id; // 88888
export const CHAIN_SPICY = spicy.id; // 88882

export function chainFor(chainId: number): Chain {
  if (chainId === CHAIN_MAINNET) return chiliz;
  if (chainId === CHAIN_SPICY) return spicy;
  throw new Error(`unsupported chainId ${chainId} — expected 88888 or 88882`);
}

export function isSupportedChain(chainId: number): boolean {
  return chainId === CHAIN_MAINNET || chainId === CHAIN_SPICY;
}

/**
 * Block the predictor proxy was deployed in. `getLogs(fromBlock: 0)` works
 * today but scans the whole chain — pinning the deploy block keeps the entrant
 * scan O(season) as Chiliz grows, and lets stricter RPCs (which cap block
 * ranges) answer at all.
 */
export const PREDICTOR_DEPLOY_BLOCK: Record<number, bigint> = {
  [CHAIN_MAINNET]: 35_505_430n, // 2026-07-05T16:10:36Z
  [CHAIN_SPICY]: 0n, // staging proxy has been redeployed; scan from genesis
};

export function deployBlockFor(chainId: number): bigint {
  return PREDICTOR_DEPLOY_BLOCK[chainId] ?? 0n;
}

/** RPC endpoint for server-side reads; falls back to the chain's public URL. */
export function rpcUrlFor(chainId: number): string {
  return (
    process.env.CHILIZ_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    chainFor(chainId).rpcUrls.default.http[0]!
  );
}

/** Multicall3 caps out well before this; 40 keeps heavy views inside gas. */
export const MULTICALL_BATCH = 40;

/** Parallelism for chains without multicall3 — gentle enough for free RPCs. */
const FALLBACK_CONCURRENCY = 8;

type Call = { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args?: unknown[] };

type MulticallEntry =
  | { status: "success"; result: unknown }
  | { status: "failure"; error: unknown };

/**
 * Read many contract calls with the cheapest transport the chain offers:
 * chunked multicall3 where it exists, a bounded-concurrency pool otherwise.
 * Returns results positionally; a failed call surfaces as `null` so one bad
 * entry can never take the whole board down.
 */
export async function readBatch(
  client: PublicClient,
  calls: Call[],
  batchSize = MULTICALL_BATCH,
): Promise<(unknown | null)[]> {
  if (calls.length === 0) return [];
  const out: (unknown | null)[] = new Array(calls.length).fill(null);

  if (client.chain?.contracts?.multicall3) {
    // viem's multicall type is generic over a literal contracts tuple; these
    // are built at runtime, so the call is typed through a narrow shim.
    const multicall = client.multicall as unknown as (
      args: { contracts: Call[]; allowFailure: true },
    ) => Promise<MulticallEntry[]>;
    for (let i = 0; i < calls.length; i += batchSize) {
      const slice = calls.slice(i, i + batchSize);
      const results = await multicall({ contracts: slice, allowFailure: true });
      results.forEach((r, j) => {
        out[i + j] = r.status === "success" ? r.result : null;
      });
    }
    return out;
  }

  for (let i = 0; i < calls.length; i += FALLBACK_CONCURRENCY) {
    const slice = calls.slice(i, i + FALLBACK_CONCURRENCY);
    const results = await Promise.all(
      slice.map((c) =>
        client.readContract(c as never).catch(() => null),
      ),
    );
    results.forEach((r, j) => {
      out[i + j] = r;
    });
  }
  return out;
}
