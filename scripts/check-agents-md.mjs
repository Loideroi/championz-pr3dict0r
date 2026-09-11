#!/usr/bin/env node
// AGENTS.md hygiene judge — the project-context admission test, made mechanical.
// Rule (wiki/agent-ops/bmad-method-assessment.md, adopted 2026-09-11): an
// instruction file holds only what is expensive to rediscover or was learned
// through failure; anything derivable from source is read live, never stored.
//
//   node tools/check-agents-md.mjs [path ...] [--fenced] [--max-lines N]
//                                  [--require-heading <regex>] [--self-test]
//
// Checks per file:
//   1. Line budget (default 150). Long instruction files drift and dilute.
//   2. A boundaries section (heading matching --require-heading, default
//      "Boundaries") — the ask-first rules an agent must see every session.
//   3. No secret-shaped values.
//   4. Derivable commands: when a package.json sits beside the file, a bullet
//      of the form "- Label: `npm run x`" with nothing else on the line, where
//      `x` is a package.json script (or the command is npm test/ci/install),
//      fails — it restates package.json. Keep a command only with the caveat
//      that makes it non-obvious ("the suite takes eleven minutes",
//      "never override the .npmrc cooldown"), written on the same line.
//   5. A CLAUDE.md beside the file must import it (`@AGENTS.md`) so there is
//      one source of truth, not two diverging copies.
// --fenced lints the first ```markdown fence in a template file instead of the
// file itself (templates/project-agents.md wraps its block in a fence).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
const selfTest = args.includes('--self-test')
const fenced = args.includes('--fenced')
const optionValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const maxLines = Number(optionValue('--max-lines', '150'))
const requireHeading = new RegExp(optionValue('--require-heading', 'Boundaries'), 'i')
const skipNext = new Set(['--max-lines', '--require-heading'])
const targets = args.filter((arg, i) => !arg.startsWith('--') && !skipNext.has(args[i - 1]))
if (!selfTest && targets.length === 0) targets.push('AGENTS.md')

const SECRET_RE = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[A-Za-z0-9]{20,}|\bghp_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{10,})/
const BUILTIN_NPM = new Set(['test', 'ci', 'install', 'i', 'start'])

export function extractFence(text) {
  const match = text.match(/```markdown\n([\s\S]*?)\n```/)
  return match ? match[1] : null
}

