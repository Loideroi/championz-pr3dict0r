/**
 * Terms & Conditions — six locales (build slice 14, D10).
 *
 * The humour is adapted per locale, never translated literally; the legal
 * substance and every numeric token stay byte-identical. Parity is enforced
 * by `content/terms/parity.test.ts` (registered with vitest via the shim at
 * `app/terms/parity.test.ts`).
 */
import type { TermsDocument, TermsLocaleCode } from "./types";
import en, { TIE_BREAK_JOKE as TIE_BREAK_JOKE_EN } from "./en";
import es, { TIE_BREAK_JOKE as TIE_BREAK_JOKE_ES } from "./es";
import fr, { TIE_BREAK_JOKE as TIE_BREAK_JOKE_FR } from "./fr";
import it, { TIE_BREAK_JOKE as TIE_BREAK_JOKE_IT } from "./it";
import ptBR, { TIE_BREAK_JOKE as TIE_BREAK_JOKE_PT_BR } from "./pt-BR";
import trTerms, { TIE_BREAK_JOKE as TIE_BREAK_JOKE_TR } from "./tr";

export { TERMS_SECTION_IDS } from "./types";
export type { TermsDocument, TermsLocaleCode, TermsSection, TermsSectionId } from "./types";

/** The canon wallet-address tie-break joke, per locale (pairwise distinct). */
export {
  TIE_BREAK_JOKE_EN,
  TIE_BREAK_JOKE_ES,
  TIE_BREAK_JOKE_FR,
  TIE_BREAK_JOKE_IT,
  TIE_BREAK_JOKE_PT_BR,
  TIE_BREAK_JOKE_TR,
};

export const TIE_BREAK_JOKES: Record<TermsLocaleCode, string> = {
  en: TIE_BREAK_JOKE_EN,
  es: TIE_BREAK_JOKE_ES,
  fr: TIE_BREAK_JOKE_FR,
  it: TIE_BREAK_JOKE_IT,
  "pt-BR": TIE_BREAK_JOKE_PT_BR,
  tr: TIE_BREAK_JOKE_TR,
};

export const TERMS_LOCALES: Record<TermsLocaleCode, TermsDocument> = {
  en,
  es,
  fr,
  it,
  "pt-BR": ptBR,
  tr: trTerms,
};

export const TERMS_LOCALE_CODES = Object.keys(TERMS_LOCALES) as TermsLocaleCode[];

/** Native-name labels for the `?lang=` switcher. */
export const TERMS_LOCALE_LABELS: Record<TermsLocaleCode, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  "pt-BR": "Português (BR)",
  tr: "Türkçe",
};

export function isTermsLocale(value: string | undefined): value is TermsLocaleCode {
  return value !== undefined && Object.hasOwn(TERMS_LOCALES, value);
}
