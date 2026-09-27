import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";

import { routing } from "@/i18n/routing";

import "../globals.css";

/* DESIGN.md → Typography · Note on Font Substitutes. Copernicus (display) and
   StyreneB (body) are licensed Anthropic typefaces and are not available as web
   fonts, so DESIGN.md's documented substitutes are loaded instead.

   These three carry Latin only — no CJK coverage exists in any of them. The
   Chinese fallbacks are declared alongside them in globals.css. */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/** Both locales are known at build time, so every page is prerendered twice. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: {
      default: t("title"),
      template: `%s — RouteLens`,
    },
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  // An unknown first segment (someone typing /de) is a 404, not a silent
  // fallback — the URL would otherwise claim a language the page is not in.
  if (!hasLocale(routing.locales, locale)) notFound();

  // Opts this route into static rendering; without it next-intl would fall
  // back to dynamic rendering for every page.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      /* Next.js 16 stopped overriding `scroll-behavior` during navigation by
         default, so opting back in is what keeps the two behaviours apart: the
         in-page jumps — the empty panel back to the paste band, and the band
         down to the results it has just produced — still animate, while the
         hand-off from the homepage to /analysis jumps straight to the top of
         the new page instead of smooth-scrolling down it.
         See node_modules/next/dist/docs → version-16.md. */
      data-scroll-behavior="smooth"
      /* `motion-safe:` so those in-page jumps animate only for readers who have
         not asked for reduced motion. */
      className={`${cormorant.variable} ${inter.variable} ${jetbrainsMono.variable} motion-safe:scroll-smooth`}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
