/**
 * Every `../dist/src/x.js` import in scripts/*.mjs names a module tsc actually
 * emits and a symbol it actually exports. The scripts are production entry
 * points (oracle-bot.yml, matchday-watch.yml) that are not compiled, and no
 * root gate can see this edge: knip maps dist back to src for its graph but
 * never reports an unresolved import whose target is gitignored (dist/ is),
 * and dependency-cruiser excludes dist/. A misspelled module or a renamed
 * export would otherwise surface only when the workflow runs.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { relayerRoot } from './helpers.js';

const scriptsDir = resolve(relayerRoot, 'scripts');
const scripts = readdirSync(scriptsDir).filter((f) => f.endsWith('.mjs'));

// `import { a, b as c } from '../dist/src/x.js'` (either quote style) — the
// scripts use static named imports only. Fail-closed: every string literal
// that mentions `dist/` at all — single, double or backtick quoted, a
// complete specifier or any piece of one (`'../dist/'`, `'dist/src/x.js'`)
// — must be one of these, so a default, namespace or side-effect import, a
// dynamic `import()`, a `require`, a template literal or a specifier built
// from pieces fails the count check below instead of passing unparsed. This
// is static analysis: a specifier assembled from fragments none of which
// contains `dist/` is beyond it — the scripts have no computed imports, and
// one would be a reviewed change to production automation.
const NAMED_DIST_IMPORT = /^import\s*\{([^}]*)\}\s*from\s*(['"])(\.\.\/dist\/[^'"`]+)\2/gm;
const ANY_DIST_LITERAL = /(['"`])[^'"`]*\bdist\/[^'"`]*\1/g;

const namedImports = (clause: string) =>
  clause
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(/\s+as\s+/)[0]!.trim());

describe('dist-import parser — fail-closed on every form it does not understand', () => {
  const parsed = (src: string) => [...src.matchAll(NAMED_DIST_IMPORT)].length;
  const literals = (src: string) => [...src.matchAll(ANY_DIST_LITERAL)].length;

  it('accepts a static named import in either quote style', () => {
    for (const src of ["import { a, b as c } from '../dist/src/x.js';", 'import {\n  a,\n} from "../dist/src/x.js";']) {
      expect(parsed(src)).toBe(1);
      expect(literals(src)).toBe(1);
      expect(namedImports(src.slice(src.indexOf('{') + 1, src.indexOf('}')))).toEqual(src.includes(' as ') ? ['a', 'b'] : ['a']);
    }
  });

  it('counts every other dist reference as a literal the parser did not accept', () => {
    for (const src of [
      "import '../dist/src/x.js';",
      "import x from '../dist/src/x.js';",
      "import * as x from '../dist/src/x.js';",
      "const x = await import('../dist/src/x.js');",
      'const x = require("../dist/src/x.js");',
      'const x = await import(`../dist/src/nope.js`);',
      "const x = await import('../dist/' + name);",
      "const x = await import('../' + 'dist/src/nope.js');",
    ]) {
      expect(parsed(src), src).toBe(0);
      expect(literals(src), src).toBe(1);
    }
  });
});

describe('scripts/*.mjs — dist imports', () => {
  // dist/ is rebuilt once per vitest run by test/global-setup.ts (shared with
  // scripts.test.ts): the check is only as good as dist matching src.

  it('covers every script that imports dist', () => {
    // search(), not test(): a /g regex's test() is stateful across calls.
    const importing = scripts.filter((s) => readFileSync(resolve(scriptsDir, s), 'utf8').search(ANY_DIST_LITERAL) !== -1);
    expect(importing.length).toBeGreaterThan(0);
    // The workflow entry points must be among them (a rename would silently drop coverage).
    expect(importing).toEqual(expect.arrayContaining(['relay.mjs', 'check-balance.mjs', 'sentinel.mjs', 'matchday-span.mjs']));
  });

  it.each(scripts)('%s: every dist module exists and exports what is imported', async (name) => {
    const text = readFileSync(resolve(scriptsDir, name), 'utf8');
    const named = [...text.matchAll(NAMED_DIST_IMPORT)];
    // Every `../dist/…` literal must be a named import the parser understood.
    expect(named.length, `${name}: a dist import this test cannot parse`).toBe(
      [...text.matchAll(ANY_DIST_LITERAL)].length,
    );
    for (const match of named) {
      // All groups always capture (the regex has no optional groups).
      const clause = match[1] ?? '';
      const specifier = match[3] ?? '';
      const url = pathToFileURL(resolve(scriptsDir, specifier)).href;
      const mod = (await import(url)) as Record<string, unknown>;
      for (const symbol of namedImports(clause)) {
        expect(Object.keys(mod), `${name}: ${symbol} from ${specifier}`).toContain(symbol);
      }
    }
  });
});
