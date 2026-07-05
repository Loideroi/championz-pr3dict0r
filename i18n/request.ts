/**
 * next-intl request config — "App Router without i18n routing": the active
 * locale comes from the NEXT_LOCALE cookie (set by the SiteNav switcher),
 * defaulting to English. Server and client render from the same cookie, so
 * there is no hydration mismatch (CLAUDE.md SSR rule).
 */
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isAppLocale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const candidate = store.get(LOCALE_COOKIE)?.value;
  const locale = isAppLocale(candidate) ? candidate : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
