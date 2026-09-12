#!/usr/bin/env node
// Review-log judge: every review entry dated on or after the cutoff must carry
// the fields the multi-agent code review contract requires, so a rubber-stamp
// entry fails CI instead of passing on prose. Portable: point it at this
// repo's logs/review-log.md or a project repo's docs/REVIEW_LOG.md.
//
//   node tools/lint-review-log.mjs [path] [--since YYYY-MM-DD] [--self-test]
//
// Required per entry (heading `## ...YYYY-MM-DD...`):
//   - a tier (Tier 1|2|3)
//   - at least one exact model id (gpt-*, claude-*, gemini-*, o-series)
//   - a verdict (pass | pass-with-minors | fail)
//   - a findings tally ("Tally:", "N Blocker", or a "| Sev |" table)
//   - a "Checked:" field with content (the explicit list of what was verified)
//   - a "Dismissed:" field with content: "none", or every dismissed/rebutted
//     finding with its reason — dismissals are never silent
// Field values must be non-empty text on the field's line (or the lines that
// follow it up to the next field or blank line); an empty label fails.
// Tier 2 and 3 additionally require, anywhere in the entry:
//   - the token `verification-gap` (the reviewer asked "if this behavior broke,
//     would any test fail?" and reported untested behavior changes)
//   - the token `named-set` (the reviewer checked diffs that special-case some
//     members of a fixed set — enum, status code, sentinel, flag — and leave
//     the rest silent)
//   - a "Missing:" field with content (what the reviewer looked for and did not
//     find; the "what is missing" question, which measurably beats persona framing)
// A tally must carry numbers: "Tally: N Blocker / N Major / N Minor / N Nit"
// (all four counts) or a findings table with a "Sev" header and at least its
// separator row. Headings must carry a real calendar date.
// Rationale and evidence: wiki/agent-ops/bmad-method-assessment.md (borrowed
// from BMAD v6.11's review evidence, 2026-09-11) and the review contract.
// Entries dated before the cutoff are skipped: the fields were not required
// when they were written, and history is not rewritten to satisfy a judge.
// Exempt shapes (contract-defined records that are not reviews): headings that
// carry `ESCAPE AUDIT`, `OWNER WAIVER`, or `EXCEPTION RECORD` are skipped.
// The Tier 2/3 questions are labeled fields with content ("verification-gap:"
// and "named-set:"), not bare words; the verdict must be labeled ("Verdict:")
// or bold; the tier is the highest one mentioned (highest-tier-wins).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PATH = 'logs/review-log.md'
const DEFAULT_SINCE = '2026-09-12'
const DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/
const EXEMPT_HEADING_RE = /\b(ESCAPE AUDIT|OWNER WAIVER|EXCEPTION RECORD)\b/i
// Roster-shaped model ids: claude-<name>-<n>, gpt-<n>..., gemini-<n>..., o<n>[-suffix].
const MODEL_ID_RE = /\b(claude-[a-z]+-\d[\w.-]*|gpt-\d[\w.-]*|gemini-\d[\w.-]*|o[1-9](?:-[a-z0-9]+)*)\b/i
const VERDICT_RE = /(Verdicts?\s*[.:]\**[^\n]*\b(pass-with-minors|pass|fail)\b|\*\*(pass-with-minors|pass|fail)\b)/i

const args = process.argv.slice(2)
const selfTest = args.includes('--self-test')
const sinceIndex = args.indexOf('--since')
const since = sinceIndex === -1 ? DEFAULT_SINCE : args[sinceIndex + 1]
const positional = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--since')
const target = positional[0] || DEFAULT_PATH

if (!/^\d{4}-\d{2}-\d{2}$/.test(since || '') || !isRealDate(since)) {
  console.error(`--since must be a real YYYY-MM-DD date (got "${since}")`)
  process.exit(2)
}

const MIN_FIELD_CHARS = 3

const FIELD_LABEL_RE = /^\s*(?:[-*]\s*)?\**[A-Za-z][A-Za-z -]{1,30}\**\s*[.:]/

function fieldValue(text, name) {
  // Matches "Checked:", "- Checked:", "**Checked:**", "**Checked.**" at a line start
  // and returns the text after the label plus continuation lines, stopping at the
  // first blank line or the next field label (so unrelated prose after a blank
  // line never counts as the field's content).
  const lines = text.split('\n')
  const labelRe = new RegExp(`^\\s*(?:[-*]\\s*)?\\**${name}\\**\\s*[.:]\\**[ \\t]*(.*)$`, 'i')
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(labelRe)
    if (!m) continue
    const parts = [m[1]]
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j]
      if (!next.trim()) break
      if (FIELD_LABEL_RE.test(next)) break
      parts.push(next)
    }
    return parts.join('\n').replace(/\*\*/g, '').trim()
  }
  return null
}

