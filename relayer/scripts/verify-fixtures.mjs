#!/usr/bin/env node
/**
 * Verify a matches.json against the UEFA feed (PRD §7.4) — the predecessor's
 * hardest-won guardrail, re-pointed FIFA -> UEFA.
 *
 * Our matchId is our OWN 1..N numbering, so matches are joined by FIXTURE
 * IDENTITY, never by number: kickoff DATE (UTC, YYYY-MM-DD) + the ordered
 * home/away team-name pair. Orientation matters (scores are directional), so
 * a home/away swap is a real failure, reported as such.
 *
 * Checks per matches.json entry:
 *   1. IDENTITY — a feed match exists on that date with those teams
 *   2. KICKOFF  — kickoffTime (unix) equals the feed's dateTime exactly
 *   3. ID       — uefaMatchId agrees with the joined feed match
 *   4. LEG/TYPE — legNumber + knockout flag agree with the feed's match type
 * Plus completeness: every TOURNAMENT feed match must appear in matches.json
 * (skipped with --partial for partial fixture inputs).
 *
 * Read-only. Non-zero exit + a diff on any discrepancy.
 *
 * Usage:
 *   node scripts/verify-fixtures.mjs --matches <matches.json> --feed <raw-fixture.json>... [--partial]
 *   node scripts/verify-fixtures.mjs --matches <matches.json> --season 2026
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = 'https://match.uefa.com/v5/matches';
const COMPETITION_ID = '1';
const PAGE = 50;

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const argMulti = (name) => {
  const i = argv.indexOf(name);
  if (i === -1) return [];
  const values = [];
  for (let k = i + 1; k < argv.length && !argv[k].startsWith('--'); k++) values.push(argv[k]);
  return values;
};

const matchesPath = arg('--matches');
const feedFiles = argMulti('--feed');
const season = arg('--season');
const partial = argv.includes('--partial');
if (!matchesPath || (feedFiles.length === 0 && !season)) {
  console.error('usage: verify-fixtures.mjs --matches <matches.json> (--feed <raw.json>... | --season <year>) [--partial]');
  process.exit(2);
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
const pairKey = (date, home, away) => `${date}|${norm(home)}|${norm(away)}`;
const utcDate = (unix) => new Date(unix * 1000).toISOString().slice(0, 10);

async function fetchSeason(seasonYear) {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${API}?competitionId=${COMPETITION_ID}&seasonYear=${seasonYear}&order=ASC&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      console.error(`UEFA API HTTP ${res.status} for ${url}`);
      process.exit(2);
    }
    const page = await res.json();
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all;
}

// --- load feed (raw match.uefa.com/v5 arrays) -------------------------------
let rawFeed = [];
if (feedFiles.length > 0) {
  for (const f of feedFiles) rawFeed.push(...JSON.parse(readFileSync(resolve(f), 'utf8')));
} else {
  rawFeed = await fetchSeason(season);
}
const feedById = new Map();
for (const m of rawFeed) {
  if (m.competitionPhase !== 'TOURNAMENT') continue;
  feedById.set(m.id, m);
}
const feed = [...feedById.values()];

const feedByKey = new Map();
const feedCollisions = new Set();
for (const f of feed) {
  const iso = f.kickOffTime?.dateTime;
  const date = iso ? iso.slice(0, 10) : f.kickOffTime?.date;
  const k = pairKey(date, f.homeTeam.internationalName, f.awayTeam.internationalName);
  if (feedByKey.has(k)) feedCollisions.add(k);
  feedByKey.set(k, f);
}
if (feedCollisions.size > 0) {
  console.error(`internal: ${feedCollisions.size} identity collision(s) in the feed — join key needs strengthening`);
  process.exit(2);
}

// --- load matches.json -------------------------------------------------------
const doc = JSON.parse(readFileSync(resolve(matchesPath), 'utf8'));
const teams = doc.teams || {};
const nameOf = (code) => teams[code]?.name ?? code; // placeholders carry their label directly

const problems = { identity: [], kickoff: [], id: [], leg: [], missing: [] };
const matchedFeedIds = new Set();

for (const m of doc.matches) {
  const nameA = nameOf(m.teamA);
  const nameB = nameOf(m.teamB);
  if (m.kickoffTime == null) continue; // unscheduled placeholder — nothing to join on yet
  const date = utcDate(m.kickoffTime);
  const f = feedByKey.get(pairKey(date, nameA, nameB));

  if (!f) {
    const swapped = feedByKey.get(pairKey(date, nameB, nameA));
    if (swapped) {
      problems.identity.push(
        `matchId ${m.matchId}: ${nameA} v ${nameB} on ${date} — feed has the ORIENTATION SWAPPED (${swapped.homeTeam.internationalName} v ${swapped.awayTeam.internationalName}); scores are directional, fix the wiring`,
      );
      matchedFeedIds.add(swapped.id);
    } else {
      problems.identity.push(
        `matchId ${m.matchId}: ${nameA} v ${nameB} on ${date} — NO such fixture in the UEFA feed (scrambled feeder, wrong team, or moved kickoff)`,
      );
    }
    continue;
  }
  matchedFeedIds.add(f.id);

  const feedUnix = f.kickOffTime?.dateTime ? Math.floor(Date.parse(f.kickOffTime.dateTime) / 1000) : null;
  if (feedUnix !== null && feedUnix !== m.kickoffTime) {
    const deltaMin = Math.round((feedUnix - m.kickoffTime) / 60);
    problems.kickoff.push(
      `matchId ${m.matchId} (${nameA} v ${nameB}): kickoff ${new Date(m.kickoffTime * 1000).toISOString()} vs feed ${f.kickOffTime.dateTime} (${deltaMin > 0 ? '+' : ''}${deltaMin} min)`,
    );
  }

  if (m.uefaMatchId != null && String(m.uefaMatchId) !== String(f.id)) {
    problems.id.push(`matchId ${m.matchId} (${nameA} v ${nameB}): uefaMatchId ${m.uefaMatchId} vs feed ${f.id}`);
  }

  const feedLeg = f.leg?.number ?? (f.type === 'FIRST_LEG' ? 1 : f.type === 'SECOND_LEG' ? 2 : null);
  if ((m.legNumber ?? null) !== feedLeg) {
    problems.leg.push(`matchId ${m.matchId} (${nameA} v ${nameB}): legNumber ${m.legNumber ?? null} vs feed ${feedLeg} (${f.type})`);
  }
  const feedKnockout = f.type !== 'GROUP_STAGE';
  if (Boolean(m.knockout) !== feedKnockout) {
    problems.leg.push(`matchId ${m.matchId} (${nameA} v ${nameB}): knockout=${Boolean(m.knockout)} vs feed type ${f.type}`);
  }
}

if (!partial) {
  for (const f of feed) {
    if (!matchedFeedIds.has(f.id)) {
      problems.missing.push(
        `feed ${f.id}: ${f.homeTeam.internationalName} v ${f.awayTeam.internationalName} (${f.kickOffTime?.date}) not in ${matchesPath}`,
      );
    }
  }
}

// --- report ------------------------------------------------------------------
console.log(`# Fixture verification vs UEFA feed (${feedFiles.length > 0 ? feedFiles.join(', ') : `live seasonYear=${season}`})`);
console.log(`# ${doc.matches.length} matches in ${matchesPath}, ${feed.length} TOURNAMENT matches in feed\n`);
const section = (title, arr, ok) => {
  console.log(`## ${title}`);
  console.log(arr.length === 0 ? `  OK — ${ok}` : arr.map((l) => `  ${l}`).join('\n'));
  console.log('');
};
section('IDENTITY (team wiring / feeders)', problems.identity, 'every match joins a feed fixture by date + teams');
section('KICKOFF drift', problems.kickoff, 'all kickoff times match the feed exactly');
section('UEFA MATCH ID consistency', problems.id, 'all uefaMatchIds agree with the joined fixture');
section('LEG / KNOCKOUT wiring', problems.leg, 'legNumber + knockout flags agree with feed match types');
if (!partial) section('COMPLETENESS (feed matches missing from matches.json)', problems.missing, 'every tournament feed match is covered');

const total = Object.values(problems).reduce((n, arr) => n + arr.length, 0);
console.log(`# Summary: ${total} discrepanc${total === 1 ? 'y' : 'ies'}`);
process.exit(total > 0 ? 1 : 0);
