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
// Two things ESLint's suppression records cannot see are checked lexically on
// the same set of linted files: inline CONFIG comments (a block comment
// starting with `eslint <rule>: <setting>` reconfigures the rule, so nothing
// is ever reported or suppressed — R2 finding on PR #97), which are forbidden
// outright; and an expiry more than
// HORIZON_DAYS ahead, which would make "time-bounded" meaningless.
//
// Env: LINT_EXCEPTIONS_TODAY=YYYY-MM-DD overrides "today";
//      LINT_EXCEPTIONS_ROOT=<dir> overrides the lint root (tests).
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const HORIZON_DAYS = 180;
// ESLint honours inline configuration only in block comments that start with
// `eslint` followed by whitespace (not `eslint-disable…`, `eslint-env`, etc.).
const inlineConfig = /\/\*\s*eslint\s(?!-)/;

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
const horizon = today + HORIZON_DAYS * 86400000;
for (const result of results) {
  readFileSync(result.filePath, "utf8").split("\n").forEach((line, i) => {
    if (inlineConfig.test(line)) {
      problems.push(`${relative(root, result.filePath)}:${i + 1}: inline ESLint config comment (block comment starting with "eslint <rule>:") is not allowed — rules are configured in eslint.config.mjs; use a dated eslint-disable for known debt`);
    }
  });
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
      else if (exp > horizon) problems.push(`${where}: "expires ${m[1]}" is more than ${HORIZON_DAYS} days out (today ${todayRaw}) — exceptions are short-lived debt, not permanent policy`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`ERROR: ${p}`);
  process.exit(1);
}
console.log(`check-lint-exceptions: OK — ${seen.size} time-bounded exception(s) across ${results.length} linted files, none expired (today ${todayRaw})`);
