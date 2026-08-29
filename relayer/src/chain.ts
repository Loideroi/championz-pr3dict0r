import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { ChainState, ChainWriter } from './relay.js';

/** Chiliz Spicy (88882) / mainnet (88888) — minimum gas 2,501 gwei. */
export const spicy: Chain = {
  id: 88882,
  name: 'Chiliz Spicy',
  nativeCurrency: { name: 'Chiliz', symbol: 'CHZ', decimals: 18 },
  rpcUrls: { default: { http: ['https://spicy-rpc.chiliz.com'] } },
};

/** Multicall3 is deployed on mainnet (not on Spicy): 288 per-match reads become 3 requests. */
export const CHILIZ_MULTICALL3: Address = '0xcA11bde05977b3631167028862bE2a173976CA11';

export const chiliz: Chain = {
  id: 88888,
  name: 'Chiliz Chain',
  nativeCurrency: { name: 'Chiliz', symbol: 'CHZ', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.ankr.com/chiliz'] } },
  contracts: { multicall3: { address: CHILIZ_MULTICALL3, blockCreated: 8080847 } },
};

/**
 * The wallet client signs with the chain's id — a Spicy-configured writer
 * pointed at a mainnet RPC produces transactions the node rejects. Resolve
 * the chain from CHAIN_ID explicitly; unknown ids are a loud failure.
 */
export function chainFor(chainId: number): Chain {
  if (chainId === chiliz.id) return chiliz;
  if (chainId === spicy.id) return spicy;
  throw new Error(`unsupported CHAIN_ID ${chainId} — expected 88888 (Chiliz) or 88882 (Spicy)`);
}

/**
 * Public RPCs rate-limit bursts ("call rate limit exhausted, retry in 10s" on
 * Ankr's free tier). Retry with exponential backoff (2s, 4s, 8s by default)
 * before giving up — reads only; writes are never retried (double-send risk).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const base = opts.baseDelayMs ?? 2_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(base * 2 ** i);
    }
  }
  throw lastErr;
}

const GAS_PRICE = 2_510_000_000_000n; // 2,510 gwei > 2,501 floor

const ABI = [
  {
    type: 'function',
    name: 'resultOf',
    stateMutability: 'view',
    inputs: [{ name: 'matchId', type: 'uint16' }],
    outputs: [
      { name: 'scoreA', type: 'uint8' },
      { name: 'scoreB', type: 'uint8' },
      { name: 'extraTime', type: 'bool' },
      { name: 'penalties', type: 'bool' },
      { name: 'advancer', type: 'uint8' },
      { name: 'completed', type: 'bool' },
      { name: 'provisional', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'matches',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint16' }],
    outputs: [
      { name: 'kickoff', type: 'uint40' },
      { name: 'status', type: 'uint8' },
      { name: 'teamA', type: 'bytes3' },
      { name: 'teamB', type: 'bytes3' },
      { name: 'stage', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'pushResult',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'uint16' },
      { name: 'packed', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'correctResult',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'uint16' },
      { name: 'packed', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const FLAG_SUBMITTED = 1n << 20n;

/** resultOf(matchId) tuple as viem returns it. */
export type ResultTuple = readonly [number, number, boolean, boolean, number, boolean, boolean];
/** matches(matchId) tuple as viem returns it. */
export type GameTuple = readonly [bigint | number, number, string, string, number];

/** Pure: (resultOf, matches) tuples → the relayer's ChainState (mirrors the packed layout). */
export function decodeState(result: ResultTuple, game: GameTuple): ChainState {
  const [scoreA, scoreB, extraTime, penalties, advancer, completed, provisional] = result;
  const kickoff = Number(game[0]);
  if (!completed) return { completed: false, provisional: false, packed: null, kickoff };
  let packed = BigInt(scoreA) | (BigInt(scoreB) << 8n) | FLAG_SUBMITTED;
  if (extraTime) packed |= 1n << 16n;
  if (penalties) packed |= 1n << 17n;
  packed |= BigInt(advancer & 3) << 18n;
  return { completed, provisional, packed, kickoff };
}

/** Matches per multicall request (2 calls each → 96 calls/request; 144 matches = 3 requests). */
const MULTICALL_BATCH = 48;

export function viemWriter(opts: {
  rpcUrl: string;
  /** explicit chain object; else resolved from `chainId`; else Spicy */
  chain?: Chain;
  chainId?: number;
  contract: Address;
  oracleKey: `0x${string}`;
}): ChainWriter {
  const chain = opts.chain ?? (opts.chainId !== undefined ? chainFor(opts.chainId) : spicy);
  const transport = http(opts.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount(opts.oracleKey);
  const wallet = createWalletClient({ account, chain, transport });

  async function read(matchId: number): Promise<ChainState> {
    const [result, game] = await withRetry(() =>
      Promise.all([
        publicClient.readContract({ address: opts.contract, abi: ABI, functionName: 'resultOf', args: [matchId] }),
        publicClient.readContract({ address: opts.contract, abi: ABI, functionName: 'matches', args: [matchId] }),
      ]),
    );
    return decodeState(result, game);
  }

  /** All states in a handful of multicall requests (sequential fallback where multicall3 is absent). */
  async function readMany(ids: number[]): Promise<Map<number, ChainState>> {
    const out = new Map<number, ChainState>();
    if (!chain.contracts?.multicall3) {
      for (const id of ids) out.set(id, await read(id));
      return out;
    }
    for (let i = 0; i < ids.length; i += MULTICALL_BATCH) {
      const slice = ids.slice(i, i + MULTICALL_BATCH);
      const contracts = slice.flatMap((id) => [
        { address: opts.contract, abi: ABI, functionName: 'resultOf', args: [id] } as const,
        { address: opts.contract, abi: ABI, functionName: 'matches', args: [id] } as const,
      ]);
      const results = (await withRetry(() =>
        publicClient.multicall({ contracts, allowFailure: false }),
      )) as unknown as Array<ResultTuple | GameTuple>;
      slice.forEach((id, k) => {
        out.set(id, decodeState(results[2 * k] as ResultTuple, results[2 * k + 1] as GameTuple));
      });
    }
    return out;
  }

  async function write(fn: 'pushResult' | 'correctResult', matchId: number, packed: bigint) {
    const hash = await wallet.writeContract({
      address: opts.contract,
      abi: ABI,
      functionName: fn,
      args: [matchId, packed],
      gasPrice: GAS_PRICE,
    });
    await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  }

  return {
    read,
    readMany,
    pushResult: (id, packed) => write('pushResult', id, packed),
    correctResult: (id, packed) => write('correctResult', id, packed),
  };
}
