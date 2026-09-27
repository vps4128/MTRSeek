import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AnalysisView } from "@/components/analysis/analysis-view";
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
 * The analysis page.
 *
 * A server component that renders one client component. Everything that needs
 * the trace is on the client, because that is where the trace is; this file
 * only supplies the page's chrome and its `<h1>`-level shell.
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
        <Container className="py-xxl lg:py-section">
          <AnalysisView />
        </Container>
      </main>
    </>
  );
}
