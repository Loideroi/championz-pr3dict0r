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
//   3. A same-PR review-log entry: the head tree's docs/REVIEW_LOG.md must
//      hold an entry whose `## ` heading names "#<PR number>", the base tree
//      must not, and every base heading must survive verbatim (the log is
//      append-only) — so a number dropped into an old entry, into prose, or
//      onto an existing heading does not count. Field completeness of the
//      entry is scripts/lint-review-log.mjs's job (next workflow step).
//   4. When over the cap with the `size-waiver` label, the PR's own log entry
//      (the one whose heading names it, in the head tree) must carry a
//      "Size waiver:" field with a date — the recorded human waiver the
//      contract requires; the label alone never passes.
//
// Coverage boundary — what this judge cannot see: whether the reviews actually
// ran (the log entry and the monthly escape audit cover that); whether the
// declared tier matches the floor map (reviewers confirm it; the map is prose);
// whether a size-waiver label carries a genuine owner waiver; and wrong
// generated-file marks in .gitattributes (which is why that file is Tier 3);
// and whether the "Size waiver:" field names a real owner decision (the
// escape audit reads it).
//
//   env: PR_NUMBER PR_BODY PR_LABELS (comma-separated) BASE_SHA HEAD_SHA
//   node scripts/review-gate.mjs            # in CI
//   node scripts/review-gate.mjs --self-test
//
// Adopted 2026-09-11 after the 2026-09-09 escapes (docs/REVIEW_LOG.md): 26 PRs
// merged with no tier line, no review, and no log entry while CI was green.

import { spawnSync } from "node:child_process";
import { splitEntries } from "./lint-review-log.mjs";

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

// The PR's own entry in a log: heading names "#<PR>".
export function prEntry(logText, prNumber) {
  const re = new RegExp(`#${prNumber}(?!\\d)`);
  return splitEntries(logText).find((e) => re.test(e.heading)) ?? null;
}

// The entry must be NEW in this PR and the log append-only: no entry naming
// the PR in the base tree, one in the head tree, and every base heading still
// present verbatim in the head (so renaming an old heading to add the number,
// or adding the number to prose, does not count).
export function logEntryIsNew(baseLog, headLog, prNumber) {
  if (prEntry(baseLog, prNumber)) return { ok: false, reason: `an entry naming #${prNumber} already existed before this PR` };
  const entry = prEntry(headLog, prNumber);
  if (!entry) return { ok: false, reason: `no "## ..." entry naming #${prNumber} in the head tree` };
  const headHeadings = new Set(splitEntries(headLog).map((e) => e.heading));
  const lost = splitEntries(baseLog).map((e) => e.heading).filter((h) => !headHeadings.has(h));
  if (lost.length) return { ok: false, reason: `existing heading(s) changed or removed — the log is append-only: ${lost.map((h) => `"${h.slice(0, 50)}"`).join(", ")}` };
  return { ok: true, entry };
}

