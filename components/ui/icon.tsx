import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Every icon on the site, through one door.
 *
 * ## Why a wrapper rather than the components themselves
 *
 * DESIGN.md has nothing to say about icon sizing — its two icon-bearing
 * components, `button-icon-circular` and `feature-card`, are not in this app —
 * so the size and the stroke are a decision this file makes rather than one it
 * inherits. Made in twenty call sites it would be twenty decisions that agree
 * today and drift on the next page; made here it is one number that every icon
 * already has.
 *
 * ## The two numbers
 *
 * **16px**, the size of the body text most of these sit beside. It is one size
 * rather than a scale because nothing here needs a second: the section headings
 * these accompany are `type-title-sm`, which is 16px, so a heading icon and a
 * button icon and a nav icon are all the same object at the same size. An icon
 * scaled up to match a display heading would be a different, louder thing — and
 * every icon on this site is an aside to text that already says the words.
 *
 * **1.75**, where Lucide draws at 2. The system's line weight is the hairline:
 * 1px borders, a serif display face at 400, no bold anywhere. At 2 the icons
 * read heavier than every rule and every letter around them, which is what
 * makes stock Lucide look pasted onto a page rather than drawn for it.
 *
 * ## Why `aria-hidden` is not optional
 *
 * Not a default that call sites may override — there is no prop to turn it off.
 * Every icon added here sits beside a label, a heading or a button text that
 * says the same thing in words, so an icon that announced itself would make a
 * screen reader read `首页 首页`. An icon that is the *only* carrier of its
 * meaning would need a different component, and this app does not have one: if
 * one is ever needed, that is a decision to make deliberately rather than by
 * passing a prop.
 *
 * `shrink-0` because a flex row will otherwise squash an icon before it wraps
 * the text beside it, which shows up as a glyph narrower than it is tall.
 */
export function Icon({
  of: Glyph,
  className,
}: {
  /** The Lucide component itself — `House`, not `"house"`, so a name that does
      not exist fails to compile rather than rendering nothing. */
  of: LucideIcon;
  /** Layout only. Colour is inherited from the text the icon sits with. */
  className?: string;
}) {
  return (
    <Glyph
      size={16}
      strokeWidth={1.75}
      aria-hidden
      className={cn("shrink-0", className)}
    />
  );
}
