import { defineRouting } from "next-intl/routing";

/**
 * RouteLens ships two locales: Chinese (default) and English.
 *
 * `localePrefix: "always"` puts the locale in the path for every route, so the
 * two versions of a page are genuinely different URLs — `/zh` and `/en`,
 * `/zh/analysis` and `/en/analysis`. That is what makes a shared or bookmarked
 * link open in the language it was copied from, and what lets the language
 * survive a reload without storing anything on the client.
 *
 * With `always`, a request to `/` is redirected to `/zh`.
 */
export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
