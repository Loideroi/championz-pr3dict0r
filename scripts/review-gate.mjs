#!/usr/bin/env node
// Review gate — the review contract's merge preconditions, made mechanical.
// Runs from .github/workflows/review-gate.yml on every pull_request event
// (opened / synchronize / reopened / edited / labeled / unlabeled), so a PR
// cannot reach the owner's merge click without:
//
//   1. A declared tier: the PR body carries the template line
//      "Declared tier: N" with N in 1..3 (an untouched template comment does
//      not count). Reviewers confirm or raise the tier; the floor map in
//      docs/REVIEW_TIERS.md beats the declaration.
//   2. The size cap: additions + deletions between the merge-base and the head,
//      excluding lockfiles and paths carrying the `linguist-generated` git
//      attribute (.gitattributes), must not exceed 500 — unless the PR carries
//      the `size-waiver` label, which stands for the contract's recorded human
//      waiver (the log entry must name it). Tier 3 above 300 is a warning only
//      (the contract's aim, not its cap).
//   3. A same-PR review-log entry: the diff must ADD lines to
//      docs/REVIEW_LOG.md that mention "#<PR number>". Field completeness of
//      that entry is scripts/lint-review-log.mjs's job (next workflow step).
//
// Coverage boundary — what this judge cannot see: whether the reviews actually
// ran (the log entry and the monthly escape audit cover that); whether the
// declared tier matches the floor map (reviewers confirm it; the map is prose);
// whether a size-waiver label carries a genuine owner waiver; and wrong
// generated-file marks in .gitattributes (which is why that file is Tier 3).
//
//   env: PR_NUMBER PR_BODY PR_LABELS (comma-separated) BASE_SHA HEAD_SHA
//   node scripts/review-gate.mjs            # in CI
//   node scripts/review-gate.mjs --self-test
//
// Adopted 2026-09-11 after the 2026-09-09 escapes (docs/REVIEW_LOG.md): 26 PRs
// merged with no tier line, no review, and no log entry while CI was green.

import { spawnSync } from "node:child_process";

export const LINE_CAP = 500;
export const TIER3_AIM = 300;
export const WAIVER_LABEL = "size-waiver";
export const LOG_PATH = "docs/REVIEW_LOG.md";
const LOCKFILE_RE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/;

export function declaredTier(body) {
  const m = (body ?? "").match(/Declared tier\**\s*:\s*\**\s*([123])(?!\d)/i);
  return m ? Number(m[1]) : null;
}

// numstat paths for renames look like "old => new" or "dir/{old => new}/file";
// the destination path is what carries the attribute.
export function destPath(p) {
  const braced = p.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (braced) return `${braced[1]}${braced[3]}${braced[4]}`;
  const bare = p.match(/^(.*) => (.*)$/);
  return bare ? bare[2] : p;
}

// numstat: "<added>\t<deleted>\t<path>" per line; binary files show "-\t-".
export function countChangedLines(numstat, isGenerated) {
  let counted = 0;
  const skipped = [];
  for (const line of numstat.split("\n")) {
    if (!line.trim()) continue;
    const [a, d, ...rest] = line.split("\t");
    const path = destPath(rest.join("\t"));
    if (a === "-" || d === "-") {
      skipped.push(`${path} (binary)`);
      continue;
    }
    if (LOCKFILE_RE.test(path)) {
      skipped.push(`${path} (lockfile)`);
      continue;
    }
    if (isGenerated(path)) {
      skipped.push(`${path} (linguist-generated)`);
      continue;
    }
    counted += Number(a) + Number(d);
  }
  return { counted, skipped };
}

// Only ADDED lines count: an entry for this PR must be new in this PR.
export function logEntryAdded(diffText, prNumber) {
  const re = new RegExp(`#${prNumber}(?!\\d)`);
  return diffText
    .split("\n")
    .some((line) => line.startsWith("+") && !line.startsWith("+++") && re.test(line));
}

function git(args, input) {
  const r = spawnSync("git", args, { encoding: "utf8", input });
  if (r.status !== 0) {
    console.error(`review-gate: git ${args.join(" ")} failed: ${r.stderr.trim()}`);
    process.exit(2);
  }
  return r.stdout;
}

function generatedSet(paths) {
  if (paths.length === 0) return new Set();
  const out = git(["check-attr", "--stdin", "linguist-generated"], `${paths.join("\n")}\n`);
  const set = new Set();
  for (const line of out.split("\n")) {
    const m = line.match(/^(.*): linguist-generated: (.*)$/);
    if (m && (m[2] === "set" || m[2] === "true")) set.add(m[1]);
  }
  return set;
}

