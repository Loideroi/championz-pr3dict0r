/**
 * vitest globalSetup: build dist/ exactly once per test run, before any
 * worker starts. Two test files exercise the compiled output (scripts.test.ts
 * runs relay.mjs; scripts-dist-imports.test.ts imports every dist module the
 * scripts name), and CI's relayer job runs `npm test` before `npm run build`.
 * One clean, unconditional build here replaces two per-file builds that raced
 * on the same dist/ from parallel workers and could pass on a stale local build.
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { relayerRoot } from './helpers.js';

export default function buildDist(): void {
  // Clean first: tsc never removes output for a deleted or renamed source, so
  // a stale local dist/ could satisfy the dist-import test.
  rmSync(resolve(relayerRoot, 'dist'), { recursive: true, force: true });
  execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json'], { cwd: relayerRoot, stdio: 'pipe' });
}
