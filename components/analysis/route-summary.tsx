import { useTranslations } from "next-intl";

import {
  EMPTY_VALUE,
  formatCount,
  formatLoss,
  formatRtt,
} from "@/lib/analysis/format";
import type { RouteSummary as Summary } from "@/lib/analysis/summary";
import type { ParsedTrace } from "@/lib/analysis/types";

/**
 * Route Summary — the six figures the trace actually contains, and no more.
 *
 * Every row is a value the parser read. There is no ASN, ISP, country or city
 * row, because nothing in this phase resolves those: a row saying
 * "China Telecom" would have to be invented, and an invented measurement is
 * worse than an absent one. Where the trace carries no figure, the row shows
 * an em dash — the same marker the hop table uses, so "not measured" reads the
 * same everywhere on the page.
 *
 * Two columns of label/value rows rather than a row of boxed statistics. The
 * six figures are one list of facts about one route, and boxing the first three
 * while leaving the rest loose would say they were two different kinds of
 * thing. Values are set in `type-code`, which DESIGN.md reserves for addresses
 * and measured figures.
 */
export function RouteSummary({
  trace,
  summary,
}: {
  trace: ParsedTrace;
  summary: Summary;
}) {
  const t = useTranslations("analysis.routeSummary");
  const { host, ip } = trace.target;

  const rows: { label: string; value: string }[] = [
    { label: t("target"), value: host ?? ip ?? EMPTY_VALUE },
    { label: t("avgRtt"), value: formatRtt(summary.avg) },
    { label: t("hopCount"), value: formatCount(summary.hopCount) },
    { label: t("bestRtt"), value: formatRtt(summary.best) },
    { label: t("packetLoss"), value: formatLoss(summary.packetLoss) },
    { label: t("worstRtt"), value: formatRtt(summary.worst) },
  ];

  return (
    <section aria-labelledby="route-summary-heading">
      <h2 id="route-summary-heading" className="type-title-sm text-ink">
        {t("title")}
      </h2>

      <dl className="mt-lg grid grid-cols-1 gap-x-xl sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-md border-b border-hairline-soft py-sm"
          >
            <dt className="type-body-sm text-muted-foreground">{row.label}</dt>
            <dd className="type-code text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
