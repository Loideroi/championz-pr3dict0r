#!/usr/bin/env node
// Slither gate for the contracts workspace (2026-09-12). Run via `npm run
// slither` (contracts/): `hardhat compile` first, then slither with
// --hardhat-ignore-compile (it reads the artifacts instead of re-compiling —
// and instead of running `hardhat clean --global`, which wipes the shared
// compiler cache and races any other compile on the machine); slither writes
// slither-report.json for the whole tree
// (the triage file is deliberately NOT named slither.db.json, which slither
// would auto-load and silently filter with — so the report is the complete
// picture; slither's own console output goes to slither.log), then this script
// decides the exit code:
//   1. the report must exist and slither must have succeeded (a compile error
//      is a failure, never a silent pass; slither.log's tail is printed);
//   2. every High/Medium finding must be triaged in slither-triage.json — a new
//      one fails with its location and description;
//   3. every triage entry must still match a current High/Medium finding by id
//      AND its machine-derivable metadata (check, impact, confidence, where,
//      expression) must equal what the finding says now — so an entry cannot
//      describe one thing while hiding another, and a stale entry (the code
//      moved or was fixed) fails and must be removed or re-triaged; the
//      database can only shrink or be consciously refreshed;
//   4. every entry carries the reviewer-facing fields (triaged date, reason
//      citing SECURITY_FINDINGS.md) and ids are unique.
// Low/Informational/Optimization findings are reported for information only.
// Tests: scripts/check-slither.test.mjs (`npm run test:gate`).
import { readFileSync, existsSync } from "node:fs";

const REPORT = process.env.SLITHER_REPORT ?? "slither-report.json";
const DB = process.env.SLITHER_TRIAGE ?? "slither-triage.json";
const LOG = process.env.SLITHER_LOG ?? "slither.log";
const GATED = new Set(["High", "Medium"]);
const DERIVED = ["check", "slither_impact", "slither_confidence", "where", "expression"];
const REVIEWER = ["triaged", "reason"];

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  if (existsSync(LOG)) {
    const tail = readFileSync(LOG, "utf8").trim().split("\n").slice(-25).join("\n");
    if (tail) console.error(`--- ${LOG} (tail) ---\n${tail}`);
  }
  process.exit(1);
}

// The metadata a triage entry must carry, derived from the finding itself.
export function describe(f) {
  const els = f.elements.filter((e) => e.source_mapping);
  const last = els[els.length - 1];
  const sm = last?.source_mapping;
  const lines = sm?.lines ?? [];
  const where = sm ? `${sm.filename_relative}#${lines[0]}${lines.length > 1 && lines[lines.length - 1] !== lines[0] ? `-${lines[lines.length - 1]}` : ""}` : "?";
  return {
    check: f.check,
    slither_impact: f.impact,
    slither_confidence: f.confidence,
    where,
    expression: (last?.name ?? "").trim().replace(/\n/g, " ").slice(0, 120),
  };
}

if (!existsSync(REPORT)) fail(`${REPORT} missing — slither did not run`);
const report = JSON.parse(readFileSync(REPORT, "utf8"));
if (!report.success) fail(`slither failed: ${report.error ?? "unknown error"}`);

const db = JSON.parse(readFileSync(DB, "utf8"));
const findings = report.results?.detectors ?? [];
const current = new Map(findings.map((f) => [f.id, f]));
const problems = [];
const seen = new Set();

for (const e of db) {
  const tag = `${DB}: entry ${e.id ?? "?"} (${e.check ?? "?"} at ${e.where ?? "?"})`;
  if (!e.id) { problems.push(`${tag}: lacks "id"`); continue; }
  if (seen.has(e.id)) problems.push(`${tag}: duplicate id`);
  seen.add(e.id);
  for (const k of REVIEWER) if (!e[k]) problems.push(`${tag}: lacks "${k}"`);
  if (!/SECURITY_FINDINGS\.md/.test(e.reason ?? "")) problems.push(`${tag}: reason must cite SECURITY_FINDINGS.md`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.triaged ?? "")) problems.push(`${tag}: triaged must be YYYY-MM-DD`);
  const f = current.get(e.id);
  if (!f) { problems.push(`${tag}: stale — no current finding has this id; the code moved or was fixed: remove or re-triage it in this PR`); continue; }
  if (!GATED.has(f.impact)) problems.push(`${tag}: matches a ${f.impact} finding — only High/Medium findings belong in the triage file`);
  const d = describe(f);
  for (const k of DERIVED) {
    if (e[k] !== d[k]) problems.push(`${tag}: "${k}" is ${JSON.stringify(e[k])} but the current finding says ${JSON.stringify(d[k])}`);
  }
}

let gatedCount = 0;
for (const f of findings) {
  if (!GATED.has(f.impact)) continue;
  gatedCount += 1;
  if (seen.has(f.id)) continue;
  const d = describe(f);
  problems.push(`NEW ${f.impact} (${f.confidence}) ${f.check} at ${d.where}: ${f.description.trim().split("\n")[0]}`);
}

if (problems.length) {
  for (const p of problems) console.error(`ERROR: ${p}`);
  process.exit(1);
}
console.log(`check-slither: OK — ${gatedCount} High/Medium finding(s), all ${db.length} triaged in ${DB} with matching metadata; ${findings.length - gatedCount} lower-severity finding(s) informational`);
