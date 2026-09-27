import { setRequestLocale } from "next-intl/server";

import { Hero } from "@/components/home/hero";
import { TopNav } from "@/components/navigation/top-nav";

/**
 * The homepage: the hero, and nothing else.
 *
 * The trace input used to be a second band here, with the hero's button
 * scrolling down to it. Both are on the analysis page now — the band the reader
 * pastes into, and the results directly below it — so the hero's button is a
 * link to that page and this one is a single band, cream on cream.
 *
 * The header is the only chrome: no footer, no CTA band, and no other
 * marketing sections. There is deliberately nothing between the hero and the
 * end of the page, because the one thing a reader does next happens on the
 * page the hero points at.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <TopNav />
      <main>
        <Hero />
      </main>
    </>
  );
}
