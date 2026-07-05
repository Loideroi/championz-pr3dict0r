/**
 * App locales (ADR-0010, D10): the six predecessor locales, cookie-selected —
 * no locale segment in the URL, no app/ restructure. Client-safe module (no
 * server imports) so the switcher can share the constants.
 */
export const LOCALES = ["en", "es", "fr", "it", "pt-BR", "tr"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

/** Cookie read by i18n/request.ts on every server render. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Native-name labels for the switcher (byte-identical across locales). */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  "pt-BR": "Português (BR)",
  tr: "Türkçe",
};

export function isAppLocale(value: string | undefined): value is AppLocale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}
