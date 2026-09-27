import { useTranslations } from "next-intl";

import {
  EMPTY_VALUE,
  formatAsn,
  formatLocation,
  formatLoss,
  formatRtt,
} from "@/lib/analysis/format";
import type { Hop, ParsedTrace } from "@/lib/analysis/types";

/**
 * Hop Details — the trace, row by row. The main body of the page.
 *
 * A real table, because the data is one: ten facts about each of N hops, and a
 * table is what lets a reader compare a column down its length.
 *
 * It scrolls sideways inside its own card rather than wrapping. DESIGN.md
 * makes that call for code windows — "retain code legibility at every
 * breakpoint by allowing horizontal scroll within the card rather than wrapping
 * code lines" — and a hop table has the same problem: ten columns will not fit
 * a phone, and a wrapped IP address or a split RTT is worse than a scroll. The
 * overflow lives on the inner card, so the page itself never scrolls sideways.
 *
 * Past ten hops it scrolls downwards too, and the table box stops growing. A
 * traceroute to a distant target is thirty rows; laid out in full it buries the
 * sections below it under a wall of numbers, and cut off at ten with no way
 * further it would be lying about the route. So the viewport is capped (see
 * `--hop-table-max-height` in globals.css for where the number comes from) and
 * the header sticks to its top, so a row is always read against its column
 * names. Ten hops or fewer produce no scrollbar at all — the cap is a maximum,
 * not a height.
 *
 * The two axes share one scroller, and the card's padding sits outside it. That
 * is what keeps the sticky header clean: were the padding inside, scrolled rows
 * would show through the gap above it.
 *
 * The columns answer two questions about a hop — whose network it is, and where
 * that network is — alongside what it measured. The first two are the looked-up
 * columns: ASN and Location are filled from the GeoIP databases for every hop
 * whose address is one the internet routes, and stay em dashes for the private
 * and carrier-internal addresses a trace begins with, which have no entry in
 * any database and no location to report.
 *
 * ISP stays an em dash throughout, and that is the complete answer rather than
 * a gap. MaxMind's free databases carry no ISP field — the trait belongs to a
 * paid product — so there is nothing to read, and the one substitution that
 * would fill the column, copying the ASN's organization across, would be
 * stating a different fact in the ISP's name. See `Hop.isp`.
 *
 * The enrichment is already folded in by the time a hop reaches this file: the
 * component reads `Hop.isp`, `Hop.asn` and `Hop.location` and knows nothing
 * about where they came from, which is what lets a database change without this
 * file changing.
 *
 * Every cell goes through a `format*` helper, so an unanswered hop prints an em
 * dash. `undefined` cannot reach the DOM, and neither can `NaN`.
 */

type Column = {
  /** Also the React key, so a name rather than a hop field. */
  key: string;
  label: string;
  value: (hop: Hop) => string;
};

export function HopDetails({ trace }: { trace: ParsedTrace }) {
  const t = useTranslations("analysis.hopDetails");

  const columns: Column[] = [
    { key: "index", label: t("index"), value: (hop) => String(hop.index) },
    { key: "ip", label: t("ip"), value: (hop) => hop.ip ?? EMPTY_VALUE },
    {
      key: "hostname",
      label: t("hostname"),
      value: (hop) => hop.hostname ?? EMPTY_VALUE,
    },
    { key: "isp", label: t("isp"), value: (hop) => hop.isp ?? EMPTY_VALUE },
    { key: "asn", label: t("asn"), value: (hop) => formatAsn(hop.asn) },
    {
      key: "location",
      label: t("location"),
      value: (hop) => formatLocation(hop.location),
    },
    { key: "loss", label: t("loss"), value: (hop) => formatLoss(hop.loss) },
    { key: "best", label: t("best"), value: (hop) => formatRtt(hop.best) },
    { key: "avg", label: t("avg"), value: (hop) => formatRtt(hop.avg) },
    { key: "worst", label: t("worst"), value: (hop) => formatRtt(hop.worst) },
  ];

  return (
    <section aria-labelledby="hop-details-heading">
      <h2 id="hop-details-heading" className="type-title-sm text-ink">
        {t("title")}
      </h2>

      <div className="mt-lg rounded-lg bg-surface-dark p-lg">
        <div className="rounded-md bg-surface-dark-soft p-md">
          {/* Focusable and named, because a scroll region a keyboard cannot
              reach is a table a keyboard cannot read. */}
          <div
            role="region"
            aria-labelledby="hop-details-heading"
            tabIndex={0}
            className="max-h-[var(--hop-table-max-height)] overflow-auto"
          >
            <table className="w-full min-w-max border-collapse text-left type-code">
              <caption className="sr-only">{t("title")}</caption>
              <thead>
                <tr className="text-on-dark-soft">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="sticky top-0 z-10 border-b border-surface-dark-elevated bg-surface-dark-soft py-xs pr-lg font-normal whitespace-nowrap"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-on-dark">
                {trace.hops.map((hop) => (
                  <tr
                    key={hop.index}
                    className="border-t border-surface-dark-elevated"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className="py-xs pr-lg whitespace-nowrap"
                      >
                        {column.value(hop)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
