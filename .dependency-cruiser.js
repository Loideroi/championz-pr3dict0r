/**
 * Architecture rules for two trees (ARCHITECTURE.md):
 * - Next.js app tree: app → components → hooks → foundation (lib/, i18n/,
 *   content/ — mutually importable); lower layers never import upward.
 * - relayer/ (its own npm tree, cruised from the root since 2026-09-13):
 *   scripts/*.mjs (node entry points; they import the tsc output dist/, which
 *   is excluded here) → src → vendor (a leaf that imports nothing); test/ sits
 *   on top of src and is imported by nothing. Package imports under relayer/
 *   are classified against relayer/package.json (dependency-cruiser uses the
 *   closest manifest), so not-to-dev-dep means the relayer's own devDependencies.
 * The two trees never import each other, with one named exception (the
 * lockstep test, below). contracts/ is a separate npm tree (not cruised).
 * Run: npm run arch (CI runs the same). Baselines: docs/REVIEW_TIERS.md.
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
      comment: "lib/, i18n/, content/ are the foundation layer; anything they need from app/components/hooks belongs in lib/.",
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
      name: "relayer-does-not-import-app-tree",
      severity: "error",
      comment:
        "The relayer is deployed alone (oracle-bot.yml installs relayer/ only); an import from the app tree resolves locally and breaks in production. Data it needs from the app (lib/fixtures/matches.json) is passed as a CLI path, never imported.",
      from: { path: "^relayer/" },
      to: { path: "^((app|components|hooks|lib|i18n|content|scripts)/|middleware\\.ts$)" },
    },
    {
      name: "app-tree-does-not-import-relayer",
      severity: "error",
      comment:
        "Shipped app code consumes relayer output (Supabase rows, chain state), never its source — the relayer package is not installed in the app's production build. Single sanctioned bridge: lib/admin/pipeline.lockstep.test.ts pins the app's port of relayer/src/matchday.ts to the original.",
      from: {
        path: "^((app|components|hooks|lib|i18n|content)/|middleware\\.ts$)",
        pathNot: "^lib/admin/pipeline\\.lockstep\\.test\\.ts$",
      },
      to: { path: "^relayer/" },
    },
    {
      name: "relayer-src-does-not-import-scripts",
      severity: "error",
      comment: "relayer/scripts are CLI entry points on top of src (they import its dist/ build); src importing a script inverts the layering.",
      from: { path: "^relayer/src/" },
      to: { path: "^relayer/scripts/" },
    },
    {
      name: "relayer-test-is-not-imported",
      severity: "error",
      comment:
        "relayer/test (including test/helpers.ts, which not-to-test-files does not match) is imported by nothing: the scripts are production automation and must not reach into test support.",
      from: { path: "^relayer/(src|scripts|vendor)/" },
      to: { path: "^relayer/test/" },
    },
    {
      name: "relayer-vendor-is-a-leaf",
      severity: "error",
      comment:
        "relayer/vendor/uefa-api-types.ts is a vendored, externally maintained type reference (PRD §7.1): it imports nothing — no src, no packages, no core modules — so it can never pull an unlisted dependency into the build.",
      from: { path: "^relayer/vendor/" },
      to: {},
    },
    {
      name: "relayer-no-unlisted-package",
      severity: "error",
      comment:
        "A package the relayer imports must be in relayer/package.json: the root node_modules make a root-only package (next, react, …) resolve locally and in the CI app job, but oracle-bot.yml installs relayer/ alone. knip's unlisted check treats root dependencies as available to the workspace, so this rule is the one that catches it (proved 2026-09-13).",
      from: { path: "^relayer/(src|scripts|vendor)/" },
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
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
          // relayer entry points: all 11 scripts/*.mjs are shebang CLIs with a usage
          // contract in their header — run by oracle-bot.yml / matchday-watch.yml
          // (relay, check-balance, sentinel, matchday-span) or by the operator (five
          // listed in relayer/README.md; bot-poll and generate-insights document
          // their own invocation in the header).
          "^relayer/scripts/",
          // Vendored reference types nothing imports by design (src/schema.ts mirrors
          // them in zod); kept as the source of truth for the UEFA API shapes (PRD §7.1).
          "^relayer/vendor/uefa-api-types\\.ts$",
          // relayer/src modules the scripts import through dist/ (matchday, oracleLog, …)
          // are kept in-graph by their tests; if such a test goes, exempt the module
          // here naming the script that runs it — do not widen this to ^relayer/src/.
        ],
      },
      to: {},
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment: "Shipped code must not import devDependencies — it works locally and breaks in the production install.",
      from: {
        path: "^((app|components|hooks|lib|i18n|content)/|middleware\\.ts$|relayer/(src|scripts|vendor)/)",
        pathNot: "\\.(test|spec)\\.[jt]sx?$",
      },
      to: { dependencyTypes: ["npm-dev"], dependencyTypesNot: ["type-only"] },
    },
  ],
  options: {
    // node_modules is doNotFollow, NOT exclude: excluding it drops every package
    // edge and silently disables not-to-dev-dep (proven 2026-09-11).
    doNotFollow: { path: "node_modules" },
    // relayer/dist is the relayer's tsc output (gitignored, absent in the CI app
    // job): the scripts import it at runtime, so when it exists locally it must
    // not enter the graph as a second copy of src. When it is absent the same
    // imports show up as unresolvable modules named by their raw specifier
    // ("../dist/src/x.js"), hence the second alternative — the graph is
    // identical with or without a build (176 modules either way, 2026-09-13).
    exclude: { path: ["^\\.next", "^contracts", "^(relayer/|\\.\\./)dist/", "^supabase"] },
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
