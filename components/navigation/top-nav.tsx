import { Container } from "@/components/layout/container";
import { MainNav } from "@/components/navigation/main-nav";
import { Link } from "@/i18n/navigation";

/**
 * DESIGN.md → Components · `top-nav`: 64px tall, `colors.canvas` background,
 * pinned to the top of every page.
 *
 * The row is three tracks — `1fr auto 1fr` — and that is the whole of the
 * centring. The destinations go in the middle one, which is sized to their
 * content; the two `1fr` tracks are equal by definition, so the middle track
 * sits at the row's centre whatever the wordmark's width is and however many
 * destinations there turn out to be. The wordmark is in the first track, and
 * the third is empty. It is empty on purpose: a track that held nothing but
 * matched the wordmark's share is what makes the middle one central rather than
 * merely second, and unlike a spacer element it costs nothing to keep empty and
 * cannot be forgotten when a page is copied.
 *
 * Nothing is measured, offset or positioned absolutely. A tool added to
 * `MainNav` widens the middle track, the two `1fr` tracks give up the same
 * amount each, and the group is still centred — which is the property that has
 * to survive every future tool, and the reason this is a grid rather than an
 * offset that happened to be right for two entries.
 *
 * ## What the narrow widths do instead
 *
 * The three-track row holds only while the wordmark fits in its `1fr` track.
 * Each `1fr` is `(width - destinations) / 2`, so once that falls under the
 * wordmark's own 92px the wordmark either overflows its track or pushes the
 * middle one off centre. With two destinations that is around 445px — and the
 * switch is at `sm`, 640px, deliberately well above it. A breakpoint set to
 * today's 445 would be a measurement of the two tools that exist, and the third
 * one would move it; `sm` leaves each `1fr` about 165px against the wordmark's
 * 92, which is room for the tools that are coming rather than a fit to the ones
 * that are here.
 *
 * Below `sm` the row is a plain wrapping flex row instead: the wordmark, then
 * the destinations, dropping to a second line once both together no longer fit
 * side by side. That happens below about 360px, and it is why the row is
 * `min-h-16` rather than `h-16` — on the narrowest phones the header is two
 * lines tall, and `py-xxs` keeps the second one off the border.
 *
 * What is not attempted down there is a centred group, because there is no room
 * for one. Centring the destinations' 229px in a 288px row leaves 30px a side
 * and the wordmark needs 92, so a centred group and a left-hand wordmark cannot
 * both exist below roughly 445px. The header keeps the wordmark where it has
 * always been rather than moving both, which would cost the same room and buy
 * a group that is still not centred.
 *
 * The right-hand end is empty. The language switcher that used to be there went
 * with the second language: a control offering one choice is not a control.
 *
 * ## The one place this departs from DESIGN.md
 *
 * DESIGN.md's Collapsing Strategy reads "Top nav collapses to hamburger at
 * < 768px; menu opens as a full-screen cream sheet". That is written for the
 * marketing nav it was designed around, and it is not what this header does.
 * No destination is ever hidden and none is ever more than a glance away, so
 * there is nothing a menu could reveal that the row does not already show: the
 * destinations wrap onto a second line where they do not fit, which is the list
 * a sheet would have opened onto, without the tap or the sheet covering the page
 * the link leads to.
 *
 * What is deliberately *not* done is hiding a destination on small screens. A
 * tool that can only be reached from a desktop is not a responsive layout, it
 * is a missing feature.
 *
 * ## The wordmark
 *
 * Plain text. DESIGN.md pairs its own wordmark with the Anthropic spike mark,
 * which is Anthropic's brand asset and not ours to use; RouteLens has no mark
 * yet, and plain text is the honest placeholder.
 *
 * It is set at `type-title-lg` and stays there at every width. It used to step
 * down to `type-title-md` on small screens, and the destinations are
 * `type-title-md` at every width — so a breakpoint that moved only the wordmark
 * would flatten the header's one typographic distinction, the title against the
 * links to it, at exactly the widths where they sit closest together. The
 * wordmark fits at 320px at full size, so nothing was bought by stepping down.
 */
export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline-soft bg-canvas">
      <Container>
        <div className="flex min-h-16 flex-wrap items-center gap-x-xs gap-y-xxs py-xxs sm:grid sm:h-16 sm:grid-cols-[1fr_auto_1fr] sm:gap-sm sm:py-0">
          <Link href="/" className="shrink-0 sm:justify-self-start">
            <span className="font-display type-title-lg text-ink">
              RouteLens
            </span>
          </Link>

          <MainNav />
        </div>
      </Container>
    </header>
  );
}
