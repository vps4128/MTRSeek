import { setRequestLocale } from "next-intl/server";

import { Hero } from "@/components/home/hero";
import { MtrInput } from "@/components/home/mtr-input";
import { TopNav } from "@/components/navigation/top-nav";

/**
 * The homepage: a hero, and the input the hero sends you to. Two bands, cream
 * canvas then `surface-soft`, which is the whole page.
 *
 * The header is the only chrome — no footer, no CTA band, and no marketing
 * sections between the two.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <MtrInput />
      </main>
    </>
  );
}
