#!/usr/bin/env node
// Slither gate for the contracts workspace (2026-09-12). `npm run slither`
// (contracts/) runs this script with --run, which: compiles with
// `hardhat compile --force` (a full compile, so artifacts always match the
// source even after an earlier failed compile left Hardhat's cache
// inconsistent), then runs slither with --hardhat-ignore-compile (it reads
// those artifacts instead of re-compiling through `hardhat clean --global`,
// which wipes the shared compiler cache and races any other compile on the
// machine) writing its JSON report to a FRESH temp path — so no report from
// an earlier run can ever satisfy this one (R1 finding, PR #105) — with
// slither's console output in slither.log; then decides the exit code:
//   1. compile and slither must have run and slither must have succeeded (a
//      compile error is a failure, never a silent pass; slither.log's tail
//      is printed);
//   2. every High/Medium finding must be triaged in slither-triage.json — a new
//      one fails with its location and description;
//   3. every triage entry must still match a current High/Medium finding by id
//      AND its machine-derivable metadata (check, impact, confidence,
//      function, where, expression) must equal what the finding says now — so
//      an entry cannot describe one thing while hiding another, and a stale
//      entry (the code moved or was fixed) fails and must be removed or
//      re-triaged; the database can only shrink or be consciously refreshed;
//   4. every entry carries the reviewer-facing fields (triaged date, reason
//      citing SECURITY_FINDINGS.md) and ids are unique;
//   5. slither.config.json must set show_ignored_findings (inline
//      slither-disable comments cannot hide a finding) and the report must
//      not be empty (this tree always yields Low findings).
// Low/Informational/Optimization findings are reported for information only.
// Without --run the script only checks an existing report (SLITHER_REPORT),
// which is how scripts/check-slither.test.mjs drives it (`npm run test:gate`).
import { readFileSync, existsSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RUN = process.argv.includes("--run");
const CONFIG = process.env.SLITHER_CONFIG ?? "slither.config.json";
const DB = process.env.SLITHER_TRIAGE ?? "slither-triage.json";
const LOG = process.env.SLITHER_LOG ?? "slither.log";
// Test hooks only: override the two commands the --run path spawns.
const COMPILE_CMD = process.env.SLITHER_COMPILE_CMD ?? "npx hardhat compile --force";
const SLITHER_CMD = process.env.SLITHER_CMD ?? "slither";
let REPORT = process.env.SLITHER_REPORT ?? "slither-report.json";
let tmp = null;
if (RUN) {
  tmp = mkdtempSync(join(tmpdir(), "slither-gate-"));
  REPORT = join(tmp, "report.json");
}
process.on("exit", () => { if (tmp) rmSync(tmp, { recursive: true, force: true }); });
const GATED = new Set(["High", "Medium"]);
const DERIVED = ["check", "slither_impact", "slither_confidence", "function", "where", "expression"];
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
  const fn = f.elements.find((e) => e.type === "function")?.name
    ?? last?.type_specific_fields?.parent?.name
    ?? null;
  return {
    check: f.check,
    slither_impact: f.impact,
    slither_confidence: f.confidence,
    function: fn,
    where,
    expression: (last?.name ?? "").trim().replace(/\n/g, " ").slice(0, 120),
  };
}

// Slither honours `// slither-disable-next-line <check>` (and -start/-end
// ranges, and an auto-loaded slither.db.json) BEFORE writing the report. With
// show_ignored_findings those suppressed findings are still written, so an
// inline comment cannot hide a finding from this gate (R2 finding, PR #105).
// The gate refuses to run against a config without it.
if (!existsSync(CONFIG)) fail(`${CONFIG} missing`);
const config = JSON.parse(readFileSync(CONFIG, "utf8"));
if (config.show_ignored_findings !== true) fail(`${CONFIG} must set "show_ignored_findings": true — otherwise an inline slither-disable comment hides a finding from this gate`);

if (RUN) {
  const log = openSync(LOG, "w");
  const sh = (cmd) => spawnSync("sh", ["-c", cmd], { stdio: ["ignore", log, log] });
  const compile = sh(COMPILE_CMD);
  if (compile.status !== 0) fail(`compile failed (${COMPILE_CMD} exited ${compile.status ?? compile.signal})`);
  // slither exits non-zero whenever findings reach fail_on — the report is
  // still written; the checks below decide, not slither's exit code.
  const run = sh(`${SLITHER_CMD} . --hardhat-ignore-compile --config-file ${CONFIG} --json ${REPORT}`);
  if (run.error) fail(`could not start slither: ${run.error.message}`);
}

if (!existsSync(REPORT)) fail(`${REPORT} missing — slither did not run`);
const report = JSON.parse(readFileSync(REPORT, "utf8"));
if (!report.success) fail(`slither failed: ${report.error ?? "unknown error"}`);

const db = JSON.parse(readFileSync(DB, "utf8"));
const findings = report.results?.detectors ?? [];
// This tree always yields Low/Informational findings; zero means slither
// analyzed nothing (wrong sources path, no contracts) — never a pass.
if (findings.length === 0) fail("zero findings in the report — slither analyzed nothing");
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
