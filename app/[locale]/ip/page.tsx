import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LookupResult } from "@/components/ip/lookup-result";
import { Container } from "@/components/layout/container";
import { TopNav } from "@/components/navigation/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPathname } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/routing";
import { lookupIpAddress } from "@/lib/enrichment/lookup";
import { createProvider } from "@/lib/enrichment/provider";

/**
 * `/[locale]/ip` — look up one address in the local MaxMind databases.
 *
 * ## Why the answer is rendered on the server
 *
 * The address lives in the URL as `?q=`, the lookup runs on the server before
 * the page is sent, and the result arrives as HTML. Two things follow from
 * that, and both are the reason for it.
 *
 * The first is that a result is a URL: `/zh/ip?q=8.8.8.8` can be bookmarked,
 * shared or reloaded and answers the same thing every time, in the language it
 * was copied from. The alternative — a client component fetching
 * `/api/enrich` — puts the answer in component state, where a reload loses it
 * and nothing can link to it.
 *
 * The second is that the four ways a lookup can come back empty stay apart.
 * The route's own documentation argues why a missing database must not be
 * flattened into an empty result, and a client fetch would do exactly that:
 * `503` and `200-with-nothing` both arrive as "no data" once a component has
 * to decide what to render. On the server the distinction survives all the way
 * to the message beside the form.
 *
 * The cost is that this one page renders per request instead of being
 * prerendered — it reads `searchParams`, which is what opts it out. That is the
 * right trade for a page whose entire content is the answer to its query.
 *
 * ## What it does not do
 *
 * No third-party IP service is called, directly or indirectly: `createProvider`
 * reads two files off the server's disk, and `lookupIpAddress` refuses
 * anything that is not a globally routable address before either is opened. The
 * page is a form over the same enrichment the analysis page uses, and nothing
 * else.
 *
 * ## Why it is arranged like the home page
 *
 * A display heading, one sentence under it, the one control the page is for,
 * and a dark card of real output beside them — which is the home page's hero,
 * and not a coincidence. Both pages are one sentence of explanation followed by
 * one thing the reader does, and the arrangement says that without a label.
 *
 * `lg:grid-cols-2`, matching the hero rather than this page's own earlier `md:`.
 * Two columns of a 1200px page inside a 768px window are 336px each, which is
 * narrower than both the address field and the card want to be; the home page
 * waits until 1024, and now so does this. Below it there is one column and the
 * answer simply follows the form, which is the same place for a layout that has
 * only one.
 *
 * `items-start`, where the hero centres. The hero's card is a fixed mock, so
 * centring it against a column of text costs nothing. This card is a different
 * height in every state — a bare prompt, three rows, a paragraph and a code
 * line — and centring each of those against a column whose height never changes
 * would move the card's top edge on every submit. Started, its top edge is on
 * one line in every state and only its bottom edge moves, which is the half of
 * it a reader is not looking at.
 */

/** Node, not Edge: the lookup reads files with `node:fs`. */
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/ip">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ip" });

  return { title: t("title") };
}

/**
 * The address to look up, from the query string.
 *
 * A repeated `?q=a&q=b` is a URL nothing on this page produces, so it is not a
 * state worth representing; the first value is taken so that a hand-edited or
 * appended URL still answers something rather than showing an empty form.
 */
function readQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function IpPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ip">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const current = resolveLocale(locale);
  const t = await getTranslations({ locale, namespace: "ip" });
  const query = readQuery((await searchParams).q);

  const outcome = await lookupIpAddress(query, createProvider());

  return (
    <>
      <TopNav />
      <main className="bg-canvas">
        <Container className="py-section">
          {/* The question on the left, the answer on the right. Below `lg` there
              is one column and the answer follows the form. */}
          <div className="grid grid-cols-1 items-start gap-xxl lg:grid-cols-2">
            <div>
              <h1 className="type-display-hero text-ink sm:type-display-md xl:type-display-lg">
                {t("title")}
              </h1>
              <p className="mt-lg measure-body-tight type-body-md text-body">
                {t("description")}
              </p>

              {/* A plain GET form, so the address becomes the URL and the
                  browser's own back button steps through previous lookups.
                  Submitting needs no JavaScript; `getPathname` is what keeps
                  the locale prefix.

                  The field and its button are stacked at every width, where the
                  home page's single call to action also stands alone. Side by
                  side they were a row that had to break at `sm`, which meant
                  two layouts to keep aligned for a form of one field; stacked,
                  the button is under the thing it submits at every width, and
                  the label, the field and the button all begin on the same
                  left edge. */}
              <form
                method="get"
                action={getPathname({ href: "/ip", locale: current })}
                className="mt-xl"
              >
                <label
                  htmlFor="ip-query"
                  className="block type-body-sm font-medium text-ink"
                >
                  {t("label")}
                </label>

                <Input
                  id="ip-query"
                  name="q"
                  defaultValue={query}
                  placeholder={t("placeholder")}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  /* An arbitrary width rather than `max-w-md`: this project's
                     `@theme` redefines the `--spacing-*` scale, so the named
                     `max-w-*` sizes resolve against it and `max-w-md` is 16px,
                     not Tailwind's 28rem. Wide enough for the longest IPv6
                     address and its placeholder, and capped so that a field
                     whose content is an address does not run the full width of
                     its column. Below `sm` it takes the column's own width,
                     which on a phone is narrower than the cap anyway. */
                  className="mt-xs sm:max-w-[24rem]"
                />

                {/* The button hugs its label, as the hero's does, rather than
                    filling the field's width. */}
                <div className="mt-md">
                  <Button type="submit">{t("submit")}</Button>
                </div>
              </form>
            </div>

            <LookupResult locale={current} outcome={outcome} query={query} />
          </div>
        </Container>
      </main>
    </>
  );
}
