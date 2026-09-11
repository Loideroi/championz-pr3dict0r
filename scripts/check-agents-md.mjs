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
//   3. No secret-shaped values — a maintained heuristic list (private-key
//      blocks; OpenAI, GitHub, GitLab, AWS, Slack, Stripe, Google, JWT shapes),
//      not a full secret scanner. One self-test fixture per family.
//   4. Restated package scripts: when a package.json sits beside the file, a
//      bullet whose only substance is a package-script command (`npm run x`,
//      `pnpm x`, `yarn x`, or the manager built-ins test/install/start, plus
//      npm ci/i) — with at most three words of label or filler around it —
//      fail, and so does a line inside a ```sh / ```bash / ```shell fence that
//      is only such a command. "- Dev: `npm run dev`", "- Run `npm test`",
//      "- `pnpm lint`", "- Dev: `npm run dev`." all fail; "- Test: `npm test`
//      — needs the Postgres container up first" passes. Managers: npm, pnpm,
//      yarn, bun; bare `yarn` / `npm install` / `npm ci` count as install.
//      Keep a command only with the caveat that makes it non-obvious, written
//      on the same line. Commands inside prose sentences are not judged: a
//      sentence is context by definition.
//   5. A CLAUDE.md beside the file must import it (`@AGENTS.md`) so there is
//      one source of truth, not two diverging copies.
// --fenced lints the first ```markdown (or ```md) fence in a template file
// instead of the file itself (templates/project-agents.md wraps its block in a
// fence); nested fences inside the block are tracked. Headings inside fences
// never satisfy the heading check.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const args = process.argv.slice(2)
const selfTest = args.includes('--self-test')
const fenced = args.includes('--fenced')
const optionValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const maxLinesRaw = optionValue('--max-lines', '150')
const headingRaw = optionValue('--require-heading', 'Boundaries')
let maxLines = 150
let requireHeading = /Boundaries/i
if (isMainModule()) {
  if (!/^[1-9]\d*$/.test(String(maxLinesRaw))) {
    console.error(`--max-lines must be a positive integer (got "${maxLinesRaw}")`)
    process.exit(2)
  }
  maxLines = Number(maxLinesRaw)
  if (typeof headingRaw !== 'string' || !headingRaw.trim() || headingRaw.startsWith('--')) {
    console.error(`--require-heading needs a non-empty pattern (got "${headingRaw}")`)
    process.exit(2)
  }
  try {
    requireHeading = new RegExp(headingRaw, 'i')
  } catch (err) {
    console.error(`--require-heading is not a valid regular expression: ${err.message}`)
    process.exit(2)
  }
}
const skipNext = new Set(['--max-lines', '--require-heading'])
const targets = args.filter((arg, i) => !arg.startsWith('--') && !skipNext.has(args[i - 1]))
if (!selfTest && targets.length === 0) targets.push('AGENTS.md')