export function derivableCommandLines(text, scripts) {
  const hits = []
  const lineRe = /^\s*[-*]\s*[^:`]{1,60}:\s*`([^`]+)`\s*$/
  const cmdRe = /^(?:npm|pnpm|yarn)\s+(?:run\s+)?([A-Za-z0-9:._-]+)(?:\s+--?[\w=-]+)*$/
  text.split('\n').forEach((line, i) => {
    const m = line.match(lineRe)
    if (!m) return
    const cmd = m[1].trim()
    const c = cmd.match(cmdRe)
    if (!c) return
    const script = c[1]
    if (scripts.has(script) || BUILTIN_NPM.has(script)) hits.push({ line: i + 1, cmd })
  })
  return hits
}

export function checkContent(content, { label, scripts, claudeMd, maxLines: budget, requireHeading: headingRe }) {
  const problems = []
  const lineCount = content.split('\n').length
  if (lineCount > budget) {
    problems.push(`${label}: ${lineCount} lines exceeds the ${budget}-line budget — move procedures to skills and knowledge to the wiki`)
  }
  const headings = [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1])
  if (!headings.some((h) => headingRe.test(h))) {
    problems.push(`${label}: no section heading matching /${headingRe.source}/ — the ask-first boundaries must be visible every session`)
  }
  if (SECRET_RE.test(content)) {
    problems.push(`${label}: contains a secret-shaped value — instruction files never hold credentials`)
  }
  if (scripts) {
    for (const hit of derivableCommandLines(content, scripts)) {
      problems.push(`${label}:${hit.line}: "${hit.cmd}" is derivable from package.json — read live; keep a command only with the caveat that makes it non-obvious, on the same line`)
    }
  }
  if (claudeMd !== null && claudeMd !== undefined && !/^\s*@AGENTS\.md\s*$/m.test(claudeMd)) {
    problems.push(`${label}: the CLAUDE.md beside it does not import it with a line "@AGENTS.md" — two instruction files without an import diverge`)
  }
  return problems
}

function readScripts(dir) {
  const pkg = path.join(dir, 'package.json')
  if (!fs.existsSync(pkg)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(pkg, 'utf8'))
    return new Set(Object.keys(parsed.scripts || {}))
  } catch {
    return new Set()
  }
}

function checkFile(target) {
  const file = path.resolve(process.cwd(), target)
  if (!fs.existsSync(file)) return [`${target}: file not found`]
  const raw = fs.readFileSync(file, 'utf8')
  const content = fenced ? extractFence(raw) : raw
  if (content === null) return [`${target}: no \`\`\`markdown fence found (--fenced)`]
  const dir = path.dirname(file)
  const claudePath = path.join(dir, 'CLAUDE.md')
  return checkContent(content, {
    label: target,
    scripts: fenced ? null : readScripts(dir),
    claudeMd: !fenced && fs.existsSync(claudePath) ? fs.readFileSync(claudePath, 'utf8') : null,
    maxLines,
    requireHeading,
  })
}

function runSelfTest() {
  const good = `# AGENTS.md

Project X does Y. State: building. Priority: ship Z.

## Commands

- Install: \`npm ci\` (the .npmrc cooldown is deliberate; never override it)
- Test: \`npm test\` — the suite needs the local Postgres container up first

## Conventions

- Reuse before writing.

## Caveats

- 2026-09-11: agents kept re-adding a caret to a pinned version; versions are exact.

## Boundaries

- Commits, PRs, deploys are ask-first.
`
  const scripts = new Set(['dev', 'test', 'lint', 'build'])
  const base = { label: 'fixture', scripts, claudeMd: '# CLAUDE.md\n\n@AGENTS.md\n', maxLines: 150, requireHeading: /Boundaries/i }
  const cases = [
    { name: 'clean file', content: good, opts: base, expect: 0 },
    { name: 'derivable dev command', content: good.replace('## Conventions', '- Dev: `npm run dev`\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'derivable with caveat passes', content: good.replace('## Conventions', '- Dev: `npm run dev` (port 3001, 3000 is taken by the proxy)\n\n## Conventions'), opts: base, expect: 0 },
    { name: 'derivable pnpm form', content: good.replace('## Conventions', '- Lint: `pnpm lint`\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'unknown script is not derivable', content: good.replace('## Conventions', '- Arch: `npm run arch`\n\n## Conventions'), opts: base, expect: 0 },
    { name: 'no package.json skips rule 4', content: good.replace('## Conventions', '- Dev: `npm run dev`\n\n## Conventions'), opts: { ...base, scripts: null }, expect: 0 },
    { name: 'missing boundaries', content: good.replace('## Boundaries', '## Notes'), opts: base, expect: 1 },
    { name: 'custom required heading', content: good.replace('## Boundaries', '## Agent Defaults'), opts: { ...base, requireHeading: /Agent Defaults/i }, expect: 0 },
    { name: 'over budget', content: good + '- filler\n'.repeat(200), opts: base, expect: 1 },
    { name: 'secret-shaped value', content: good + '\n- token: ghp_abcdefghijklmnopqrstuvwxyz0123\n', opts: base, expect: 1 },
    { name: 'CLAUDE.md without import', content: good, opts: { ...base, claudeMd: '# CLAUDE.md\n\nsome notes\n' }, expect: 1 },
    { name: 'no CLAUDE.md is fine', content: good, opts: { ...base, claudeMd: null }, expect: 0 },
  ]
  let failed = 0
  for (const c of cases) {
    const problems = checkContent(c.content, c.opts)
    if (problems.length !== c.expect) {
      failed += 1
      console.error(`SELF-TEST FAIL: ${c.name} — expected ${c.expect}, got ${problems.length}`)
      for (const p of problems) console.error(`  - ${p}`)
    }
  }
  // Filesystem path: package.json + CLAUDE.md discovery through checkFile.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-md-'))
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ scripts: { dev: 'next dev' } }))
  fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), '# CLAUDE.md\n\n@AGENTS.md\n')
  fs.writeFileSync(path.join(tmp, 'AGENTS.md'), good.replace('## Conventions', '- Dev: `npm run dev`\n\n## Conventions'))
  const cwd = process.cwd()
  process.chdir(tmp)
  const fsProblems = checkFile('AGENTS.md')
  process.chdir(cwd)
  fs.rmSync(tmp, { recursive: true, force: true })
  if (fsProblems.length !== 1 || !/derivable/.test(fsProblems[0])) {
    failed += 1
    console.error(`SELF-TEST FAIL: filesystem discovery — expected 1 derivable-command problem, got ${fsProblems.length}`)
    for (const p of fsProblems) console.error(`  - ${p}`)
  }
  const total = cases.length + 1
  if (failed) {
    console.error(`check-agents-md self-test: ${failed}/${total} case(s) failed`)
    process.exit(1)
  }
  console.log(`check-agents-md self-test passed (${total} cases, judge proven red-capable).`)
}

if (selfTest) {
  runSelfTest()
} else {
  const problems = targets.flatMap(checkFile)
  if (problems.length) {
    console.error(`AGENTS.md check found ${problems.length} issue(s):`)
    for (const p of problems) console.error(`- ${p}`)
    process.exit(1)
  }
  console.log(`AGENTS.md check passed for ${targets.join(', ')}.`)
}
