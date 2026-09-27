import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Container } from "@/components/layout/container";
import { TopNav } from "@/components/navigation/top-nav";
import { SubnetCalculator } from "@/components/subnet/subnet-calculator";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/subnet">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subnet" });

  return { title: t("title") };
}

/**
 * `/[locale]/subnet` — the subnet calculator.
 *
 * ## Why this page is three lines
 *
 * It is the chrome and one component. The whole tool is a field whose answer is
 * a pure function of what is in it, so there is no band structure to arrange,
 * no server-side work to do before the page can be sent, and no id for anything
 * to scroll to — the answer is already beside the field at every width above
 * `lg` and directly under it below.
 *
 * ## Why it is prerendered
 *
 * The other two tools are not: the analysis page's trace lives in the reader's
 * session storage and the IP page's question lives in its query string, so both
 * are rendered per request. This one is asked nothing by its URL, so it is
 * static and arrives as HTML. The reader's own input is read from storage after
 * hydration, which is the one frame of the idle prompt the calculator's own
 * documentation describes.
 *
 * ## Why the route is its own page rather than a mode of the IP page
 *
 * The two are adjacent — an address and a network — and they are still two
 * tools. The IP page answers "whose address is this" from a database and can
 * answer "there is no record"; this one answers "what is this network" from
 * arithmetic and can always answer. Folding them together would put a form
 * whose result is always available next to one whose result is often not, and
 * the page would have to explain which of the two it was doing per query.
 */
export default async function SubnetPage({
  params,
}: PageProps<"/[locale]/subnet">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <TopNav />
      <main className="bg-canvas">
        <Container className="py-section">
          <SubnetCalculator />
        </Container>
      </main>
    </>
  );
}
