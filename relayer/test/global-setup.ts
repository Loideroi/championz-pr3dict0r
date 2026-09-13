/**
 * vitest globalSetup: build dist/ exactly once per test run, before any
 * worker starts. Two test files exercise the compiled output (scripts.test.ts
 * runs relay.mjs; scripts-dist-imports.test.ts imports every dist module the
 * scripts name), and CI's relayer job runs `npm test` before `npm run build`.
 * One unconditional build here replaces two per-file builds that raced on the
 * same dist/ from parallel workers and could pass on a stale local build.
 */
import { execFileSync } from 'node:child_process';
import { relayerRoot } from './helpers.js';

export default function buildDist(): void {
  execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json'], { cwd: relayerRoot, stdio: 'pipe' });
}
