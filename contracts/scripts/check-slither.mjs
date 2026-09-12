#!/usr/bin/env node
// Slither gate for the contracts workspace (2026-09-12). Run via `npm run
// slither` (contracts/): slither writes slither-report.json for the whole tree
// (slither must NOT see a triage db — the file is deliberately not named slither.db.json, which slither would auto-load — so the report is the complete picture), then this script
// decides the exit code:
//   1. the report must exist and slither must have succeeded (a compile error
//      is a failure, never a silent pass);
//   2. every High/Medium finding must be triaged in slither-triage.json — a new one
//      fails with its location and description;
//   3. every triage entry must still match a current finding — a stale entry
//      (the code moved or was fixed) fails and must be removed or re-triaged,
//      so the database can only shrink or be consciously refreshed;
//   4. every entry carries the annotation a reviewer needs (check, where,
//      expression, triaged date, reason citing SECURITY_FINDINGS.md) and ids
//      are unique.
// Low/Informational/Optimization findings are reported for information only.
import { readFileSync, existsSync } from "node:fs";

const REPORT = "slither-report.json";
const DB = "slither-triage.json";
const GATED = new Set(["High", "Medium"]);
const REQUIRED = ["id", "check", "slither_impact", "where", "expression", "triaged", "reason"];

if (!existsSync(REPORT)) fail(`${REPORT} missing — slither did not run`);
const report = JSON.parse(readFileSync(REPORT, "utf8"));
if (!report.success) fail(`slither failed: ${report.error ?? "unknown error"}`);

const db = JSON.parse(readFileSync(DB, "utf8"));
const problems = [];
const seen = new Set();
for (const e of db) {
  for (const k of REQUIRED) if (!e[k]) problems.push(`${DB}: entry ${e.id ?? "?"} lacks "${k}"`);
  if (!/SECURITY_FINDINGS\.md/.test(e.reason ?? "")) problems.push(`${DB}: entry ${e.id} reason must cite SECURITY_FINDINGS.md`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.triaged ?? "")) problems.push(`${DB}: entry ${e.id} triaged must be YYYY-MM-DD`);
  if (seen.has(e.id)) problems.push(`${DB}: duplicate id ${e.id}`);
  seen.add(e.id);
}

const findings = report.results?.detectors ?? [];
const current = new Map(findings.map((f) => [f.id, f]));
for (const e of db) {
  if (!current.has(e.id)) problems.push(`${DB}: stale entry ${e.id} (${e.check} at ${e.where}) — no current finding matches; the code moved or was fixed: remove or re-triage it in this PR`);
}
let gatedCount = 0;
for (const f of findings) {
  if (!GATED.has(f.impact)) continue;
  gatedCount += 1;
  if (seen.has(f.id)) continue;
  const el = f.elements.find((x) => x.source_mapping);
  const sm = el?.source_mapping;
  const where = sm ? `${sm.filename_relative}#${sm.lines?.[0]}` : "?";
  problems.push(`NEW ${f.impact} (${f.confidence}) ${f.check} at ${where}: ${f.description.trim().split("\n")[0]}`);
}

const info = findings.length - gatedCount;
if (problems.length) {
  for (const p of problems) console.error(`ERROR: ${p}`);
  process.exit(1);
}
console.log(`check-slither: OK — ${gatedCount} High/Medium finding(s), all ${db.length} triaged in ${DB}; ${info} lower-severity finding(s) informational`);

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}
