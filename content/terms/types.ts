/**
 * Terms & Conditions content model — build slice 14 (D10, six locales).
 *
 * Every locale file default-exports a `TermsDocument` with the SAME section
 * ids in the SAME order (`TERMS_SECTION_IDS`); parity is enforced by
 * `content/terms/parity.test.ts`. Humor is adapted per locale, never
 * translated literally (ADR-0010); legal substance stays equivalent, and
 * numeric tokens (1,100 / 550 / 5/3/1 / percentages / jurisdiction codes)
 * stay byte-identical across locales.
 */

export const TERMS_SECTION_IDS = [
  "preamble",
  "skill-game",
  "entry-tiers",
  "pricing-and-fees",
  "entry-windows",
  "refunds",
  "predictions",
  "scoring",
  "ninety-minute-rule",
  "results-oracle",
  "mirror-uefa",
  "tie-breaks",
  "prizes",
  "public-chain",
  "smart-contract-risk",
  "eligibility",
  "uefa-affiliation",
  "final-authority",
  "credits",
] as const;

export type TermsSectionId = (typeof TERMS_SECTION_IDS)[number];

export type TermsLocaleCode = "en" | "es" | "fr" | "it" | "pt-BR" | "tr";

export interface TermsSection {
  id: TermsSectionId;
  heading: string;
  /** Paragraphs. Load-bearing legal substance lives here. */
  body: string[];
  /** The per-section joke — funnier than the predecessor, still binding in tone. */
  joke?: string;
}

export interface TermsDocument {
  locale: TermsLocaleCode;
  title: string;
  updated: "2026-07-05";
  sections: TermsSection[];
}
