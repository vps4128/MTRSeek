import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AnalysisView } from "@/components/analysis/analysis-view";
import { MtrInput } from "@/components/analysis/mtr-input";
import { Container } from "@/components/layout/container";
import { TopNav } from "@/components/navigation/top-nav";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/analysis">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analysis" });

  // The layout's template appends "— RouteLens". The target is not part of the
  // title because the server does not have it: the trace lives in the reader's
  // session storage, and this page is prerendered before anything is pasted.
  return { title: t("eyebrow") };
}

/**
 * The analysis page: the paste band, and the results under it.
 *
 * A server component that renders two client components. Everything that needs
 * the trace is on the client, because that is where the trace is; this file
 * only supplies the page's chrome, the order of its two bands, and the id the
 * band scrolls to.
 *
 * ## Why both halves are here
 *
 * The band used to be the homepage's, and the hero's button scrolled to it. It
 * is the same component in the same shape, moved: the reader pastes and reads
 * on one page, and submitting never navigates. The homepage is the hero alone
 * now, and its button is a link to this page.
 *
 * ## The two surfaces alternate
 *
 * `surface-soft` for the band that takes the input, cream for the results —
 * DESIGN.md's pacing rule, and the same pair the homepage used to run between
 * its hero and its input. Nothing here repeats a surface twice in a row: the
 * results band is the canvas the page was already painted on, so the only thing
 * switching colour is the band the reader interacts with.
 */
export default async function AnalysisPage({
  params,
}: PageProps<"/[locale]/analysis">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <TopNav />
      <main className="bg-canvas">
        {/* The band, then the answer. The results band is wrapped rather than
            given the id directly, because `Container` takes a class name and
            not an element's attributes — and the id has to be on an element
            that exists even while `AnalysisView` is rendering nothing, which is
            its state for the first frame after hydration. `scroll-mt-16` clears
            the sticky header so the first line of the answer is not left
            underneath it. */}
        <MtrInput />

        <div id="mtr-result" className="scroll-mt-16">
          <Container className="py-section">
            <AnalysisView />
          </Container>
        </div>
      </main>
    </>
  );
}
