"use client";

import { Globe, House, Network, Route } from "lucide-react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * The header's destinations, as one group.
 *
 * ## Adding a tool
 *
 * A row here, and a label in the `nav` namespace. Nothing else, and nothing in
 * this file or in `TopNav` has to be re-measured: the group is centred as a
 * box, so a third entry makes the box wider and the box re-centres itself. No
 * entry carries a position, an offset or a margin of its own — the moment one
 * did, adding a tool would mean re-deriving every other tool's placement from
 * it, and the layout would be back to being maintained by hand.
 *
 * The order is the order they are read in, which is the order they are listed.
 *
 * ## Its type
 *
 * The wordmark's own typeface, one step down: `font-display type-title-md`
 * against the `font-display type-title-lg` `TopNav` sets on `RouteLens`. One
 * step is the whole difference — same family, smaller size — so the header
 * reads as a title with links beside it rather than as three titles of equal
 * weight. The Chinese falls to the same serif throughout, because every stack
 * here is the same stack.
 *
 * ## Why every entry is the same pill
 *
 * `bg-surface-card text-ink` for the entry you are on, `text-muted-foreground`
 * for the rest — DESIGN.md's `category-tab-active`. The comparison is against
 * `usePathname` inside the loop rather than a flag passed in per entry, so an
 * entry cannot be added without also being able to light up, and no entry can
 * be marked current by hand.
 *
 * That now includes the home page, where 「首页」 lights up like any other
 * entry. Before it was a destination the home page lit nothing, and the note
 * here said so was right because the wordmark was what that page was. It is a
 * destination now, and a group of peers where one of them is silently exempt is
 * a group a reader has to have been told about.
 *
 * ## Why it is a client component
 *
 * For one reason: `aria-current` is a statement about where the reader is, and
 * only the client knows that. `usePathname` is next-intl's, so it answers
 * `/ip` on `/zh/ip` — the comparison is against the route, not against the URL,
 * and the locale prefix never has to be stripped by hand here.
 */

/**
 * Every destination, in reading order.
 *
 * `as const` so `href` narrows to the literal routes the typed `Link` accepts,
 * rather than widening to `string` and failing to compile against it.
 *
 * The glyph is carried here rather than chosen inside the loop, so the four
 * entries' marks are read as one list — a house, a route, a globe, a network —
 * instead of four decisions made in four places. It is also what ties an icon to
 * a label that a translator may change: the entry keeps its mark in both
 * languages.
 *
 * The subnet entry's glyph is the same one that tool's own field label carries,
 * which is what the IP entry and the IP page already do between them.
 */
const DESTINATIONS = [
  { href: "/", label: "home", icon: House },
  { href: "/analysis", label: "mtrAnalysis", icon: Route },
  { href: "/ip", label: "ipLookup", icon: Globe },
  { href: "/subnet", label: "subnetCalculator", icon: Network },
] as const;

export function MainNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    /* `flex-wrap` so that a future entry wraps to a second line rather than
       overflowing, and `gap-xs` so the entries are spaced by the group's own
       rhythm instead of by margins on each pill. */
    <nav
      aria-label={t("label")}
      className="mt-xs flex flex-wrap items-center gap-xs sm:mt-sm"
    >
      {DESTINATIONS.map(({ href, label, icon }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-display type-title-md whitespace-nowrap sm:px-3",
              isActive ? "bg-surface-card text-ink" : "text-muted-foreground",
            )}
          >
            {/* No colour of its own: the icon inherits from the link, so the
                current entry's glyph lights up with its label and the other two
                stay muted with theirs. One `isActive` decides for both. */}
            <Icon of={icon} />
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
