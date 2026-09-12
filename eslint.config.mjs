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
    // Complexity budgets (architecture fitness functions). Wired warn-only
    // 2026-08-27; BLOCKING since 2026-09-11 (guardrail-complete decision):
    // `npm run lint` runs with --max-warnings 0, so any finding fails CI.
    // The five pre-existing over-budget functions carry a one-line
    // `eslint-disable-next-line complexity -- ... expires YYYY-MM-DD` exception
    // each, listed in docs/REVIEW_TIERS.md; scripts/check-lint-exceptions.mjs
    // fails the build when an exception lacks an expiry or is past it, and
    // reportUnusedDisableDirectives fails it once the function is fixed.
    // Tests are exempt from max-lines.
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      complexity: ["error", 15],
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["**/*.test.*", "**/__tests__/**"],
    rules: {
      "max-lines": "off",
    },
  },
  {
    // Permanent, reviewed design decision (PRD §7.6): team crests are
    // third-party URLs rendered with a plain <img> plus an onError fallback;
    // next/image cannot serve them. Lives here, not as an inline
    // eslint-disable, because inline disables must be time-bounded debt.
    files: ["components/predict/TeamCrest.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
