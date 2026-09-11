/**
 * Architecture rules for the Next.js app tree. Layering: app → components →
 * hooks → foundation (lib/, i18n/, content/ — mutually importable), lower layers
 * never importing upward. contracts/ and relayer/ are their own npm trees with their
 * own toolchains and are not cruised here (same split as eslint.config.mjs).
 * Run: npm run arch (CI runs the same). Shape copied from Fanbet/Telescope;
 * baseline measured 2026-09-11 before severities were set (docs/REVIEW_TIERS.md).
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular imports make modules impossible to reason about (or test) in isolation.",
      from: {},
      to: { circular: true },
    },
    {
      name: "lib-does-not-import-upward",
      severity: "error",
      comment:
        "lib/, i18n/ and content/ form the shared foundation layer (they may import each other). If they need something from app/, components/ or hooks/, that something belongs in lib/.",
      from: { path: "^(lib|i18n|content)/" },
      to: { path: "^(app|components|hooks)/" },
    },
    {
      name: "hooks-do-not-import-upward",
      severity: "error",
      comment: "Hooks sit below components: a hook importing a component or a page inverts the layering.",
      from: { path: "^hooks/" },
      to: { path: "^(app|components)/" },
    },
    {
      name: "components-do-not-import-app",
      severity: "error",
      comment: "Components must stay reusable across routes; importing from app/ couples them to one route tree.",
      from: { path: "^components/" },
      to: { path: "^app/" },
    },
    {
      name: "not-to-test-files",
      severity: "error",
      comment: "Production code must not import from test files.",
      from: { pathNot: "\\.(test|spec)\\.[jt]sx?$" },
      to: { path: "\\.(test|spec)\\.[jt]sx?$" },
    },
    {
      name: "no-orphans",
      severity: "error",
      comment:
        "Stranded modules nothing imports are dead weight (a known failure mode of AI-generated code). Framework entry points are exempt.",
      from: {
        orphan: true,
        pathNot: [
          "\\.(test|spec)\\.[jt]sx?$",
          "\\.d\\.ts$",
          // Next.js framework entry files only — colocated helpers/components under app/ are NOT exempt
          // (two patterns, top-level and nested, because dependency-cruiser rejects nested quantifiers as unsafe regexes)
          "^app/(page|layout|template|loading|error|global-error|not-found|default|route|manifest|robots|sitemap|opengraph-image|twitter-image|icon|apple-icon)\\.[jt]sx?$",
          "^app/.*/(page|layout|template|loading|error|global-error|not-found|default|route|manifest|robots|sitemap|opengraph-image|twitter-image|icon|apple-icon)\\.[jt]sx?$",
          "^middleware\\.ts$", // loaded by Next.js
          "^next\\.config\\.ts$",
          "^i18n/request\\.ts$", // loaded by the next-intl plugin (default path) via next.config.ts
          "^scripts/", // CI tooling run directly by node
        ],
      },
      to: {},
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment: "Shipped code must not import devDependencies — it works locally and breaks in the production install.",
      from: { path: "^((app|components|hooks|lib|i18n|content)/|middleware\\.ts$)", pathNot: "\\.(test|spec)\\.[jt]sx?$" },
      to: { dependencyTypes: ["npm-dev"], dependencyTypesNot: ["type-only"] },
    },
  ],
  options: {
    // node_modules is doNotFollow, NOT exclude: excluding it would drop every
    // edge into a package from the graph and silently disable not-to-dev-dep
    // (proven by break-the-judge 2026-09-11 — the Telescope config has this bug).
    doNotFollow: { path: "node_modules" },
    exclude: { path: ["^\\.next", "^contracts", "^relayer", "^supabase"] },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
