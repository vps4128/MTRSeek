"use client";

import { useLocale } from "next-intl";

import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * DESIGN.md → Components · `category-tab` / `category-tab-active`: a small row
 * of mutually exclusive tabs, inactive in `colors.muted` on a transparent
 * background, active on `surface-card` in `colors.ink`. That is precisely the
 * shape of a language control, so it is used as-is rather than inventing a new
 * component for it.
 *
 * Two plain links, no dropdown and no flags — the whole control is "中文  EN".
 *
 * Each link keeps the current path and swaps only the locale prefix, so
 * switching language on `/zh/analysis` lands on `/en/analysis`. The active
 * language is decided by the URL, never by client storage, which is why it
 * survives a reload and can be linked to directly.
 */

/** Language names are written in their own language and are never translated. */
const LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "EN",
};

export function LanguageSwitcher() {
  const activeLocale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label="Language" className="flex items-center gap-xxs">
      {routing.locales.map((locale) => {
        const isActive = locale === activeLocale;

        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            hrefLang={locale}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-md px-3.5 py-2 type-nav-link",
              isActive
                ? "bg-surface-card text-ink"
                : "text-muted-foreground",
            )}
          >
            {LABELS[locale]}
          </Link>
        );
      })}
    </nav>
  );
}
