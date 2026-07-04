import { describe, expect, it } from 'vitest';
import { packResult, relayOnce, type ChainState, type ChainWriter, type MapEntry } from '../src/relay.js';
import type { MatchResult, ResultSource } from '../src/source.js';

const FLAG = 1n << 20n;

function result(over: Partial<MatchResult>): MatchResult {
  return {
    uefaMatchId: 'u1',
    status: 'FINISHED',
    scoreA90: 1,
    scoreB90: 0,
    totalA: 1,
    totalB: 0,
    penaltyA: null,
    penaltyB: null,
    aggregateA: null,
    aggregateB: null,
    extraTime: false,
    penalties: false,
    advancerTeamId: null,
    winnerReason: 'WIN_REGULAR',
    aggregateWinnerReason: null,
    ...over,
  } as MatchResult;
}

function stubSource(byId: Record<string, MatchResult | null>): ResultSource {
  return {
    id: 'stub',
    fixtures: async () => [],
    livescore: async () => [],
    health: async () => ({ ok: true, issues: [] }) as never,
    result: async (ref: string) => byId[ref] ?? null,
  };
}

class MockWriter implements ChainWriter {
  state = new Map<number, ChainState>();
  pushes: Array<[number, bigint]> = [];
  corrections: Array<[number, bigint]> = [];
  constructor(initial: Record<number, ChainState> = {}) {
    for (const [k, v] of Object.entries(initial)) this.state.set(Number(k), v);
  }
  async read(id: number) {
    return this.state.get(id) ?? { completed: false, provisional: false, packed: null, kickoff: 0 };
  }
  async pushResult(id: number, packed: bigint) {
    this.pushes.push([id, packed]);
    this.state.set(id, { completed: true, provisional: true, packed, kickoff: 0 });
  }
  async correctResult(id: number, packed: bigint) {
    this.corrections.push([id, packed]);
    this.state.set(id, { completed: true, provisional: true, packed, kickoff: 0 });
  }
}

const entry = (matchId: number, uefaMatchId: string): MapEntry => ({
  matchId,
  uefaMatchId,
  homeTeamId: 'H',
  awayTeamId: 'A',
});

describe('packResult (mirrors ChampionzPredictor bit layout)', () => {
  it('packs 90-minute scores with the submitted flag', () => {
    expect(packResult(result({ scoreA90: 2, scoreB90: 1 }), entry(1, 'u1'))).toBe(
      2n | (1n << 8n) | FLAG,
    );
  });

  it('AET decider: 90-minute score, not the total (rule 5.1)', () => {
    // real-world shape: 3-0 in 90', 5-0 aet, home advances in ET
    const r = result({
      scoreA90: 3,
      scoreB90: 0,
      totalA: 5,
      totalB: 0,
      extraTime: true,
      advancerTeamId: 'H',
    });
    const packed = packResult(r, entry(3, 'u3'));
    expect(packed & 0xffn).toBe(3n); // 90' score, never 5
    expect(packed & (1n << 16n)).not.toBe(0n); // ET flag
    expect(packed & (3n << 18n)).toBe(0n); // advancer home
  });

  it('penalties: flags set, away advancer bit set', () => {
    const r = result({
      scoreA90: 1,
      scoreB90: 1,
      penaltyA: 3,
      penaltyB: 4,
      extraTime: true,
      penalties: true,
      advancerTeamId: 'A',
    });
    const packed = packResult(r, entry(4, 'u4'));
    expect(packed & (1n << 17n)).not.toBe(0n);
    expect((packed >> 18n) & 3n).toBe(1n);
  });

  it('rejects an advancer that is neither mapped team', () => {
    expect(() =>
      packResult(result({ advancerTeamId: 'X' }), entry(1, 'u1')),
    ).toThrow(RangeError);
  });
});

describe('relayOnce — a matchday settles hands-off', () => {
  it('pushes every finished mapped match once; second run is a no-op', async () => {
    const source = stubSource({
      u1: result({ uefaMatchId: 'u1', scoreA90: 2, scoreB90: 1 }),
      u2: result({ uefaMatchId: 'u2', scoreA90: 0, scoreB90: 0 }),
      u3: null, // not played yet
    });
    const writer = new MockWriter();
    const map = [entry(1, 'u1'), entry(2, 'u2'), entry(3, 'u3')];

    const first = await relayOnce(source, writer, map);
    expect(first.pushed).toEqual([1, 2]);
    expect(first.skipped).toEqual([3]);
    expect(first.errors).toEqual([]);

    const second = await relayOnce(source, writer, map); // idempotency
    expect(second.pushed).toEqual([]);
    expect(second.skipped).toEqual([1, 2, 3]);
    expect(writer.pushes).toHaveLength(2);
  });

  it('corrects a provisional result when the feed amends, skips when equal', async () => {
    const amended = result({ uefaMatchId: 'u1', scoreA90: 3, scoreB90: 1 });
    const source = stubSource({ u1: amended });
    const onChain = packResult(result({ scoreA90: 2, scoreB90: 1 }), entry(1, 'u1'));
    const writer = new MockWriter({
      1: { completed: true, provisional: true, packed: onChain, kickoff: 0 },
    });

    const run = await relayOnce(source, writer, [entry(1, 'u1')]);
    expect(run.corrected).toEqual([1]);
    expect(writer.corrections[0]?.[1]).toBe(packResult(amended, entry(1, 'u1')));
  });

  it('skips matches that have not kicked off (a push would revert MatchNotStarted)', async () => {
    const source = stubSource({ u1: result({}) });
    const writer = new MockWriter({
      1: { completed: false, provisional: false, packed: null, kickoff: 2_000_000_000 },
    });
    const run = await relayOnce(source, writer, [entry(1, 'u1')], 1_999_999_999);
    expect(run.skipped).toEqual([1]);
    expect(writer.pushes).toHaveLength(0);
    // …and pushes once the clock passes kickoff
    const run2 = await relayOnce(source, writer, [entry(1, 'u1')], 2_000_000_001);
    expect(run2.pushed).toEqual([1]);
  });

  it('NEVER touches a finalized result, even when the feed differs', async () => {
    const source = stubSource({ u1: result({ scoreA90: 9, scoreB90: 9 }) });
    const writer = new MockWriter({
      1: { completed: true, provisional: false, packed: 1n | FLAG, kickoff: 0 },
    });
    const run = await relayOnce(source, writer, [entry(1, 'u1')]);
    expect(run.skipped).toEqual([1]);
    expect(writer.corrections).toHaveLength(0);
  });

  it('mirror-UEFA: a FINISHED forfeit relays verbatim (D6)', async () => {
    const source = stubSource({
      u1: result({ scoreA90: 3, scoreB90: 0, winnerReason: 'WIN_BY_FORFEIT' }),
    });
    const writer = new MockWriter();
    const run = await relayOnce(source, writer, [entry(1, 'u1')]);
    expect(run.pushed).toEqual([1]); // no filtering
  });

  it('non-FINISHED statuses are skipped, one bad match cannot poison the run', async () => {
    const source = stubSource({
      u1: result({ status: 'LIVE' as never }),
      u2: result({ uefaMatchId: 'u2', advancerTeamId: 'X' }), // will throw in pack
      u3: result({ uefaMatchId: 'u3' }),
    });
    const writer = new MockWriter();
    const run = await relayOnce(source, writer, [entry(1, 'u1'), entry(2, 'u2'), entry(3, 'u3')]);
    expect(run.skipped).toEqual([1]);
    expect(run.errors).toHaveLength(1);
    expect(run.pushed).toEqual([3]); // u3 still relayed
  });
});
