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
//   - a "Checked:" field (the explicit list of what was verified)
//   - a "Dismissed:" field (every dismissed or rebutted finding with its reason,
//     or "none") — dismissals are never silent
// Tier 2 and 3 additionally require, anywhere in the entry:
//   - the token `verification-gap` (the reviewer asked "if this behavior broke,
//     would any test fail?" and reported untested behavior changes)
//   - the token `named-set` (the reviewer checked diffs that special-case some
//     members of a fixed set — enum, status code, sentinel, flag — and leave
//     the rest silent)
//   - a "Missing:" field (what the reviewer looked for and did not find; the
//     "what is missing" question, which measurably beats persona framing)
// Rationale and evidence: wiki/agent-ops/bmad-method-assessment.md (borrowed
// from BMAD v6.11's review evidence, 2026-09-11) and the review contract.
// Entries dated before the cutoff are skipped: the fields were not required
// when they were written, and history is not rewritten to satisfy a judge.

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_PATH = 'logs/review-log.md'
const DEFAULT_SINCE = '2026-09-12'
const DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/

const args = process.argv.slice(2)
const selfTest = args.includes('--self-test')
const sinceIndex = args.indexOf('--since')
const since = sinceIndex === -1 ? DEFAULT_SINCE : args[sinceIndex + 1]
const positional = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--since')
const target = positional[0] || DEFAULT_PATH

if (!/^\d{4}-\d{2}-\d{2}$/.test(since || '') || Number.isNaN(Date.parse(`${since}T00:00:00Z`))) {
  console.error(`--since must be a real YYYY-MM-DD date (got "${since}")`)
  process.exit(2)
}

function field(name) {
  // Matches "Checked:", "- Checked:", "**Checked:**", "**Checked.**" at a line start.
  return new RegExp(`(^|\\n)\\s*(?:[-*]\\s*)?\\**${name}\\**\\s*[.:]`, 'i')
}

export function splitEntries(text) {
  const entries = []
  const lines = text.split('\n')
  let current = null
  let inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence
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
  if (dateMatch[1] < sinceDate) return []

  const text = `${entry.heading}\n${entry.body}`
  const label = `entry "${entry.heading.slice(0, 70)}"`
  const problems = []

  const tierMatch = text.match(/\bTier\**\s*[.:]?\s*\**\s*([123])\b/i)
  if (!tierMatch) problems.push(`${label}: no tier declared (write "Tier 1", "Tier 2", or "Tier 3")`)
  const tier = tierMatch ? Number(tierMatch[1]) : null

  if (!/\b(gpt|claude|gemini|codex|o[1-9])[-_a-z0-9.]*\d[-_a-z0-9.]*\b/i.test(text)) {
    problems.push(`${label}: no exact model id (record the session-header id, e.g. gpt-5.6-luna, claude-fable-5-1)`)
  }

  if (!/\b(pass-with-minors|pass|fail)\b/i.test(text)) {
    problems.push(`${label}: no verdict (pass | pass-with-minors | fail)`)
  }

  if (!(/\bTally\s*:/i.test(text) || /\b\d+\s*Blockers?\b/i.test(text) || /\|\s*Sev(erity)?\s*\|/i.test(text))) {
    problems.push(`${label}: no findings tally ("Tally: N Blocker / N Major / N Minor / N Nit" or a Sev table)`)
  }

  if (!field('Checked').test(text)) {
    problems.push(`${label}: no "Checked:" field — the explicit list of what was verified is mandatory`)
  }

  if (!field('Dismissed').test(text)) {
    problems.push(`${label}: no "Dismissed:" field — list every dismissed/rebutted finding with its reason, or "none"`)
  }

  if (tier === 2 || tier === 3) {
    if (!/verification-gap/i.test(text)) {
      problems.push(`${label}: Tier ${tier} entry lacks the verification-gap check ("if this behavior broke, would any test fail?")`)
    }
    if (!/named-set/i.test(text)) {
      problems.push(`${label}: Tier ${tier} entry lacks the named-set check (partial special-casing of an enum/status/flag set)`)
    }
    if (!field('Missing').test(text)) {
      problems.push(`${label}: Tier ${tier} entry lacks a "Missing:" field (what the reviewer looked for and did not find)`)
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
**Checked.** tests run; reuse search; verification-gap: every behavior change has a failing-capable test; named-set: the status enum has all members handled.
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
    { name: 'tier 3 without verification-gap', text: good3.replace('verification-gap', 'tests'), expect: 1 },
    { name: 'tier 3 without named-set', text: good3.replace('named-set', 'enum'), expect: 1 },
    { name: 'tier 3 without Missing', text: good3.replace('**Missing.**', '**Absent.**'), expect: 1 },
    { name: 'tier 2 needs all three', text: good1.replace(/Tier 1/g, 'Tier 2'), expect: 3 },
    { name: 'undated heading', text: '## no date here\n\n- Tier 1\n', expect: 1 },
    { name: 'heading inside a code fence is not an entry', text: '# Log\n\n```\n## YYYY-MM-DD — PR #N (branch)\n```\n' + good1, expect: 0 },
  ]
  let failed = 0
  for (const c of cases) {
    const { problems } = lintText(c.text, DEFAULT_SINCE)
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

if (selfTest) {
  runSelfTest()
} else {
  const file = path.resolve(process.cwd(), target)
  if (!fs.existsSync(file)) {
    console.error(`${target}: file not found`)
    process.exit(2)
  }
  const { problems, checked } = lintText(fs.readFileSync(file, 'utf8'), since)
  if (problems.length) {
    console.error(`Review-log lint found ${problems.length} issue(s) in ${target} (entries dated >= ${since}):`)
    for (const p of problems) console.error(`- ${p}`)
    process.exit(1)
  }
  console.log(`Review-log lint passed for ${target}: ${checked} entr${checked === 1 ? 'y' : 'ies'} dated >= ${since} checked.`)
}