function hasField(text, name) {
  const value = fieldValue(text, name)
  return value !== null && value.replace(/[^A-Za-z0-9]/g, '').length >= MIN_FIELD_CHARS
}

function isRealDate(raw) {
  const d = new Date(`${raw}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw
}

function hasTally(text) {
  if (/\bTally\s*:[^\n]*\b\d+\s*Blockers?\b[^\n]*\b\d+\s*Majors?\b[^\n]*\b\d+\s*Minors?\b[^\n]*\b\d+\s*Nits?\b/i.test(text)) return true
  if (/\b\d+\s*Blockers?\b[^\n]*\b\d+\s*Majors?\b[^\n]*\b\d+\s*Minors?\b[^\n]*\b\d+\s*Nits?\b/i.test(text)) return true
  // Findings table: a "Sev" header row followed by a valid separator row with the
  // same number of columns (each cell like --- or :---:).
  const lines = text.split('\n')
  const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!/^\s*\|[^\n]*\bSev(erity)?\b/i.test(lines[i])) continue
    const header = cells(lines[i])
    const sep = cells(lines[i + 1])
    if (header.length >= 2 && sep.length === header.length && sep.every((c) => /^:?-{3,}:?$/.test(c))) return true
  }
  return false
}

export function splitEntries(text) {
  const entries = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let current = null
  let inFence = false
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    const heading = inFence ? null : line.match(/^## (.+)$/)
    if (heading) {
      if (current) entries.push(current)
      current = { heading: heading[1], body: '' }
      continue
    }
    if (current) current.body += `${line}\n`
  }
  if (current) entries.push(current)
  return entries
}

export function checkEntry(entry, sinceDate) {
  const dateMatch = entry.heading.match(DATE_RE)
  if (!dateMatch) return [`entry "${entry.heading}": heading carries no YYYY-MM-DD date`]
  if (!isRealDate(dateMatch[1])) return [`entry "${entry.heading}": heading date ${dateMatch[1]} is not a real calendar date`]
  if (dateMatch[1] < sinceDate) return []
  if (EXEMPT_HEADING_RE.test(entry.heading)) return []

  const text = `${entry.heading}\n${entry.body}`
  const label = `entry "${entry.heading.slice(0, 70)}"`
  const problems = []

  // Highest tier mentioned wins (a reviewer's raise beats the author's declaration).
  const tiers = [...text.matchAll(/\bTier\**\s*[.:]?\s*\**\s*([123])\b/gi)].map((m) => Number(m[1]))
  if (!tiers.length) problems.push(`${label}: no tier declared (write "Tier 1", "Tier 2", or "Tier 3")`)
  const tier = tiers.length ? Math.max(...tiers) : null

  if (!MODEL_ID_RE.test(text)) {
    problems.push(`${label}: no exact model id (record the session-header id, e.g. gpt-5.6-luna, claude-fable-5-1, gemini-3.7-flash, o4-mini)`)
  }

  if (!VERDICT_RE.test(text)) {
    problems.push(`${label}: no labeled verdict ("Verdict: pass | pass-with-minors | fail", or the verdict in bold)`)
  }

  if (!hasTally(text)) {
    problems.push(`${label}: no complete findings tally ("Tally: N Blocker / N Major / N Minor / N Nit" with all four counts, or a Sev table with its separator row)`)
  }

  if (!hasField(text, 'Checked')) {
    problems.push(`${label}: no "Checked:" field with content — the explicit list of what was verified is mandatory`)
  }

  if (!hasField(text, 'Dismissed')) {
    problems.push(`${label}: no "Dismissed:" field with content — list every dismissed/rebutted finding with its reason, or "none"`)
  }

  if (tier === 2 || tier === 3) {
    if (!hasField(text, 'verification-gap')) {
      problems.push(`${label}: Tier ${tier} entry lacks a "verification-gap:" field with content ("if this behavior broke, would any test fail?")`)
    }
    if (!hasField(text, 'named-set')) {
      problems.push(`${label}: Tier ${tier} entry lacks a "named-set:" field with content (partial special-casing of an enum/status/flag set)`)
    }
    if (!hasField(text, 'Missing')) {
      problems.push(`${label}: Tier ${tier} entry lacks a "Missing:" field with content (what the reviewer looked for and did not find)`)
    }
  }

  return problems
}

export function lintText(text, sinceDate) {
  const problems = []
  let checked = 0
  for (const entry of splitEntries(text)) {
    const dateMatch = entry.heading.match(DATE_RE)
    if (dateMatch && dateMatch[1] >= sinceDate) checked += 1
    problems.push(...checkEntry(entry, sinceDate))
  }
  return { problems, checked }
}

function runSelfTest() {
  const good1 = `## [2026-09-20] tools/x.mjs — thing (Tier 1)

- Tier 1. Author: Claude (\`claude-fable-5-1\`). Reviewer 1: Codex \`gpt-5.6-luna\`.
- Verdict: **pass**. Tally: 0 Blocker / 0 Major / 0 Minor / 0 Nit.
- Checked: ran lint, read all three files, reuse search for an existing helper (none).
- Dismissed: none.
`
  const good3 = `## 2026-09-20 — PR #12 (feature/y)

**Tier.** 3 (CI). **Roles and models.** Author claude-fable-5-1 | R1 gpt-5.6-sol | R2 claude-fable-5-1
**Verdicts.** R1 pass-with-minors; R2 pass.
| Sev | Raised by | Finding | Disposition |
|---|---|---|---|
| Minor | R1 | style nit | rebutted |
**Checked.** tests run; reuse search; tier confirmed.
**verification-gap.** every behavior change has a failing-capable test.
**named-set.** the status enum has all members handled.
**Dismissed.** R1-3 (style) — rebutted: matches repo convention, R1 agreed.
**Missing.** looked for a rollback path and a rate limit on the new route; neither exists — filed as follow-up.
`
  const old = `## [2026-08-01] something ancient

- no fields at all
`
  const cases = [
    { name: 'tier 1 complete', text: good1, expect: 0 },
    { name: 'tier 3 complete (project format)', text: good3, expect: 0 },
    { name: 'pre-cutoff entry skipped', text: old, expect: 0 },
    { name: 'missing tier', text: good1.replace('Tier 1. ', '').replace(' (Tier 1)', ''), expect: 1 },
    { name: 'missing model id', text: good1.replace('`claude-fable-5-1`', 'Claude').replace('`gpt-5.6-luna`', 'Codex'), expect: 1 },
    { name: 'missing verdict', text: good1.replace('**pass**', 'fine'), expect: 1 },
    { name: 'missing tally', text: good1.replace('Tally: 0 Blocker / 0 Major / 0 Minor / 0 Nit.', ''), expect: 1 },
    { name: 'missing Checked', text: good1.replace('- Checked:', '- Looked at:'), expect: 1 },
    { name: 'missing Dismissed', text: good1.replace('- Dismissed: none.', ''), expect: 1 },
    { name: 'tier 3 without verification-gap', text: good3.replace('**verification-gap.**', '**tests.**'), expect: 1 },
    { name: 'tier 3 without named-set', text: good3.replace('**named-set.**', '**enum.**'), expect: 1 },
    { name: 'tier 3 with bare-word mentions only fails both', text: good3.replace('**verification-gap.** every behavior change has a failing-capable test.\n**named-set.** the status enum has all members handled.', 'We skipped verification-gap and named-set this time.'), expect: 2 },
    { name: 'empty verification-gap value fails', text: good3.replace('**verification-gap.** every behavior change has a failing-capable test.', '**verification-gap.**'), expect: 1 },
    { name: 'escape-audit entry exempt', text: '## [2026-09-25] ESCAPE AUDIT #2 (routine)\n\n- five PRs sampled, no fields\n', expect: 0 },
    { name: 'D6 owner waiver exempt', text: '## [2026-09-20] D6 OWNER WAIVER — settings narrowing\n\n- File, exception, responsibility, date\n', expect: 0 },
    { name: 'exception record exempt', text: '## [2026-09-20] EXCEPTION RECORD — exact revert\n\n- prior sha, revert sha\n', expect: 0 },
    { name: 'highest tier wins', text: good1.replace('- Tier 1. ', '- Declared Tier 1; reviewer raised to Tier 3. '), expect: 3 },
    { name: 'verdict in prose only fails', text: good1.replace('Verdict: **pass**.', 'The tests pass.'), expect: 1 },
    { name: 'o-series id accepted', text: good1.replace('`gpt-5.6-luna`', '`o4-mini`'), expect: 0 },
    { name: 'path-shaped id is not a model id', text: good1.replace('`claude-fable-5-1`', 'Claude').replace('`gpt-5.6-luna`', '/tmp/claude-501/x'), expect: 1 },
    { name: 'tier 3 without Missing', text: good3.replace('**Missing.**', '**Absent.**'), expect: 1 },
    { name: 'tier 2 needs all three', text: good1.replace(/Tier 1/g, 'Tier 2'), expect: 3 },
    { name: 'undated heading', text: '## no date here\n\n- Tier 1\n', expect: 1 },
    { name: 'heading inside a code fence is not an entry', text: '# Log\n\n```\n## YYYY-MM-DD — PR #N (branch)\n```\n' + good1, expect: 0 },
    { name: 'heading inside a tilde fence is not an entry', text: '# Log\n\n~~~\n## 2026-09-30 — fake\n~~~\n' + good1, expect: 0 },
    { name: 'empty Checked value fails', text: good1.replace('- Checked: ran lint, read all three files, reuse search for an existing helper (none).', '- Checked:'), expect: 1 },
    { name: 'empty Dismissed value fails', text: good1.replace('- Dismissed: none.', '- Dismissed:'), expect: 1 },
    { name: 'n/a is not content', text: good1.replace('- Dismissed: none.', '- Dismissed: n/a'), expect: 1 },
    { name: 'empty Missing value fails (tier 3)', text: good3.replace(/\*\*Missing\.\*\* [^\n]*/, '**Missing.**'), expect: 1 },
    { name: 'tally without numbers fails', text: good1.replace('Tally: 0 Blocker / 0 Major / 0 Minor / 0 Nit.', 'Tally: Blocker / Major / Minor / Nit.'), expect: 1 },
    { name: 'tally missing one count fails', text: good1.replace('Tally: 0 Blocker / 0 Major / 0 Minor / 0 Nit.', 'Tally: 0 Blocker / 0 Major / 0 Minor.'), expect: 1 },
    { name: 'Sev table without separator row fails', text: good3.replace('|---|---|---|---|\n', ''), expect: 1 },
    { name: 'multi-line Checked value counts', text: good1.replace('- Checked: ran lint, read all three files, reuse search for an existing helper (none).', '- Checked:\n  ran lint;\n  read all three files.'), expect: 0 },
    { name: 'impossible calendar date fails', text: good1.replace('[2026-09-20]', '[2026-13-45]'), expect: 1 },
    { name: 'custom cutoff includes older entry', text: old, since: '2026-07-01', expect: 6 },
    { name: 'two entries, one broken', text: good1 + '\n' + good1.replace('- Dismissed: none.', ''), expect: 1 },
    { name: 'CRLF input', text: good1.replace(/\n/g, '\r\n'), expect: 0 },
    { name: 'empty field followed by blank line and prose fails', text: good1.replace('- Checked: ran lint, read all three files, reuse search for an existing helper (none).', '- Checked:\n\nUnrelated closing prose about the change.'), expect: 1 },
    { name: 'malformed separator row fails', text: good3.replace('|---|---|---|---|', '|-- nonsense'), expect: 1 },
    { name: 'separator with wrong column count fails', text: good3.replace('|---|---|---|---|', '|---|---|'), expect: 1 },
    { name: 'aligned separator cells pass', text: good3.replace('|---|---|---|---|', '| :--- | :---: | --- | ---: |'), expect: 0 },
  ]
  let failed = 0
  for (const c of cases) {
    const { problems } = lintText(c.text.replace(/\r\n?/g, '\n'), c.since || DEFAULT_SINCE)
    const ok = problems.length === c.expect
    if (!ok) {
      failed += 1
      console.error(`SELF-TEST FAIL: ${c.name} — expected ${c.expect} problem(s), got ${problems.length}`)
      for (const p of problems) console.error(`  - ${p}`)
    }
  }
  if (failed) {
    console.error(`lint-review-log self-test: ${failed}/${cases.length} case(s) failed`)
    process.exit(1)
  }
  console.log(`lint-review-log self-test passed (${cases.length} cases, judge proven red-capable).`)
}

function isMainModule() {
  // fileURLToPath, not URL.pathname: a repo path with spaces is percent-encoded in
  // import.meta.url and a naive compare made this judge a silent no-op (found 2026-09-11).
  if (!process.argv[1]) return false
  try {
    return fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}
const isMain = isMainModule()

if (!isMain) {
  // Imported as a module: expose the functions, run nothing.
} else if (selfTest) {
  runSelfTest()
} else {
  const file = path.resolve(process.cwd(), target)
  if (!fs.existsSync(file)) {
    console.error(`${target}: file not found`)
    process.exit(2)
  }
  const { problems, checked } = lintText(fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n'), since)
  if (problems.length) {
    console.error(`Review-log lint found ${problems.length} issue(s) in ${target} (entries dated >= ${since}):`)
    for (const p of problems) console.error(`- ${p}`)
    process.exit(1)
  }
  console.log(`Review-log lint passed for ${target}: ${checked} entr${checked === 1 ? 'y' : 'ies'} dated >= ${since} checked.`)
}
