import { HERO_HOPS, HERO_SUMMARY, MOCK_TARGET } from "@/lib/mock/trace";

/**
 * DESIGN.md → Components · `code-window-card`.
 *
 * Dark surface, `surface-dark-soft` for the inner code block, `rounded.lg`,
 * 24px padding. Line numbers sit in `muted-soft`, the code itself in
 * `typography.code` (JetBrains Mono). The status bar along the bottom uses
 * `surface-dark-elevated` — DESIGN.md gives that surface to exactly this job.
 *
 * The card shows a *window* onto a route, not a report: five hops and one
 * aggregate line. Everything that would make it a dashboard — the AS path, the
 * carrier, per-hop loss, RTT/hop-count statistics — is left out, and it is what
 * keeps the headline the first thing the eye lands on.
 *
 * Nothing in the card is translated — not the prompt, not the addresses, not
 * the status bar. This is what a terminal prints, and translating it would stop
 * the card resembling the thing it previews. The card reads identically in both
 * locales, which is also why the hero has no text to re-measure per language.
 */
export function MtrPreview() {
  return (
    <div className="w-full max-w-[520px] rounded-lg bg-surface-dark p-lg lg:justify-self-end">
      <div className="flex items-center justify-between gap-md">
        <p className="type-code text-on-dark-soft">
          <span className="text-muted-soft">$</span> mtr -rw {MOCK_TARGET}
        </p>
        <span className="size-1.5 rounded-full bg-accent-teal" aria-hidden />
      </div>

      {/* `w-max min-w-full` keeps every row on one line at its natural width, so
          the card scrolls sideways on a narrow phone instead of wrapping a host
          name mid-address — DESIGN.md → Responsive Behaviour. `min-w-full` is
          also what makes `flex-1` on the host cell resolve to the same width in
          every row, which is what lines the RTT column up. */}
      <div className="mt-md overflow-x-auto rounded-md bg-surface-dark-soft p-md">
        <div className="flex w-max min-w-full flex-col gap-xs">
          {HERO_HOPS.map((hop) => (
            <div key={hop.ttl} className="flex gap-sm type-code sm:gap-md">
              <span className="w-4 text-right text-muted-soft">{hop.ttl}</span>
              <span className="flex-1 text-on-dark">{hop.host}</span>
              <span className="w-16 text-right text-on-dark-soft">{hop.avg}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-md flex items-center justify-between gap-md rounded-md bg-surface-dark-elevated px-md py-sm type-caption text-on-dark-soft">
        <span>{HERO_SUMMARY.hops}</span>
        <span>{HERO_SUMMARY.loss}</span>
      </div>
    </div>
  );
}
