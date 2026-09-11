#!/usr/bin/env node
// Lint-exception gate (guardrail-complete, 2026-09-11): every eslint-disable
// comment in the app tree must be time-bounded and machine-visible. A comment
// must carry `expires YYYY-MM-DD`; an expired exception fails the build, as
// does one with no expiry. Run by `npm run lint` locally and in CI. Set
// LINT_EXCEPTIONS_TODAY=YYYY-MM-DD to test the expiry path.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components", "hooks", "lib", "i18n", "content", "middleware.ts"];
const exts = /\.(ts|tsx|js|jsx|mjs)$/;
const today = process.env.LINT_EXCEPTIONS_TODAY ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`check-lint-exceptions: invalid LINT_EXCEPTIONS_TODAY "${today}"`);
  process.exit(2);
}

function* files(path) {
  const st = statSync(path);
  if (st.isFile()) {
    if (exts.test(path)) yield path;
    return;
  }
  for (const name of readdirSync(path)) yield* files(join(path, name));
}

const problems = [];
let count = 0;
for (const root of roots) {
  for (const file of files(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!/eslint-disable/.test(line)) return;
      count += 1;
      const where = `${file}:${i + 1}`;
      const m = line.match(/expires (\d{4}-\d{2}-\d{2})/);
      if (!m) problems.push(`${where}: eslint-disable without "expires YYYY-MM-DD"`);
      else if (m[1] < today) problems.push(`${where}: exception expired ${m[1]} (today ${today}) — fix the code or re-approve with a new date in review`);
    });
  }
}

if (problems.length) {
  for (const p of problems) console.error(`ERROR: ${p}`);
  process.exit(1);
}
console.log(`check-lint-exceptions: OK — ${count} time-bounded exception(s), none expired (today ${today})`);
