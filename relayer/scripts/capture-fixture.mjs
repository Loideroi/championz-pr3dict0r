#!/usr/bin/env node
/**
 * Capture LIVE payloads from UEFA's unofficial match API into test fixtures.
 *
 * Endpoint (no auth, undocumented — PRD §7.1):
 *   https://match.uefa.com/v5/matches?competitionId=1&seasonYear=<Y>&limit=..&offset=..
 *
 * competitionId=1 = UEFA Champions League. seasonYear is the year the season
 * ENDS (2025/26 season -> seasonYear=2026).
 *
 * Writes raw, pretty-printed JSON (verbatim API output, only re-indented) to:
 *   test/fixtures/matches-ucl-<seasonYear>-first20.json   first 20 matches of the season
 *   test/fixtures/matches-ucl-<seasonYear>-aet.json       one page containing >=1 real
 *                                                          AET match (score.regular != score.total)
 *   test/fixtures/capture-meta.json                        when/what/where-from
 *
 * Read-only. Writes nothing outside test/fixtures/. Re-run to refresh fixtures.
 *
 * Usage: node scripts/capture-fixture.mjs [seasonYear]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://match.uefa.com/v5/matches';
const COMPETITION_ID = '1'; // UEFA Champions League
const PAGE = 50;

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../test/fixtures');

async function fetchMatches(seasonYear, { limit, offset }) {
  const url = `${API}?competitionId=${COMPETITION_ID}&seasonYear=${seasonYear}&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`UEFA API HTTP ${res.status} for ${url}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error(`UEFA API returned non-array for ${url}`);
  return { url, body };
}

const isAet = (m) =>
  m.status === 'FINISHED' &&
  m.score?.regular &&
  m.score?.total &&
  (m.score.regular.home !== m.score.total.home || m.score.regular.away !== m.score.total.away);

const save = (name, data) => {
  const path = resolve(fixturesDir, name);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`  wrote ${name} (${Array.isArray(data) ? data.length + ' matches' : 'meta'})`);
  return path;
};

(async () => {
  mkdirSync(fixturesDir, { recursive: true });
  const requested = process.argv[2] ? [process.argv[2]] : ['2026', '2025'];
  const meta = { capturedAt: new Date().toISOString(), api: API, competitionId: COMPETITION_ID, requests: [] };

  let seasonYear = null;
  let first20 = null;
  for (const y of requested) {
    const { url, body } = await fetchMatches(y, { limit: 20, offset: 0 });
    meta.requests.push({ url, matches: body.length });
    console.log(`seasonYear=${y}: ${body.length} matches`);
    if (body.length > 0) {
      seasonYear = y;
      first20 = body;
      break;
    }
    console.log(`  season ${y} empty — trying next`);
  }
  if (!seasonYear) {
    console.error('No matches found for any requested seasonYear — nothing captured.');
    process.exit(2);
  }
  save(`matches-ucl-${seasonYear}-first20.json`, first20);

  // Page through the season (knockout rounds are at the end) to find a real
  // AET match: FINISHED with score.regular != score.total.
  let aetBatch = null;
  let aetIds = [];
  for (let offset = 0; offset < 400; offset += PAGE) {
    const { url, body } = await fetchMatches(seasonYear, { limit: PAGE, offset });
    meta.requests.push({ url, matches: body.length });
    const hits = body.filter(isAet);
    if (hits.length > 0) {
      aetBatch = body;
      aetIds = hits.map((m) => ({
        id: m.id,
        teams: `${m.homeTeam?.internationalName} v ${m.awayTeam?.internationalName}`,
        regular: m.score.regular,
        total: m.score.total,
        penalty: m.score.penalty ?? null,
        winnerReason: m.winner?.match?.reason ?? null,
      }));
      console.log(`AET match(es) found at offset ${offset}:`);
      for (const h of aetIds) console.log(`  ${h.id} ${h.teams} regular ${h.regular.home}-${h.regular.away} total ${h.total.home}-${h.total.away} (${h.winnerReason})`);
      break;
    }
    if (body.length < PAGE) break; // end of season feed
  }
  if (aetBatch) {
    save(`matches-ucl-${seasonYear}-aet.json`, aetBatch);
    meta.aetMatches = aetIds;
  } else {
    console.warn('No AET match found in this season — matches-ucl-*-aet.json NOT written.');
  }

  meta.seasonYear = seasonYear;
  save('capture-meta.json', meta);
})();
