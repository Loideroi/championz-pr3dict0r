#!/usr/bin/env node
// Lint-exception gate (guardrail-complete, 2026-09-11): every ESLint
// suppression that applies must be time-bounded and machine-visible — its
// justification (after `--`) must say `expires YYYY-MM-DD`, a real date, not
// past, not more than HORIZON_DAYS ahead. Run by `npm run lint` locally and in CI.
//
// Discovery is ESLint's own, never a regex over source text:
//  1. A normal lint pass with the repo's eslint.config.mjs; each result's
//     `suppressedMessages[].suppressions[]` (ESLint ≥ 8.8) gives every applied
//     `eslint-disable*` directive with its parsed justification. A directive
//     that suppresses nothing is already an error via
//     linterOptions.reportUnusedDisableDirectives.
//  2. A second pass with `linterOptions.noInlineConfig: true`, on which ESLint's
//     parser reports every inline directive comment it recognizes ("… has no
//     effect because you have 'noInlineConfig'"). Any that is not an
//     eslint-disable/enable directive — `eslint rule: setting`, `global`,
//     `globals`, `exported`, `eslint-env` — reconfigures a rule invisibly
//     (R2 finding on PR #97) and fails the build. Multiline comments, comments
//     after code and string literals are handled by the parser.
//
// Env: LINT_EXCEPTIONS_TODAY=YYYY-MM-DD overrides "today" (UTC);
//      LINT_EXCEPTIONS_ROOT=<dir> overrides the lint root (tests).
import { ESLint } from "eslint";
import { relative } from "node:path";

const HORIZON_DAYS = 180;
const noEffect = /^'([\s\S]*)' has no effect because you have 'noInlineConfig'/;
const disableDirective = /^(?:\/\/|\/\*)\s*eslint-(?:disable|enable)(?:-next-line|-line)?(?![\w-])/;

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
const strict = new ESLint({ cwd: root, overrideConfig: { linterOptions: { noInlineConfig: true } } });
const strictResults = await strict.lintFiles(["."]);

const problems = [];
const seen = new Set(); // one directive can suppress several messages; count it once
const horizon = today + HORIZON_DAYS * 86400000;
for (const result of strictResults) {
  for (const msg of result.messages) {
    if (msg.ruleId !== null) continue;
    const m = noEffect.exec(msg.message);
    if (!m || disableDirective.test(m[1])) continue;
    const head = m[1].split("\n")[0].slice(0, 60);
    problems.push(`${relative(root, result.filePath)}:${msg.line}: inline ESLint config comment ${JSON.stringify(head)} is not allowed — rules and globals are configured in eslint.config.mjs; use a dated eslint-disable for known debt`);
  }
}
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
      else if (exp > horizon) problems.push(`${where}: "expires ${m[1]}" is more than ${HORIZON_DAYS} days out (today ${todayRaw}) — exceptions are short-lived debt, not permanent policy`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`ERROR: ${p}`);
  process.exit(1);
}
console.log(`check-lint-exceptions: OK — ${seen.size} time-bounded exception(s) across ${results.length} linted files, none expired (today ${todayRaw})`);
