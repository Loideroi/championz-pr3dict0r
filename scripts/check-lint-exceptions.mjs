#!/usr/bin/env node
// Lint-exception gate (guardrail-complete, 2026-09-11): every ESLint
// suppression directive in the linted tree must be time-bounded and
// machine-visible. A directive must carry `expires YYYY-MM-DD` (a real
// calendar date); an expired or undated directive fails the build. Run by
// `npm run lint` locally and in CI.
//
// Scope: the same files ESLint lints — the whole repo minus its ignores
// (.next, out, build, node_modules, contracts/, relayer/ — see
// eslint.config.mjs). Only directive comments count (`// eslint-disable…` or
// `/* eslint-disable… */` at the start of a comment), so prose that merely
// mentions the word does not trip it, nor does a directive inside a string.
//
// Env: LINT_EXCEPTIONS_TODAY=YYYY-MM-DD overrides "today";
//      LINT_EXCEPTIONS_ROOT=<dir> overrides the scan root (tests).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.env.LINT_EXCEPTIONS_ROOT ?? process.cwd();
const skipDirs = new Set([".git", ".next", "out", "build", "node_modules", "contracts", "relayer"]);
const exts = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
// The opener must start the line or follow whitespace/`;`/`)` — never a quote —
// so a directive spelled inside a string literal (as in the checker's own
// tests) is not counted.
const directive = /(?:^|[\s;)])(?:\/\/|\/\*)\s*eslint-disable(?:-next-line|-line)?(?=\s|\*\/|$)/;
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

function* files(path) {
  const st = statSync(path);
  if (st.isFile()) {
    if (exts.test(path)) yield path;
    return;
  }
  for (const name of readdirSync(path).sort()) {
    if (skipDirs.has(name)) continue;
    yield* files(join(path, name));
  }
}

const problems = [];
let count = 0;
for (const file of files(root)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!directive.test(line)) return;
    count += 1;
    const where = `${relative(root, file)}:${i + 1}`;
    const m = expires.exec(line);
    if (!m) {
      problems.push(`${where}: eslint-disable without "expires YYYY-MM-DD"`);
      return;
    }
    const exp = parseDate(m[1]);
    if (exp === null) problems.push(`${where}: "expires ${m[1]}" is not a real calendar date`);
    else if (exp < today) problems.push(`${where}: exception expired ${m[1]} (today ${todayRaw}) — fix the code or re-approve with a new date in review`);
  });
}

if (problems.length) {
  for (const p of problems) console.error(`ERROR: ${p}`);
  process.exit(1);
}
console.log(`check-lint-exceptions: OK — ${count} time-bounded exception(s), none expired (today ${todayRaw})`);