// Heuristic families, each covered by a self-test fixture. Extend deliberately.
const SECRET_PATTERNS = [
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['OpenAI-style key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['Stripe key', /\b[sr]k_(live|test)_[A-Za-z0-9]{16,}/],
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/],
  ['GitHub fine-grained PAT', /\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ['GitLab token', /\bglpat-[A-Za-z0-9_-]{16,}/],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
]
const BUILTIN_ALL = new Set(['test', 'install', 'start'])
const BUILTIN_BY_MANAGER = { npm: new Set(['ci', 'i']), pnpm: new Set(['i']), bun: new Set(['i']), yarn: new Set() }
const MAX_FILLER_WORDS = 3

export function extractFence(text) {
  // First ```markdown or ```md fence; nested fences inside the block are tracked
  // so an inner tagged fence (```sh) does not end the extraction early. Inner
  // fences must carry a language tag: a bare inner ``` reads as the closer.
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const start = lines.findIndex((l) => /^\s*```(markdown|md)\s*$/.test(l))
  if (start === -1) return null
  const out = []
  let depth = 0
  for (const line of lines.slice(start + 1)) {
    if (/^\s*```\S/.test(line)) depth += 1
    else if (/^\s*```\s*$/.test(line)) {
      if (depth === 0) return out.join('\n')
      depth -= 1
    }
    out.push(line)
  }
  return null
}

export function stripFences(text) {
  const acc = { inFence: false, lines: [] }
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { acc.inFence = !acc.inFence; acc.lines.push(''); continue }
    acc.lines.push(acc.inFence ? '' : line)
  }
  return acc.lines.join('\n')
}

function isKnownScriptCommand(cmd, scripts) {
  if (/^yarn$/.test(cmd)) return true
  const c = cmd.match(/^(npm|pnpm|yarn|bun)\s+(?:run\s+)?([A-Za-z0-9:._-]+)(?:\s+--?[\w=-]+)*$/)
  if (!c) return false
  const [, manager, script] = c
  return scripts.has(script) || BUILTIN_ALL.has(script) || BUILTIN_BY_MANAGER[manager].has(script)
}

export function fencedCommandLines(text, scripts) {
  // Lines inside ```sh / ```bash / ```shell fences that are only a package-script command.
  const hits = []
  let inShell = false
  text.split('\n').forEach((line, i) => {
    if (/^\s*```(sh|bash|shell|zsh)\s*$/.test(line)) { inShell = true; return }
    if (/^\s*```/.test(line)) { inShell = false; return }
    if (!inShell) return
    const cmd = line.replace(/^\s*\$\s*/, '').trim()
    if (isKnownScriptCommand(cmd, scripts)) hits.push({ line: i + 1, cmd })
  })
  return hits
}

export function derivableCommandLines(text, scripts) {
  const hits = []
  const bulletRe = /^\s*[-*]\s+(.*)$/
  stripFences(text).split('\n').forEach((line, i) => {
    const b = line.match(bulletRe)
    if (!b) return
    const codes = [...b[1].matchAll(/`([^`]+)`/g)].map((m) => m[1].trim())
    if (codes.length !== 1) return
    if (!isKnownScriptCommand(codes[0], scripts)) return
    // Substance outside the command: strip the code span, punctuation, and count words.
    const filler = b[1].replace(/`[^`]+`/g, ' ').replace(/[^A-Za-z0-9]+/g, ' ').trim()
    const words = filler ? filler.split(/\s+/).length : 0
    if (words <= MAX_FILLER_WORDS) hits.push({ line: i + 1, cmd: codes[0] })
  })
  return hits
}

export function checkContent(content, { label, scripts, claudeMd, maxLines: budget, requireHeading: headingRe }) {
  const problems = []
  const lineCount = content.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').length
  if (lineCount > budget) {
    problems.push(`${label}: ${lineCount} lines exceeds the ${budget}-line budget — move procedures to skills and knowledge to the wiki`)
  }
  const headings = [...stripFences(content).matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1])
  if (!headings.some((h) => headingRe.test(h))) {
    problems.push(`${label}: no section heading matching /${headingRe.source}/ — the ask-first boundaries must be visible every session`)
  }
  for (const [family, re] of SECRET_PATTERNS) {
    if (re.test(content)) problems.push(`${label}: contains a secret-shaped value (${family}) — instruction files never hold credentials`)
  }
  if (scripts) {
    for (const hit of [...derivableCommandLines(content, scripts), ...fencedCommandLines(content, scripts)]) {
      problems.push(`${label}:${hit.line}: "${hit.cmd}" restates a package.json script with no caveat — read live; keep a command only with the caveat that makes it non-obvious, on the same line`)
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

function checkFile(target, opts = { fenced, maxLines, requireHeading }) {
  const file = path.resolve(process.cwd(), target)
  if (!fs.existsSync(file)) return [`${target}: file not found`]
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
  const content = opts.fenced ? extractFence(raw) : raw
  if (content === null) return [`${target}: no \`\`\`markdown fence found (--fenced)`]
  const dir = path.dirname(file)
  const claudePath = path.join(dir, 'CLAUDE.md')
  return checkContent(content, {
    label: target,
    scripts: opts.fenced ? null : readScripts(dir),
    claudeMd: !opts.fenced && fs.existsSync(claudePath) ? fs.readFileSync(claudePath, 'utf8') : null,
    maxLines: opts.maxLines,
    requireHeading: opts.requireHeading,
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
    { name: 'derivable "Run `npm run test`" form', content: good.replace('## Conventions', '- Run `npm run test`\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'derivable bare command bullet', content: good.replace('## Conventions', '- `yarn lint`\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'derivable with three filler words still fails', content: good.replace('## Conventions', '- Lint the code: `npm run lint`\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'command inside a sentence passes', content: good.replace('## Conventions', '- Lint with `npm run lint` before every PR because CI blocks on warnings\n\n## Conventions'), opts: base, expect: 0 },
    { name: 'yarn ci is not an npm built-in', content: good.replace('## Conventions', '- CI: `yarn ci`\n\n## Conventions'), opts: base, expect: 0 },
    { name: 'pnpm i is install', content: good.replace('## Conventions', '- Install: `pnpm i`\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'yarn i is not install', content: good.replace('## Conventions', '- Install: `yarn i`\n\n## Conventions'), opts: base, expect: 0 },
    { name: 'npm ci with caveat passes, bare fails', content: good.replace('- Install: `npm ci` (the .npmrc cooldown is deliberate; never override it)', '- Install: `npm ci`'), opts: base, expect: 1 },
    { name: 'two code spans on one line are not judged', content: good.replace('## Conventions', '- Dev: `npm run dev` then `npm run worker`\n\n## Conventions'), opts: base, expect: 0 },
    { name: 'exact budget boundary passes', content: good.replace(/\n+$/, '\n') + '- filler\n'.repeat(150 - good.replace(/\n+$/, '\n').split('\n').length + 1), opts: base, expect: 0 },
    { name: 'one over budget fails', content: good.replace(/\n+$/, '\n') + '- filler\n'.repeat(150 - good.replace(/\n+$/, '\n').split('\n').length + 2), opts: base, expect: 1 },
    { name: 'CRLF content', content: good.replace(/\n/g, '\r\n'), opts: base, expect: 0 },
    { name: 'fence extraction', content: extractFence('# T\n\n```markdown\n' + good + '```\n'), opts: base, expect: 0 },
    { name: 'fence extraction accepts md and nested fences', content: extractFence('# T\n\n```md\n' + good.replace('## Conventions', '```sh\nnpm run arch\n```\n\n## Conventions') + '```\n'), opts: base, expect: 0 },
    { name: 'heading inside a fence does not satisfy the heading check', content: good.replace('## Boundaries', '```\n## Boundaries\n```'), opts: base, expect: 1 },
    { name: 'sh fence with a bare script command fails', content: good.replace('## Conventions', '```sh\nnpm run dev\n```\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'sh fence with an unknown command passes', content: good.replace('## Conventions', '```bash\n$ npm run arch -- --verbose\n```\n\n## Conventions'), opts: base, expect: 0 },
    { name: 'trailing period is no caveat', content: good.replace('## Conventions', '- Dev: `npm run dev`.\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'bun run form', content: good.replace('## Conventions', '- Dev: `bun run dev`\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'bare yarn is install', content: good.replace('## Conventions', '- Install: `yarn`\n\n## Conventions'), opts: base, expect: 1 },
    { name: 'unknown script is not derivable', content: good.replace('## Conventions', '- Arch: `npm run arch`\n\n## Conventions'), opts: base, expect: 0 },
    { name: 'no package.json skips rule 4', content: good.replace('## Conventions', '- Dev: `npm run dev`\n\n## Conventions'), opts: { ...base, scripts: null }, expect: 0 },
    { name: 'missing boundaries', content: good.replace('## Boundaries', '## Notes'), opts: base, expect: 1 },
    { name: 'custom required heading', content: good.replace('## Boundaries', '## Agent Defaults'), opts: { ...base, requireHeading: /Agent Defaults/i }, expect: 0 },
    { name: 'over budget', content: good + '- filler\n'.repeat(200), opts: base, expect: 1 },
    { name: 'secret: GitHub classic', content: good + '\n- token: ghp_abcdefghijklmnopqrstuvwxyz0123\n', opts: base, expect: 1 },
    { name: 'secret: GitHub fine-grained', content: good + '\n- token: github_pat_11ABCDEFG0abcdefghijklmnop\n', opts: base, expect: 1 },
    { name: 'secret: GitLab', content: good + '\n- token: glpat-abcdefghijklmnopqrst\n', opts: base, expect: 1 },
    { name: 'secret: OpenAI', content: good + '\n- key: sk-abcdefghijklmnopqrstuvwxyz\n', opts: base, expect: 1 },
    { name: 'secret: Stripe', content: good + '\n- key: sk_live_abcdefghijklmnopqrstu\n', opts: base, expect: 1 },
    { name: 'secret: AWS', content: good + '\n- key: AKIAABCDEFGHIJKLMNOP\n', opts: base, expect: 1 },
    { name: 'secret: Slack', content: good + '\n- token: xoxb-123456789012-abcdef\n', opts: base, expect: 1 },
    { name: 'secret: Google', content: good + '\n- key: AIzaSyA1234567890abcdefghijklmnopqrstuv\n', opts: base, expect: 1 },
    { name: 'secret: JWT', content: good + '\n- jwt: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz\n', opts: base, expect: 1 },
    { name: 'secret: private key block', content: good + '\n-----BEGIN RSA PRIVATE KEY-----\n', opts: base, expect: 1 },
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
  let total = cases.length + 1
  let tmp = null
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-md-'))
  } catch (err) {
    // A read-only sandbox cannot write temp files; report the skip loudly rather than
    // failing the run — CI runners can always write, so the case still runs there.
    console.error(`SELF-TEST SKIPPED: filesystem discovery (no temp write access: ${err.code || err.message})`)
    total -= 1
  }
  if (tmp) {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ scripts: { dev: 'next dev' } }))
    fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), '# CLAUDE.md\n\nnotes only\n')
    fs.writeFileSync(path.join(tmp, 'AGENTS.md'), good.replace('## Conventions', '- Dev: `npm run dev`\n\n## Conventions'))
    const cwd = process.cwd()
    let fsProblems = []
    try {
      process.chdir(tmp)
      fsProblems = checkFile('AGENTS.md', { fenced: false, maxLines: 150, requireHeading: /Boundaries/i })
      // Default-options path, as the CLI calls it (a flatMap(checkFile) once passed the index as opts).
      // Skipped under --self-test --fenced, where the module-level flag would change the meaning.
      const viaDefaults = fenced ? fsProblems : checkFile('AGENTS.md')
      if (viaDefaults.length !== fsProblems.length) {
        failed += 1
        console.error(`SELF-TEST FAIL: default options — expected ${fsProblems.length} problem(s), got ${viaDefaults.length}`)
      }
    } finally {
      process.chdir(cwd)
      fs.rmSync(tmp, { recursive: true, force: true })
    }
    const ok = fsProblems.length === 2 && fsProblems.some((p) => /restates/.test(p)) && fsProblems.some((p) => /CLAUDE\.md/.test(p))
    if (!ok) {
      failed += 1
      console.error(`SELF-TEST FAIL: filesystem discovery — expected a restated-script problem and a CLAUDE.md import problem, got ${fsProblems.length}`)
      for (const p of fsProblems) console.error(`  - ${p}`)
    }
  }
  if (failed) {
    console.error(`check-agents-md self-test: ${failed}/${total} case(s) failed`)
    process.exit(1)
  }
  console.log(`check-agents-md self-test passed (${total} cases, judge proven red-capable).`)
}

if (!isMainModule()) {
  // Imported as a module: expose the functions, run nothing.
} else if (selfTest) {
  runSelfTest()
} else {
  const problems = targets.flatMap((target) => checkFile(target))
  if (problems.length) {
    console.error(`AGENTS.md check found ${problems.length} issue(s):`)
    for (const p of problems) console.error(`- ${p}`)
    process.exit(1)
  }
  console.log(`AGENTS.md check passed for ${targets.join(', ')}.`)
}
