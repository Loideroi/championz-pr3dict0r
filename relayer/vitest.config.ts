import { defineConfig } from 'vitest/config';

// Self-contained workspace: without this file vitest walks up and loads the
// Next.js app's root vitest.config.ts (jsdom, app aliases) — keep the relayer
// on plain node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'], // one dist/ build per run, shared by the scripts tests
    testTimeout: 30_000, // scripts tests shell out to node
  },
});
