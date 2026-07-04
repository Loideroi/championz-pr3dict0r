import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const relayerRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const fixturePath = (name: string) => resolve(relayerRoot, 'test/fixtures', name);

export const loadFixture = <T = unknown>(name: string): T =>
  JSON.parse(readFileSync(fixturePath(name), 'utf8')) as T;

/** The two recorded live payloads (raw match.uefa.com/v5 arrays). */
export const FIRST20 = 'matches-ucl-2026-first20.json';
export const AET_BATCH = 'matches-ucl-2026-aet.json';

/** Known matches inside the recorded 2025/26 archive. */
export const KNOWN = {
  /** R16 second leg, Sporting CP 3-0 (90′) -> 5-0 aet v Bodø/Glimt; tie won in ET */
  aetSecondLeg: '2048061',
  /** KO play-off second leg: Juventus WIN the leg 3-0 (90′), Galatasaray advance in ET */
  aetAdvancerIsNotMatchWinner: '2047770',
  /** The final: Paris 1-1 Arsenal after 120′, 4-3 on penalties */
  finalOnPenalties: '2047742',
  galatasarayTeamId: '50067',
  sportingTeamId: '50149',
  parisTeamId: '52747',
} as const;
