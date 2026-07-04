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

export function viemWriter(opts: {
  rpcUrl: string;
  chain?: Chain;
  contract: Address;
  oracleKey: `0x${string}`;
}): ChainWriter {
  const chain = opts.chain ?? spicy;
  const transport = http(opts.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount(opts.oracleKey);
  const wallet = createWalletClient({ account, chain, transport });

  async function read(matchId: number): Promise<ChainState> {
    const [[scoreA, scoreB, extraTime, penalties, advancer, completed, provisional], game] =
      await Promise.all([
        publicClient.readContract({
          address: opts.contract,
          abi: ABI,
          functionName: 'resultOf',
          args: [matchId],
        }),
        publicClient.readContract({
          address: opts.contract,
          abi: ABI,
          functionName: 'matches',
          args: [matchId],
        }),
      ]);
    const kickoff = Number(game[0]);
    if (!completed) return { completed: false, provisional: false, packed: null, kickoff };
    let packed = BigInt(scoreA) | (BigInt(scoreB) << 8n) | FLAG_SUBMITTED;
    if (extraTime) packed |= 1n << 16n;
    if (penalties) packed |= 1n << 17n;
    packed |= BigInt(advancer & 3) << 18n;
    return { completed, provisional, packed, kickoff };
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
    pushResult: (id, packed) => write('pushResult', id, packed),
    correctResult: (id, packed) => write('correctResult', id, packed),
  };
}
