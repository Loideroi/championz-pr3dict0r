#!/usr/bin/env node
// Lint-exception gate (guardrail-complete, 2026-09-11): every ESLint
// suppression that actually applies must be time-bounded and machine-visible.
// A directive's justification (the text after `--`) must contain
// `expires YYYY-MM-DD` with a real calendar date; expired or undated fails
// the build. Run by `npm run lint` locally and in CI.
//
// Discovery is ESLint's own, not a regex: the script lints the same tree with
// the same eslint.config.mjs and reads each result's `suppressedMessages`
// (ESLint ≥ 8.8), so scope (ignores, extensions) and directive recognition
// (line/next-line/block/file-level, strings, prose) are exactly ESLint's.
// A directive that suppresses nothing never appears here — that case is
// already an error via linterOptions.reportUnusedDisableDirectives.
//
// Env: LINT_EXCEPTIONS_TODAY=YYYY-MM-DD overrides "today";
//      LINT_EXCEPTIONS_ROOT=<dir> overrides the lint root (tests).
import { ESLint } from "eslint";
import { relative } from "node:path";

const root = process.env.LINT_EXCEPTIONS_ROOT ?? process.cwd();
const expires = /expires (\d{4}-\d{2}-\d{2})/;

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  const real = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  return real ? t : null;
}

const todayRaw = process.env.LINT_EXCEPTIONS_TODAY ?? new Date().toISOString().slice(0, 10);
const today = parseDate(todayRaw);
if (today === null) {
  console.error(`check-lint-exceptions: invalid LINT_EXCEPTIONS_TODAY "${todayRaw}"`);
  process.exit(2);
}

const eslint = new ESLint({ cwd: root });
const results = await eslint.lintFiles(["."]);

const problems = [];
const seen = new Set(); // one directive can suppress several messages; count it once
for (const result of results) {
  for (const msg of result.suppressedMessages) {
    for (const sup of msg.suppressions) {
      if (sup.kind !== "directive") continue;
      const where = `${relative(root, result.filePath)}:${msg.line}`;
      const key = `${where}:${sup.justification}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const m = expires.exec(sup.justification ?? "");
      if (!m) {
        problems.push(`${where}: eslint-disable (${msg.ruleId}) without "-- … expires YYYY-MM-DD"`);
        continue;
      }
      const exp = parseDate(m[1]);
      if (exp === null) problems.push(`${where}: "expires ${m[1]}" is not a real calendar date`);
      else if (exp < today) problems.push(`${where}: exception (${msg.ruleId}) expired ${m[1]} (today ${todayRaw}) — fix the code or re-approve with a new date in review`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`ERROR: ${p}`);
  process.exit(1);
}
console.log(`check-lint-exceptions: OK — ${seen.size} time-bounded exception(s) across ${results.length} linted files, none expired (today ${todayRaw})`);
