import { defineRouting } from "next-intl/routing";

/**
 * RouteLens ships in Chinese, and only in Chinese.
 *
 * ## Why the locale segment stayed
 *
 * There is one language here, and `localePrefix: "always"` still puts it in the
 * path: `/zh`, `/zh/analysis`, `/zh/ip`. Serving those pages from `/` instead
 * would be a URL migration — every link, bookmark, test and README line in the
 * project would move — in exchange for a shorter address, and it would make
 * adding a second language later a second migration of the same kind. One
 * catalogue is a size, not a URL scheme.
 *
 * With `always`, a request to `/` is redirected to `/zh`.
 *
 * ## What removing a language does not do
 *
 * The GeoIP databases still answer a place in eight languages, and this app
 * still reads the English one — not as a language it is offered in, but as the
 * only key the MMDB format guarantees. That is `names.ts`'s business, and it is
 * why a name's language is a wider type than this one.
 */
export const routing = defineRouting({
  locales: ["zh"],
  defaultLocale: "zh",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/**
 * The locale behind a value the router produced.
 *
 * `useLocale()` is typed as `string`, because `next-intl` cannot know which
 * locales a project configured. This file does, so the narrowing happens here
 * once rather than as a cast at each call site — and it is a lookup rather than
 * an assertion, because the fallback is real: a value that is not one of ours is
 * answered with the default locale instead of being declared into the union.
 */
export function resolveLocale(value: string): Locale {
  return (
    routing.locales.find((locale) => locale === value) ?? routing.defaultLocale
  );
}