function runSelfTest() {
  const failures = [];
  const check = (name, actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  };
  // 1. tier declaration
  check("untouched template comment is not a tier", declaredTier("- Declared tier: <!-- 1 | 2 | 3 -->"), null);
  check("plain tier line", declaredTier("## Tier declaration\n\n- Declared tier: 2\n"), 2);
  check("bold label", declaredTier("**Declared tier:** 3"), 3);
  check("tier with trailing comment", declaredTier("- Declared tier: 1 <!-- 1 | 2 | 3 -->"), 1);
  check("tier 4 is not a tier", declaredTier("Declared tier: 4"), null);
  check("tier 30 is not a tier", declaredTier("Declared tier: 30"), null);
  check("empty body", declaredTier(""), null);
  check("missing body", declaredTier(undefined), null);
  // 2. size counting
  const gen = new Set(["public/insights/en.json"]);
  const isGen = (p) => gen.has(p);
  const numstat = [
    "10\t5\tapp/page.tsx",
    "300\t0\tpackage-lock.json",
    "0\t0\trelayer/package-lock.json",
    "146\t0\tpublic/insights/en.json",
    "-\t-\tpublic/icon.png",
    "7\t2\tlib/{old => new}/util.ts",
    "3\t3\told.md => new.md",
  ].join("\n");
  const r = countChangedLines(numstat, isGen);
  check("counted lines exclude lockfile, generated, binary", r.counted, 10 + 5 + 7 + 2 + 3 + 3);
  check("skipped list names the reasons", r.skipped, [
    "package-lock.json (lockfile)",
    "relayer/package-lock.json (lockfile)",
    "public/insights/en.json (linguist-generated)",
    "public/icon.png (binary)",
  ]);
  check("braced rename resolves to destination", destPath("lib/{old => new}/util.ts"), "lib/new/util.ts");
  check("bare rename resolves to destination", destPath("old.md => new.md"), "new.md");
  check("plain path untouched", destPath("app/page.tsx"), "app/page.tsx");
  check("empty numstat counts zero", countChangedLines("", isGen).counted, 0);
  // 3. log entry
  const diff = "+++ b/docs/REVIEW_LOG.md\n+## 2026-09-12 — PR #85 (thing)\n-## old #86 line\n context #87\n";
  check("added line mentioning #85 counts", logEntryAdded(diff, 85), true);
  check("#85 does not satisfy #8", logEntryAdded(diff, 8), false);
  check("#85 does not satisfy #850", logEntryAdded(diff, 850), false);
  check("removed line does not count", logEntryAdded(diff, 86), false);
  check("context line does not count", logEntryAdded(diff, 87), false);
  check("file header line does not count", logEntryAdded("+++ b/docs/REVIEW_LOG.md #1\n", 1), false);
  if (failures.length) {
    for (const f of failures) console.error(`SELF-TEST FAIL: ${f}`);
    console.error(`review-gate self-test: ${failures.length} case(s) failed`);
    process.exit(1);
  }
  console.log("review-gate self-test passed (23 cases, judge proven red-capable).");
}

function main() {
  const { PR_NUMBER, PR_BODY, PR_LABELS, BASE_SHA, HEAD_SHA } = process.env;
  const prNumber = Number(PR_NUMBER);
  if (!Number.isInteger(prNumber) || prNumber <= 0 || !BASE_SHA || !HEAD_SHA) {
    console.error("review-gate: PR_NUMBER, BASE_SHA and HEAD_SHA are required (PR_BODY, PR_LABELS optional)");
    process.exit(2);
  }
  const labels = (PR_LABELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const failures = [];

  // 1. tier
  const tier = declaredTier(PR_BODY);
  if (tier === null) {
    failures.push('tier: PR body has no "Declared tier: N" line (fill the PR template; never `gh pr create --fill`)');
  } else {
    console.log(`review-gate: tier declared ${tier}`);
  }

  // 2. size
  const base = git(["merge-base", BASE_SHA, HEAD_SHA]).trim();
  const numstat = git(["diff", "--numstat", "-M", base, HEAD_SHA]);
  const paths = numstat.split("\n").filter(Boolean).map((l) => destPath(l.split("\t").slice(2).join("\t")));
  const generated = generatedSet(paths);
  const { counted, skipped } = countChangedLines(numstat, (p) => generated.has(p));
  for (const s of skipped) console.log(`review-gate: not counted — ${s}`);
  console.log(`review-gate: ${counted} changed lines counted (cap ${LINE_CAP})`);
  if (counted > LINE_CAP) {
    if (labels.includes(WAIVER_LABEL)) {
      console.log(`review-gate: over the cap but labelled ${WAIVER_LABEL} — the log entry must record the human waiver`);
    } else {
      failures.push(`size: ${counted} changed lines exceed the ${LINE_CAP} cap (excl. lockfiles/generated); split the PR, or label ${WAIVER_LABEL} with a human waiver recorded in the log entry`);
    }
  } else if (tier === 3 && counted > TIER3_AIM) {
    console.log(`review-gate: WARN Tier 3 aims for <=${TIER3_AIM} hand-written lines (${counted} counted)`);
  }

  // 3. same-PR log entry
  const logDiff = git(["diff", base, HEAD_SHA, "--", LOG_PATH]);
  if (!logEntryAdded(logDiff, prNumber)) {
    failures.push(`log: ${LOG_PATH} gains no entry mentioning #${prNumber} in this PR (append this PR's review-log entry before asking for the merge)`);
  } else {
    console.log(`review-gate: ${LOG_PATH} entry for #${prNumber} present`);
  }

  if (failures.length) {
    for (const f of failures) console.error(`review-gate: FAIL ${f}`);
    process.exit(1);
  }
  console.log("review-gate: PASS");
}

if (process.argv.includes("--self-test")) runSelfTest();
else main();
