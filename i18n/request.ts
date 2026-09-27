import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Resolves the locale for each request and loads its message catalog.
 *
 * The locale comes from the URL segment, so an unknown value (someone typing
 * `/de`, say) falls back to the default rather than crashing. `hasLocale`
 * narrows the type, which is what makes the dynamic import below safe.
 *
 * Messages are loaded per request, so only the active locale's catalog is
 * ever sent to the browser.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
