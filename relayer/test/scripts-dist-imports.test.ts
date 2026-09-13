/**
 * Every `../dist/src/x.js` import in scripts/*.mjs names a module tsc actually
 * emits and a symbol it actually exports. The scripts are production entry
 * points (oracle-bot.yml, matchday-watch.yml) that are not compiled, and no
 * root gate can see this edge: knip maps dist back to src for its graph but
 * never reports an unresolved import whose target is gitignored (dist/ is),
 * and dependency-cruiser excludes dist/. A misspelled module or a renamed
 * export would otherwise surface only when the workflow runs.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { relayerRoot } from './helpers.js';

const scriptsDir = resolve(relayerRoot, 'scripts');
const scripts = readdirSync(scriptsDir).filter((f) => f.endsWith('.mjs'));

// `import { a, b as c } from '../dist/src/x.js'` — the scripts use named
// imports only; a default or namespace import would fail the count check
// below rather than pass silently.
const NAMED_DIST_IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'(\.\.\/dist\/[^']+)'/gm;
const ANY_DIST_IMPORT = /^import\b[^;]*?from\s*'\.\.\/dist\/[^']+'/gm;

const namedImports = (clause: string) =>
  clause
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(/\s+as\s+/)[0]!.trim());

describe('scripts/*.mjs — dist imports', () => {
  beforeAll(() => {
    // Always rebuild (about 2 s): the check is only as good as dist matching
    // src, and a stale local dist would let a renamed export pass. CI's
    // relayer job runs the tests before `npm run build`, so it needs this too.
    execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json'], { cwd: relayerRoot, stdio: 'pipe' });
  }, 120_000);

  it('covers every script that imports dist', () => {
    const importing = scripts.filter((s) => /from '\.\.\/dist\//.test(readFileSync(resolve(scriptsDir, s), 'utf8')));
    expect(importing.length).toBeGreaterThan(0);
    // The workflow entry points must be among them (a rename would silently drop coverage).
    expect(importing).toEqual(expect.arrayContaining(['relay.mjs', 'check-balance.mjs', 'sentinel.mjs', 'matchday-span.mjs']));
  });

  it.each(scripts)('%s: every dist module exists and exports what is imported', async (name) => {
    const text = readFileSync(resolve(scriptsDir, name), 'utf8');
    const named = [...text.matchAll(NAMED_DIST_IMPORT)];
    // Every dist import must be a named import the parser understood.
    expect(named.length).toBe([...text.matchAll(ANY_DIST_IMPORT)].length);
    for (const match of named) {
      // Both groups always capture (the regex has no optional groups).
      const clause = match[1] ?? '';
      const specifier = match[2] ?? '';
      const url = pathToFileURL(resolve(scriptsDir, specifier)).href;
      const mod = (await import(url)) as Record<string, unknown>;
      for (const symbol of namedImports(clause)) {
        expect(Object.keys(mod), `${name}: ${symbol} from ${specifier}`).toContain(symbol);
      }
    }
  });
});
