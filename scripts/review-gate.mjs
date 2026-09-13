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
//      excluding the three lockfiles and paths carrying the `linguist-generated`
//      git attribute as declared in the BASE tree's .gitattributes (a PR cannot
//      mark its own files generated; marks apply from the next PR on, after
//      review), must not exceed 500 — unless the PR carries
//      the `size-waiver` label, which stands for the contract's recorded human
//      waiver (the log entry must name it). Tier 3 above 300 is a warning only
//      (the contract's aim, not its cap).
//   3. A same-PR review-log entry: the head tree's docs/REVIEW_LOG.md must
//      hold an entry whose `## ` heading is about "#<PR number>", dated on or
//      after the judge cutoff and not an exempt-shaped heading (so the field
//      lint cannot be sidestepped by a backdated or "OWNER WAIVER" heading);
//      the base tree must not hold one; every base heading must survive and
//      every base entry body may only be appended to (re-check outcomes), never
//      edited. The entry's fields are then checked here with the judge's own
//      checkEntry, and its highest "Tier N" must equal the declared tier (a
//      reviewer's raise means the PR body is updated, not ignored).
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
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { splitEntries, checkEntry } from "./lint-review-log.mjs";

export const LINE_CAP = 500;
export const TIER3_AIM = 300;
export const WAIVER_LABEL = "size-waiver";
export const LOG_PATH = "docs/REVIEW_LOG.md";
// The three real lockfiles only — a basename match anywhere let lib/x/package-lock.json hide lines.
const LOCKFILE_RE = /^(contracts\/|relayer\/)?package-lock\.json$/;
// Same cutoff and exempt shapes as scripts/lint-review-log.mjs (not exported there;
// keep in step when re-copying the judge — the workflow passes the same --since).
export const LOG_CUTOFF = "2026-09-12";
const EXEMPT_HEADING_RE = /\b(ESCAPE AUDIT|OWNER WAIVER|EXCEPTION RECORD)\b/i;
const HEADING_DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/;

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

// Extensions that are always text: git reporting one of these as binary means
// a NUL byte was planted (git's heuristic), which would hide the file from the
// cap AND from GitHub's diff view ("Binary file not shown"). Refuse, never skip.
const TEXT_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|sql|sol|yml|yaml|css|scss|html|svg|toml|txt|sh|env|example|lock|csv|xml|graphql|prisma|py|rb|go|rs)$/i;
// Real binary types that may legitimately be skipped.
const BINARY_EXT_RE = /\.(png|jpe?g|gif|webp|avif|ico|icns|bmp|woff2?|ttf|otf|eot|pdf|wasm|zip|gz|tgz|mp[34]|webm|ogg|wav|mov)$/i;

