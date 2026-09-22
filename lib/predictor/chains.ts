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

/**
 * RPC endpoints to try, in order: whatever the deployment configures, then the
 * chain's own public endpoints.
 *
 * Not every Chiliz RPC can answer every query. Every public endpoint caps the
 * `eth_getLogs` block range, and the caps differ by two orders of magnitude
 * (measured 2026-09-22): Ankr's free tier — what production is configured
 * with — 1,000 blocks (`-32062 "Block range is too large"`); publicnode
 * 50,000; `rpc.chiliz.com` 250,000 (it answered from genesis until
 * September 2026). A season of Entered events is ~2.3M blocks and growing, so
 * on Ankr it is not a matter of chunking: thousands of requests is not a
 * strategy. Callers that need a wide range go through {@link scanLogs} and
 * walk this list until one endpoint can serve the chunk size; contract reads
 * work on any of them.
 */
export function rpcCandidatesFor(chainId: number): string[] {
  const configured = [process.env.CHILIZ_RPC_URL, process.env.NEXT_PUBLIC_RPC_URL].filter(
    (url): url is string => typeof url === "string" && url.length > 0,
  );
  return [...new Set([...configured, ...chainFor(chainId).rpcUrls.default.http])];
}

/** Under rpc.chiliz.com's 250,000-block `eth_getLogs` cap, with room to spare. */
export const LOG_SCAN_CHUNK = 200_000n;

/**
 * Smallest chunk worth retrying at. Below this a season scan is hundreds of
 * requests — at that point the endpoint is the wrong one, not the chunk.
 */
export const LOG_SCAN_MIN_CHUNK = 25_000n;

/** Chunks in flight at once — gentle enough for a public endpoint. */
const LOG_SCAN_CONCURRENCY = 4;

/**
 * Fetch logs from `fromBlock` to the current head in fixed-size block windows,
 * in order. A window the endpoint refuses halves the chunk and retries the
 * whole scan, down to {@link LOG_SCAN_MIN_CHUNK}; past that the error
 * propagates so the caller can move to the next RPC candidate.
 */
export async function scanLogs<T>(
  client: PublicClient,
  fromBlock: bigint,
  fetch: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  chunk = LOG_SCAN_CHUNK,
): Promise<T[]> {
  const latest = await client.getBlockNumber();
  const windows: [bigint, bigint][] = [];
  for (let from = fromBlock; from <= latest; from += chunk) {
    const to = from + chunk - 1n;
    windows.push([from, to < latest ? to : latest]);
  }
  const out: T[][] = new Array(windows.length);
  try {
    for (let i = 0; i < windows.length; i += LOG_SCAN_CONCURRENCY) {
      const slice = windows.slice(i, i + LOG_SCAN_CONCURRENCY);
      const results = await Promise.all(slice.map(([from, to]) => fetch(from, to)));
      results.forEach((r, j) => {
        out[i + j] = r;
      });
    }
  } catch (err) {
    const smaller = chunk / 2n;
    if (smaller < LOG_SCAN_MIN_CHUNK) throw err;
    return scanLogs(client, fromBlock, fetch, smaller);
  }
  return out.flat();
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
