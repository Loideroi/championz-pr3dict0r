import { describe, expect, it } from 'vitest';
import { chainFor, chiliz, decodeState, spicy, withRetry } from '../src/chain.js';

describe('chainFor', () => {
  it('resolves the two Chiliz networks by id', () => {
    expect(chainFor(88888)).toBe(chiliz);
    expect(chainFor(88882)).toBe(spicy);
  });

  it('refuses an unknown chain id loudly (a mis-signed tx would just be rejected by the node)', () => {
    expect(() => chainFor(1)).toThrow(/unsupported CHAIN_ID/);
  });

  it('mainnet carries multicall3 (bulk reads), Spicy does not (sequential fallback)', () => {
    expect(chiliz.contracts?.multicall3?.address).toMatch(/^0xcA11/);
    expect(spicy.contracts?.multicall3).toBeUndefined();
  });
});

describe('withRetry — public RPC rate limits', () => {
  it('retries with exponential backoff and returns the first success', async () => {
    const delays: number[] = [];
    let calls = 0;
    const value = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error('Too many requests, reason: call rate limit exhausted, retry in 10s');
        return 'ok';
      },
      { baseDelayMs: 100, sleep: async (ms) => void delays.push(ms) },
    );
    expect(value).toBe('ok');
    expect(calls).toBe(3);
    expect(delays).toEqual([100, 200]);
  });

  it('gives up after the configured attempts with the last error', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => { calls++; throw new Error('still limited'); }, { attempts: 3, baseDelayMs: 1, sleep: async () => {} }),
    ).rejects.toThrow('still limited');
    expect(calls).toBe(3);
  });
});

describe('decodeState — (resultOf, matches) tuples → ChainState', () => {
  const game = (kickoff: number) => [BigInt(kickoff), 0, '0x524d41', '0x4d4349', 0] as const;

  it('an unplayed match has no packed result but keeps its kickoff', () => {
    expect(decodeState([0, 0, false, false, 0, false, false], game(1_788_885_900))).toEqual({
      completed: false, provisional: false, packed: null, kickoff: 1_788_885_900,
    });
  });

  it('re-packs a completed provisional result exactly like the contract layout', () => {
    const s = decodeState([3, 1, true, true, 1, true, true], game(1_700_000_000));
    expect(s.completed).toBe(true);
    expect(s.provisional).toBe(true);
    expect(s.packed).toBe(3n | (1n << 8n) | (1n << 16n) | (1n << 17n) | (1n << 18n) | (1n << 20n));
  });
});