// numstat: "<added>\t<deleted>\t<path>" per line; binary files show "-\t-".
// Returns { counted, skipped, refused }: refused names text-typed paths git
// called binary — the caller fails the gate on any of them.
export function countChangedLines(numstat, isGenerated) {
  let counted = 0;
  const skipped = [];
  const refused = [];
  for (const line of numstat.split("\n")) {
    if (!line.trim()) continue;
    const [a, d, ...rest] = line.split("\t");
    const path = destPath(rest.join("\t"));
    if (a === "-" || d === "-") {
      if (TEXT_EXT_RE.test(path) || !BINARY_EXT_RE.test(path)) {
        refused.push(path);
      } else {
        skipped.push(`${path} (binary)`);
      }
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
  return { counted, skipped, refused };
}

// The PR numbers an entry heading is ABOUT — the heading grammar is
//   ## YYYY-MM-DD — PR #N <title>            or
//   ## YYYY-MM-DD — PRs #N, #M and #K <title>
// i.e. the subject is the run of "#N" tokens immediately after "PR"/"PRs",
// joined only by commas, "and", "&", "/", or en/em dashes. Parsing stops at
// the first word that is not such a token, so "PR #100 follow-up to #999" and
// "PR #100 (follow-up to #999)" are both about #100 only, while
// "PRs #94 and #95 (x)" is about both. (A range "#85–#87" yields its two
// endpoints; list every number instead when the middle ones matter.)
export function headingPrIds(heading) {
  const m = heading.match(/\bPRs?\s+((?:#\d+(?!\d)(?:\s*(?:,|and|&|\/|–|—|-)\s*)?)+)/i);
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/#(\d+)(?!\d)/g)].map((x) => Number(x[1])));
}

// The PR's own entry in a log: an entry whose heading is about "#<PR>".
export function prEntry(logText, prNumber) {
  return splitEntries(logText).find((e) => headingPrIds(e.heading).has(prNumber)) ?? null;
}

// A real calendar date (Date.parse normalises 2026-02-30 to March 2).
export function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// The entry's tier, read from LABELED forms only — "**Tier.** N", "Tier: N",
// "(Tier N)" in the heading, or "raised to Tier N" — never from prose such as
// "no Tier 3 paths were touched". Highest labeled value wins (a reviewer's
// raise beats the author's declaration).
export function entryTier(entry) {
  const text = `${entry.heading}\n${entry.body}`;
  const re = /(?:\*\*Tier\.?\*\*\s*|\bTier\s*[.:]\s*\**\s*|\(\s*Tier\s+|\braised\s+to\s+Tier\s+)([123])\b/gi;
  const tiers = [...text.matchAll(re)].map((m) => Number(m[1]));
  return tiers.length ? Math.max(...tiers) : null;
}

// The entry must be NEW in this PR, dated on/after the cutoff, not exempt-shaped,
// and the log append-only: no entry about the PR in the base tree, one in the
// head tree, every base heading still present, every base body only appended
// to. Then the judge's own field check runs on that entry.
export function logEntryIsNew(baseLog, headLog, prNumber, cutoff = LOG_CUTOFF) {
  if (prEntry(baseLog, prNumber)) return { ok: false, reason: `an entry about #${prNumber} already existed before this PR` };
  const entry = prEntry(headLog, prNumber);
  if (!entry) return { ok: false, reason: `no "## ..." entry about #${prNumber} in the head tree` };
  const date = entry.heading.match(HEADING_DATE_RE)?.[1];
  if (!date || !isRealDate(date)) return { ok: false, reason: `entry "${entry.heading.slice(0, 50)}" has no real YYYY-MM-DD date in its heading` };
  if (date < cutoff) return { ok: false, reason: `entry "${entry.heading.slice(0, 50)}" is dated before the ${cutoff} judge cutoff — a backdated heading does not count` };
  if (EXEMPT_HEADING_RE.test(entry.heading)) return { ok: false, reason: `entry "${entry.heading.slice(0, 50)}" uses an exempt heading shape (escape audit / owner waiver / exception record) — a PR's own entry may not` };
  const headByHeading = new Map(splitEntries(headLog).map((e) => [e.heading, e.body]));
  const lost = [];
  const edited = [];
  for (const b of splitEntries(baseLog)) {
    if (!headByHeading.has(b.heading)) lost.push(b.heading);
    else if (!headByHeading.get(b.heading).trimEnd().startsWith(b.body.trimEnd())) edited.push(b.heading);
  }
  if (lost.length) return { ok: false, reason: `existing heading(s) changed or removed — the log is append-only: ${lost.map((h) => `"${h.slice(0, 50)}"`).join(", ")}` };
  if (edited.length) return { ok: false, reason: `existing entry body edited (only appending, e.g. a re-check outcome, is allowed): ${edited.map((h) => `"${h.slice(0, 50)}"`).join(", ")}` };
  const problems = checkEntry(entry, cutoff);
  if (problems.length) return { ok: false, reason: `entry fields incomplete — ${problems.join("; ")}` };
  return { ok: true, entry };
}

// "Size waiver:" / "**Size waiver.**" field = the recorded human waiver. It
// must be an affirmative owner decision: the word "owner", an affirmative
// decision word (approved / waived / granted / go), no negative or pending
// word anywhere in the field (rejected, denied, declined, pending, "not
// approved"...), a real YYYY-MM-DD date, and >= 20 characters of rationale.
// "Size waiver: 2026-09-12", "Size waiver: none", and "owner rejected ..."
// are not waivers. The gate checks the record's shape, not its truth.
const WAIVER_YES = /\b(approved|approves|waived|waives|granted|grants|go)\b/i;
const WAIVER_NO = /\b(not|no|never|un)[\s-]*(approved|waived|granted|authori[sz]ed)\b|\b(rejected|rejects|denied|denies|declined|declines|pending|refused|refuses|withheld|awaiting|tbd|todo)\b/i;
export function hasSizeWaiver(entry) {
  if (!entry) return false;
  const m = entry.body.match(/(^|\n)\s*(?:[-*]\s*)?\**Size waiver\**\s*[.:]\**\s*([^\n]*)/i);
  if (!m) return false;
  const text = m[2];
  const dates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((x) => x[1]);
  if (!dates.some(isRealDate)) return false;
  if (!/\bowner\b/i.test(text)) return false;
  if (WAIVER_NO.test(text)) return false;
  if (!WAIVER_YES.test(text)) return false;
  const rationale = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "").replace(/\bowner\b/gi, "").replace(WAIVER_YES, "").replace(/[^A-Za-z0-9]+/g, " ").trim();
  return rationale.length >= 20;
}

function git(args, input) {
  const r = spawnSync("git", args, { encoding: "utf8", input });
  if (r.status !== 0) {
    console.error(`review-gate: git ${args.join(" ")} failed: ${r.stderr.trim()}`);
    process.exit(2);
  }
  return r.stdout;
}

// Attributes are read from the BASE tree (git >= 2.40 --source), never from the
// PR's own checkout, so a PR cannot mark its files generated to dodge the cap.
function generatedSet(paths, baseSha) {
  if (paths.length === 0) return new Set();
  const out = git(["check-attr", `--source=${baseSha}`, "--stdin", "linguist-generated"], `${paths.join("\n")}\n`);
  const set = new Set();
  for (const line of out.split("\n")) {
    const m = line.match(/^(.*): linguist-generated: (.*)$/);
    if (m && (m[2] === "set" || m[2] === "true")) set.add(m[1]);
  }
  return set;
}

function runSelfTest() {
  const failures = [];
  let cases = 0;
  const check = (name, actual, expected) => {
    cases += 1;
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
  check("nothing refused in the clean case", r.refused, []);
  check("text-typed file reported binary is refused (.ts)", countChangedLines("-\t-\tlib/r2-nul.ts", isGen).refused, ["lib/r2-nul.ts"]);
  check("text-typed file reported binary is refused (.sql)", countChangedLines("-\t-\tsupabase/migrations/x.sql", isGen).refused, ["supabase/migrations/x.sql"]);
  check("unknown extension reported binary is refused too (fail closed)", countChangedLines("-\t-\tlib/blob.dat", isGen).refused, ["lib/blob.dat"]);
  check("real binary type is skipped, not refused", countChangedLines("-\t-\tpublic/font.woff2", isGen).refused, []);
  check("generated path reported binary is still refused when text-typed", countChangedLines("-\t-\tpublic/insights/en.json", isGen).refused, ["public/insights/en.json"]);
  check("braced rename resolves to destination", destPath("lib/{old => new}/util.ts"), "lib/new/util.ts");
  check("bare rename resolves to destination", destPath("old.md => new.md"), "new.md");
  check("plain path untouched", destPath("app/page.tsx"), "app/page.tsx");
  check("empty numstat counts zero", countChangedLines("", isGen).counted, 0);
  // 3. log entry
  const FULL = "\n\n**Tier.** 2. Author `claude-opus-5`; R1 `gpt-5.6-sol`; R2 `claude-opus-5`.\n**Verdicts.** R1 pass; R2 pass. Tally: 0 Blocker / 0 Major / 0 Minor / 0 Nit.\n**Checked.** ran the suite, read every file, reuse search done.\n**verification-gap:** every change has a failing-capable test.\n**named-set:** the status enum is fully handled.\n**Dismissed.** none.\n**Missing.** looked for a rollback path; none needed.\n";
  const baseLog = "# Review Log\n\n## 2026-09-10 — PR #91 (other)\n\nbody\n";
  const appended = baseLog + "\n## 2026-09-12 — PR #85 (thing)" + FULL + "body mentions #86\n";
  check("appended complete entry about #85 is new", logEntryIsNew(baseLog, appended, 85).ok, true);
  check("#85 does not satisfy #8", logEntryIsNew(baseLog, appended, 8).ok, false);
  check("#85 does not satisfy #850", logEntryIsNew(baseLog, appended, 850).ok, false);
  check("number in prose only does not count", logEntryIsNew(baseLog, appended, 86).ok, false);
  check("entry already in base is not new", logEntryIsNew(baseLog, appended, 91).ok, false);
  check("old heading renamed to add the number fails (append-only)", logEntryIsNew(baseLog, baseLog.replace("PR #91 (other)", "PR #91 (other) and #97"), 97).ok, false);
  check("old heading removed fails even with a new entry", logEntryIsNew(baseLog, "# Review Log\n\n## 2026-09-12 — PR #85 (thing)" + FULL, 85).ok, false);
  check("old entry body edited fails", logEntryIsNew(baseLog, appended.replace("\nbody\n", "\nrewritten\n"), 85).ok, false);
  check("old entry body appended to (re-check outcome) passes", logEntryIsNew(baseLog, appended.replace("(other)\n\nbody\n", "(other)\n\nbody\nRe-check 2026-09-12: resolved.\n"), 85).ok, true);
  check("new entry inserted above old ones (newest-first log) passes", logEntryIsNew(baseLog, "# Review Log\n\n## 2026-09-12 — PR #85 (thing)" + FULL + baseLog.slice("# Review Log\n".length), 85).ok, true);
  check("empty base log, new complete entry passes", logEntryIsNew("", "## 2026-09-12 — PR #1 (first)" + FULL, 1).ok, true);
  check("backdated heading (before cutoff) fails", logEntryIsNew(baseLog, baseLog + "\n## 2026-09-01 — PR #85 (thing)" + FULL, 85).ok, false);
  check("OWNER WAIVER heading shape fails", logEntryIsNew(baseLog, baseLog + "\n## 2026-09-12 — PR #85 OWNER WAIVER" + FULL, 85).ok, false);
  check("ESCAPE AUDIT heading shape fails", logEntryIsNew(baseLog, baseLog + "\n## 2026-09-12 — ESCAPE AUDIT #2 PR #85" + FULL, 85).ok, false);
  check("impossible heading date fails", logEntryIsNew(baseLog, baseLog + "\n## 2026-02-30 — PR #85 (thing)" + FULL, 85).ok, false);
  check("new entry with no fields fails the judge's field check", logEntryIsNew(baseLog, baseLog + "\n## 2026-09-12 — PR #85 (thing)\n\nno fields at all\n", 85).ok, false);
  check("Tier 2 entry missing named-set fails", logEntryIsNew(baseLog, baseLog + "\n## 2026-09-12 — PR #85 (thing)" + FULL.replace("**named-set:**", "**enum:**"), 85).ok, false);
  check("entryTier: labeled bold field", entryTier({ heading: "x", body: "**Tier.** 2 — ordinary code" }), 2);
  check("entryTier: 'Tier: N' form", entryTier({ heading: "x", body: "- Tier: 1. Author x" }), 1);
  check("entryTier: heading parenthesis", entryTier({ heading: "2026-09-12 — PR #5 (Tier 3)", body: "" }), 3);
  check("entryTier: 'raised to Tier N' beats the labeled field", entryTier({ heading: "x", body: "**Tier.** 2, reviewer raised to Tier 3" }), 3);
  check("entryTier: prose mention does not count", entryTier({ heading: "x", body: "**Tier.** 2 — no Tier 3 paths were touched" }), 2);
  check("entryTier: none", entryTier({ heading: "x", body: "no tier here" }), null);
  // 4. heading subject and waiver binding
  check("subject: PR #100 (follow-up to #999) is about #100 only", [...headingPrIds("2026-09-12 — PR #100 (follow-up to #999)")], [100]);
  check("subject: PRs #94 and #95 is about both", [...headingPrIds("2026-09-10 — PRs #94 and #95 (x)")].sort(), [94, 95]);
  check("subject: no PR token means no subject", [...headingPrIds("2026-09-09 — escape audit mentions #85")], []);
  check("subject: #85 in prose after PR #88 heading excluded by parenthesis only", [...headingPrIds("PR #88 (acts on #85, #86)")], [88]);
  check("subject: unparenthesised trailing reference is not a subject", [...headingPrIds("2026-09-12 — PR #100 follow-up to #999")], [100]);
  check("subject: comma list", [...headingPrIds("PRs #85, #86, #87 (admin)")].sort(), [85, 86, 87]);
  check("subject: 'PRs #88 and #89 fix #85' stops at 'fix'", [...headingPrIds("PRs #88 and #89 fix #85")].sort(), [88, 89]);
  check("subject: en-dash range gives its endpoints", [...headingPrIds("PRs #85–#87 (x)")].sort(), [85, 87]);
  check("subject: 'PR' without a number", [...headingPrIds("PR template update")], []);
  const log = "# Review Log\n\n## 2026-09-12 — PR #12 (big)\n\n**Tier.** 2\n**Size waiver.** owner go 2026-09-12: 640 lines, generated-fixture-heavy, split judged riskier.\n\n## 2026-09-10 — PR #91 (other)\n\nSize waiver: none\n\n## 2026-09-12 — PR #100 (follow-up to #999)\n\nbody\n";
  check("prEntry finds the heading about #12", prEntry(log, 12)?.heading, "2026-09-12 — PR #12 (big)");
  check("prEntry ignores #1 vs #12", prEntry(log, 1), null);
  check("prEntry returns null when absent", prEntry(log, 99), null);
  check("prEntry: a reference inside another heading's parentheses is not that PR's entry", prEntry(log, 999), null);
  check("substantive dated owner waiver passes", hasSizeWaiver(prEntry(log, 12)), true);
  check("'Size waiver: none' fails", hasSizeWaiver(prEntry(log, 91)), false);
  check("missing entry fails", hasSizeWaiver(null), false);
  const w = (t) => hasSizeWaiver({ heading: "x", body: `**Tier.** 2\n${t}\n` });
  check("date-only waiver fails", w("Size waiver: 2026-09-12"), false);
  check("impossible date fails", w("Size waiver: owner go 2026-99-99, generated fixtures dominate the diff"), false);
  check("no owner attribution fails", w("Size waiver: go 2026-09-12, generated fixtures dominate the diff"), false);
  check("owner + real date + rationale passes", w("Size waiver: owner go 2026-09-12 — generated fixtures dominate the diff"), true);
  check("owner + date but no rationale fails", w("Size waiver: owner 2026-09-12"), false);
  check("owner rejected fails", w("Size waiver: owner rejected 2026-09-12 because this oversized change must be split"), false);
  check("owner approval pending fails", w("Size waiver: owner approval pending 2026-09-12 because this oversized change must be split"), false);
  check("owner denied fails", w("Size waiver: owner denied 2026-09-12: generated fixtures dominate the diff"), false);
  check("'not approved' fails", w("Size waiver: owner has not approved 2026-09-12: generated fixtures dominate the diff"), false);
  check("owner text without a decision word fails", w("Size waiver: owner Mark 2026-09-12: generated fixtures dominate the diff"), false);
  check("owner approved passes", w("Size waiver: owner approved 2026-09-12: generated fixtures dominate the diff"), true);
  check("owner waived passes", w("**Size waiver.** owner waived the cap 2026-09-12 — split judged riskier than one review"), true);
  check("approved but awaiting second reviewer fails (pending word)", w("Size waiver: owner approved 2026-09-12, awaiting R2; generated fixtures dominate"), false);
  check("bold-label form passes", w("- **Size waiver:** owner Mark approved, 2026-09-12: 640 lines, split judged riskier than one review"), true);
  check("waiver in another entry does not carry over", hasSizeWaiver(prEntry(log + "\n## 2026-09-12 — PR #13\n\nbody\n", 13)), false);
  if (failures.length) {
    for (const f of failures) console.error(`SELF-TEST FAIL: ${f}`);
    console.error(`review-gate self-test: ${failures.length} case(s) failed`);
    process.exit(1);
  }
  console.log(`review-gate self-test passed (${cases} cases, judge proven red-capable).`);
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
  const generated = generatedSet(paths, base);
  const { counted, skipped, refused } = countChangedLines(numstat, (p) => generated.has(p));
  for (const s of skipped) console.log(`review-gate: not counted — ${s}`);
  // A deleted git-binary file cannot hide anything (it has no lines in the head tree).
  const deleted = new Set(git(["diff", "--name-only", "--diff-filter=D", base, HEAD_SHA]).split("\n").filter(Boolean));
  for (const p of refused) {
    if (deleted.has(p)) console.log(`review-gate: not counted — ${p} (binary, deleted)`);
    else failures.push(`size: ${p} is reported binary by git (a NUL byte in a text-typed file hides its lines from this cap and from GitHub's diff) — remove the byte or the file`);
  }
  console.log(`review-gate: ${counted} changed lines counted (cap ${LINE_CAP})`);
  // 3. same-PR log entry: new in this PR, log append-only
  const showLog = (sha) => {
    const r = spawnSync("git", ["show", `${sha}:${LOG_PATH}`], { encoding: "utf8" });
    if (r.status === 0) return r.stdout;
    if (/does not exist in|exists on disk, but not in/.test(r.stderr)) return ""; // absent file = empty log
    console.error(`review-gate: git show ${sha}:${LOG_PATH} failed: ${r.stderr.trim()} (shallow fetch? the workflow needs fetch-depth: 0)`);
    process.exit(2);
  };
  const logCheck = logEntryIsNew(showLog(base), showLog(HEAD_SHA), prNumber);
  const entry = logCheck.ok ? logCheck.entry : null;
  if (!logCheck.ok) {
    failures.push(`log: ${logCheck.reason} (append this PR's own review-log entry to ${LOG_PATH} before asking for the merge)`);
  } else {
    console.log(`review-gate: ${LOG_PATH} entry "${entry.heading.slice(0, 60)}" added for #${prNumber}`);
    const logged = entryTier(entry);
    if (tier !== null && logged !== null && logged !== tier) {
      failures.push(`tier: PR body declares Tier ${tier} but the review-log entry's highest tier is ${logged} — the floor/reviewer raise wins; update the "Declared tier" line to ${logged}`);
    }
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

// Run only when executed directly (importing the module for its functions runs nothing).
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (!isMainModule()) {
  // imported as a module
} else if (process.argv.includes("--self-test")) runSelfTest();
else main();
