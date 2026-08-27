import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // separate workspaces with their own toolchains
    "contracts/**",
    "relayer/**",
  ]),
  {
    // Complexity budgets (architecture fitness functions, wired 2026-08-27).
    // Warn-only ratchet: baseline counts live in docs/REVIEW_TIERS.md and
    // may shrink, never grow. Tests are exempt from max-lines.
    rules: {
      complexity: ["warn", 15],
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["**/*.test.*", "**/__tests__/**"],
    rules: {
      "max-lines": "off",
    },
  },
]);

export default eslintConfig;
