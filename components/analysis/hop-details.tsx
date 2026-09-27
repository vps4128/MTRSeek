import { ListOrdered } from "lucide-react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui/icon";
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
 * Downwards it does not scroll at all: every hop is laid out and the page grows
 * to fit them. The table used to stop at ten rows and scroll the rest inside a
 * capped box, on the argument that thirty rows of numbers would bury the
 * sections below. That traded the reader's route for the page's tidiness, and
 * it cost them the one thing this table is for — a trace read end to end, which
 * is how a route is actually diagnosed. So the cap is gone and the whole trace
 * is on the page; ten hops or a hundred, the reader scrolls the document like
 * they would any other page.
 *
 * With no vertical scrolling there is nothing for the header to stick to, so it
 * is an ordinary header row again. `sticky` there was never about the page: it
 * held the column names against rows scrolling underneath them inside the box,
 * and the box no longer scrolls that way.
 *
 * The horizontal axis is untouched, and the card's padding still sits outside
 * the scroller so a scrolled row cannot show through the gap beside it.
 *
 * The columns answer two questions about a hop — whose network it is, and where
 * that network is — alongside what it measured. The first two are the looked-up
 * columns: ASN and Location are filled from the GeoIP databases for every hop
 * whose address is one the internet routes, and stay em dashes for the private
 * and carrier-internal addresses a trace begins with, which have no entry in
 * any database and no location to report.
 *
 * There is no ISP column. MaxMind's free databases carry no ISP field — the
 * trait belongs to a paid product — so the column would have drawn an em dash
 * in every row it ever had. A column whose only possible value is "no answer"
 * is not a narrower answer than leaving it out; it is the same answer repeated
 * once per hop. Nor is it filled by the substitution that suggests itself,
 * copying the ASN's organization across: an AS is an allocation and an ISP is a
 * service sold over it, so that would state a different fact in the ISP's name.
 *
 * The enrichment is already folded in by the time a hop reaches this file: the
 * component reads `Hop.asn` and `Hop.location` and knows nothing about where
 * they came from, which is what lets a database change without this file
 * changing.
 *
 * ASN is the one column whose values wrap. Organization names run to forty
 * characters, and on a single line that column alone was wider than the rest of
 * the table put together — which is what pushed the table into horizontal
 * scroll on a desktop. Its values are capped and fold instead, at the width
 * `--hop-asn-column-max-width` sets. Every other column keeps to one line: a
 * wrapped IP address or a split RTT is worse to read than a scroll.
 *
 * Every cell goes through a `format*` helper, so an unanswered hop prints an em
 * dash. `undefined` cannot reach the DOM, and neither can `NaN`.
 */

type Column = {
  /** Also the React key, so a name rather than a hop field. */
  key: string;
  label: string;
  value: (hop: Hop) => string;
  /**
   * The width this column's values wrap at, for a column long enough to set the
   * table's width on its own.
   *
   * Unset — which is every column but ASN — keeps the value on one line, so a
   * row is one line tall wherever it can be, and the table is as narrow as its
   * contents allow.
   */
  wrapAt?: string;
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
    {
      key: "asn",
      label: t("asn"),
      value: (hop) => formatAsn(hop.asn),
      wrapAt: "max-w-[var(--hop-asn-column-max-width)]",
    },
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
      {/* One icon for the section and none for the nine columns. A glyph over
          each column would be a second header row saying what the first one
          already says, and the columns are already one line of short labels a
          reader takes in at a glance. */}
      <h2
        id="hop-details-heading"
        className="flex items-center gap-1.5 type-title-sm text-ink"
      >
        <Icon of={ListOrdered} />
        {t("title")}
      </h2>

      <div className="mt-lg rounded-lg bg-surface-dark p-lg">
        <div className="rounded-md bg-surface-dark-soft p-md">
          {/* Focusable and named, because a scroll region a keyboard cannot
              reach is a table a keyboard cannot read. Horizontal only: the
              table grows downwards with the trace and the page scrolls. */}
          <div
            role="region"
            aria-labelledby="hop-details-heading"
            tabIndex={0}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-max border-collapse text-left type-code">
              <caption className="sr-only">{t("title")}</caption>
              <thead>
                <tr className="text-on-dark-soft">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="border-b border-surface-dark-elevated py-xs pr-lg font-normal whitespace-nowrap"
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
                        className={`py-xs pr-lg align-top ${
                          column.wrapAt === undefined
                            ? "whitespace-nowrap"
                            : "whitespace-normal"
                        }`}
                      >
                        {/* The ceiling sits on a box inside the cell, not on
                            the cell: `max-width` does not apply to a table
                            cell, so a column told to wrap there would go on
                            growing regardless. */}
                        <span
                          className={
                            column.wrapAt === undefined
                              ? undefined
                              : `block ${column.wrapAt}`
                          }
                        >
                          {column.value(hop)}
                        </span>
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
