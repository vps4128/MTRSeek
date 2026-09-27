import { useTranslations } from "next-intl";

import { formatLoss, SOURCE_LABELS } from "@/lib/analysis/format";
import type { RouteSummary } from "@/lib/analysis/summary";
import type { ParsedTrace } from "@/lib/analysis/types";

/**
 * What was analysed, and the two figures that describe it at a glance.
 *
 * The target is the trace's own destination. MTR and WinMTR never print one —
 * it was an argument to the command — so for those it is the final hop, which
 * is the destination by definition of a trace; and when that hop is a timeout
 * there is no target to name, so the heading says so rather than printing an
 * address nobody measured.
 *
 * The figures sit on one line under the target rather than in a column beside
 * it. A masthead split across the full width reads as two unrelated blocks;
 * "example.com" followed by "12 hops · 0% packet loss" reads as one statement
 * about one route, and at mobile widths it is already stacked.
 */
export function AnalysisHeader({
  trace,
  summary,
}: {
  trace: ParsedTrace;
  summary: RouteSummary;
}) {
  const t = useTranslations("analysis");
  const { host, ip } = trace.target;
  const title = host ?? ip ?? t("unknownTarget");

  return (
    <header>
      <p className="type-caption-uppercase text-muted-foreground">
        {t("eyebrow")}
      </p>

      <div className="mt-md flex flex-wrap items-center gap-sm">
        <h1 className="measure-display-tight type-display-md text-ink">
          {title}
        </h1>
        <span className="rounded-pill bg-surface-card px-sm py-xxs type-caption text-ink">
          {SOURCE_LABELS[trace.source]}
        </span>
      </div>

      {/* Only when the name and the address are two different things: the
          parsers drop the hostname when a tool prints `x (x)`. */}
      {host !== undefined && ip !== undefined ? (
        <p className="mt-xs type-code text-muted-foreground">{ip}</p>
      ) : null}

      <p className="mt-sm type-body-sm text-muted-foreground">
        {t("summary.line", {
          count: summary.hopCount,
          loss: formatLoss(summary.packetLoss),
        })}
      </p>
    </header>
  );
}
