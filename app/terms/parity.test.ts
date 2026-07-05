/**
 * Registration shim: vitest's `include` covers only `lib/**` and `app/**`
 * (vitest.config.ts), and slice 14's boundary forbids touching configs.
 * Importing the canonical suite registers its describe/it blocks here.
 * The tests themselves live in `content/terms/parity.test.ts`.
 */
import "../../content/terms/parity.test";
