/**
 * Six-locale T&C parity suite (issue 14 acceptance criteria).
 *
 * NOTE: vitest's `include` is scoped to `lib/**` and `app/**`
 * (vitest.config.ts) and slice 14's boundary forbids config edits, so this
 * canonical suite is registered through the shim `app/terms/parity.test.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  TERMS_LOCALES,
  TERMS_LOCALE_CODES,
  TERMS_SECTION_IDS,
  TIE_BREAK_JOKES,
  type TermsDocument,
  type TermsLocaleCode,
} from "./index";

const EXPECTED_LOCALES: TermsLocaleCode[] = ["en", "es", "fr", "it", "pt-BR", "tr"];

/** Non-translatable tokens that must appear byte-identical in every locale. */
const BYTE_IDENTICAL_TOKENS = [
  "1,100 CHZ",
  "550 CHZ",
  "500 CHZ",
  "100 CHZ",
  "50 CHZ",
  "5/3/1",
  "25%",
  "15%",
  "10%",
  "30%÷7",
  "20%÷10",
  "CN, BD, DZ, EG, NP, AF, KP, IQ, IR, AE, ID, VN, QA, SG",
  "HTTP 451",
  "₵h@mpi0nz Pr3dict0r",
  "BigMac Bobby",
] as const;

function fullText(doc: TermsDocument): string {
  return doc.sections
    .map((s) => [s.heading, ...s.body, s.joke ?? ""].join("\n"))
    .join("\n");
}

describe("terms: all six locales exist", () => {
  it("exposes exactly the six predecessor locales (D10)", () => {
    expect([...TERMS_LOCALE_CODES].sort()).toEqual([...EXPECTED_LOCALES].sort());
  });

  it.each(EXPECTED_LOCALES)("%s: document locale matches its map key", (code) => {
    expect(TERMS_LOCALES[code].locale).toBe(code);
    expect(TERMS_LOCALES[code].title.length).toBeGreaterThan(0);
    expect(TERMS_LOCALES[code].updated).toBe("2026-07-05");
  });
});

describe("terms: section parity", () => {
  it.each(EXPECTED_LOCALES)("%s: same section ids in the same order", (code) => {
    expect(TERMS_LOCALES[code].sections.map((s) => s.id)).toEqual([...TERMS_SECTION_IDS]);
  });

  it.each(EXPECTED_LOCALES)("%s: every section has a heading and body prose", (code) => {
    for (const section of TERMS_LOCALES[code].sections) {
      expect(section.heading.trim().length, `${code}/${section.id} heading`).toBeGreaterThan(0);
      expect(section.body.length, `${code}/${section.id} body`).toBeGreaterThan(0);
      for (const paragraph of section.body) {
        expect(paragraph.trim().length, `${code}/${section.id} paragraph`).toBeGreaterThan(20);
      }
    }
  });
});

describe("terms: numeric tokens are byte-identical across locales", () => {
  it.each(EXPECTED_LOCALES)("%s: contains every non-translatable token", (code) => {
    const text = fullText(TERMS_LOCALES[code]);
    for (const token of BYTE_IDENTICAL_TOKENS) {
      expect(text, `${code} is missing "${token}"`).toContain(token);
    }
  });
});

describe("terms: the wallet-address tie-break joke is canon", () => {
  it.each(EXPECTED_LOCALES)("%s: TIE_BREAK_JOKE is non-empty and lives in tie-breaks", (code) => {
    const joke = TIE_BREAK_JOKES[code];
    expect(joke.trim().length).toBeGreaterThan(0);
    const tieBreaks = TERMS_LOCALES[code].sections.find((s) => s.id === "tie-breaks");
    expect(tieBreaks?.joke).toBe(joke);
    // The canon prop: 0x00, born lucky, in every language.
    expect(joke).toContain("0x00");
  });

  it("all six jokes are pairwise distinct (adapted, not translated)", () => {
    const jokes = EXPECTED_LOCALES.map((code) => TIE_BREAK_JOKES[code]);
    expect(new Set(jokes).size).toBe(jokes.length);
  });
});