// "Size waiver:" / "**Size waiver.**" field carrying a YYYY-MM-DD date.
export function hasSizeWaiver(entry) {
  if (!entry) return false;
  return /(^|\n)\s*(?:[-*]\s*)?\**Size waiver\**\s*[.:][^\n]*\b\d{4}-\d{2}-\d{2}\b/i.test(entry.body);
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
  const baseLog = "# Review Log\n\n## 2026-09-10 — PR #91 (other)\n\nbody\n";
  const appended = baseLog + "\n## 2026-09-12 — PR #85 (thing)\n\nbody mentions #86\n";
  check("appended heading naming #85 is new", logEntryIsNew(baseLog, appended, 85).ok, true);
  check("#85 does not satisfy #8", logEntryIsNew(baseLog, appended, 8).ok, false);
  check("#85 does not satisfy #850", logEntryIsNew(baseLog, appended, 850).ok, false);
  check("number in prose only does not count", logEntryIsNew(baseLog, appended, 86).ok, false);
  check("entry already in base is not new", logEntryIsNew(baseLog, appended, 91).ok, false);
  check("old heading renamed to add the number fails (append-only)", logEntryIsNew(baseLog, baseLog.replace("PR #91 (other)", "PR #91 (other) and #97"), 97).ok, false);
  check("old heading removed fails even with a new entry", logEntryIsNew(baseLog, "# Review Log\n\n## 2026-09-12 — PR #85 (thing)\n\nbody\n", 85).ok, false);
  check("new entry inserted above old ones (newest-first log) passes", logEntryIsNew(baseLog, "# Review Log\n\n## 2026-09-12 — PR #85 (thing)\n\nbody\n" + baseLog.slice("# Review Log\n".length), 85).ok, true);
  check("empty base log, new entry passes", logEntryIsNew("", "## 2026-09-12 — PR #1 (first)\n\nbody\n", 1).ok, true);
  // 4. waiver binding
  const log = "# Review Log\n\n## 2026-09-12 — PR #12 (big)\n\n**Tier.** 2\n**Size waiver.** owner go 2026-09-12: 640 lines, generated-fixture-heavy, split judged riskier.\n\n## 2026-09-10 — PR #91 (other)\n\nSize waiver: none\n";
  check("prEntry finds the heading naming #12", prEntry(log, 12)?.heading, "2026-09-12 — PR #12 (big)");
  check("prEntry ignores #1 vs #12", prEntry(log, 1), null);
  check("prEntry returns null when absent", prEntry(log, 99), null);
  check("dated waiver field passes", hasSizeWaiver(prEntry(log, 12)), true);
  check("'Size waiver: none' (no date) fails", hasSizeWaiver(prEntry(log, 91)), false);
  check("missing entry fails", hasSizeWaiver(null), false);
  check("waiver in another entry does not carry over", hasSizeWaiver(prEntry(log + "\n## 2026-09-12 — PR #13\n\nbody\n", 13)), false);
  if (failures.length) {
    for (const f of failures) console.error(`SELF-TEST FAIL: ${f}`);
    console.error(`review-gate self-test: ${failures.length} case(s) failed`);
    process.exit(1);
  }
  console.log("review-gate self-test passed (33 cases, judge proven red-capable).");
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
  // 3. same-PR log entry: new in this PR, log append-only
  const showLog = (sha) => {
    const r = spawnSync("git", ["show", `${sha}:${LOG_PATH}`], { encoding: "utf8" });
    return r.status === 0 ? r.stdout : ""; // absent file = empty log
  };
  const logCheck = logEntryIsNew(showLog(base), showLog(HEAD_SHA), prNumber);
  const entry = logCheck.ok ? logCheck.entry : null;
  if (!logCheck.ok) {
    failures.push(`log: ${logCheck.reason} (append this PR's own review-log entry to ${LOG_PATH} before asking for the merge)`);
  } else {
    console.log(`review-gate: ${LOG_PATH} entry "${entry.heading.slice(0, 60)}" added for #${prNumber}`);
  }

  // 4. size cap, with the waiver bound to this PR's own entry
  if (counted > LINE_CAP) {
    if (!labels.includes(WAIVER_LABEL)) {
      failures.push(`size: ${counted} changed lines exceed the ${LINE_CAP} cap (excl. lockfiles/generated); split the PR, or label ${WAIVER_LABEL} AND record the human waiver as a dated "Size waiver:" field in this PR's log entry`);
    } else if (!hasSizeWaiver(entry)) {
      failures.push(`size: ${counted} changed lines exceed the ${LINE_CAP} cap and the ${WAIVER_LABEL} label has no dated "Size waiver:" field in this PR's ${LOG_PATH} entry — the label alone is not a waiver`);
    } else {
      console.log(`review-gate: over the cap; ${WAIVER_LABEL} label backed by the dated Size waiver field in the #${prNumber} entry`);
    }
  } else if (tier === 3 && counted > TIER3_AIM) {
    console.log(`review-gate: WARN Tier 3 aims for <=${TIER3_AIM} hand-written lines (${counted} counted)`);
  }

  if (failures.length) {
    for (const f of failures) console.error(`review-gate: FAIL ${f}`);
    process.exit(1);
  }
  console.log("review-gate: PASS");
}

if (process.argv.includes("--self-test")) runSelfTest();
else main();
