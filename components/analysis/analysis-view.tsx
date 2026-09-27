"use client";

import { useSyncExternalStore } from "react";

import { AnalysisHeader } from "@/components/analysis/analysis-header";
import { AsPath } from "@/components/analysis/as-path";
import { EmptyPanel } from "@/components/analysis/empty-panel";
import { HopDetails } from "@/components/analysis/hop-details";
import { MapPlaceholder } from "@/components/analysis/map-placeholder";
import { RouteSummary } from "@/components/analysis/route-summary";
import { useEnrichment } from "@/components/analysis/use-enrichment";
import {
  getTraceServerSnapshot,
  getTraceSnapshot,
  subscribeToTrace,
} from "@/lib/analysis/storage";
import { summarize } from "@/lib/analysis/summary";
import type { ParsedTrace } from "@/lib/analysis/types";
import { applyEnrichment } from "@/lib/enrichment/merge";

/**
 * The analysis page's client shell.
 *
 * It has to be a client component for one reason: the trace lives in
 * `sessionStorage`, which exists only in the browser. The alternative — putting
 * the trace in the URL — is what §11 rules out, since a trace is kilobytes of
 * text and a query string holding it is an unshareable link that breaks in a
 * chat client.
 *
 * ## One page, read top to bottom
 *
 * The five sections are stacked in the order a route is read: what was
 * analysed, its summary figures, the AS path, the hops themselves, and the map.
 * There is no tab bar and no view state, because none of these is an
 * alternative to any other — a reader who wants the hop table also wants the
 * summary above it, and hiding four fifths of the page behind a click makes the
 * page harder to read rather than shorter.
 *
 * ## Three states, and the third is the important one
 *
 * `undefined` is "not read yet", which is the state for the first frame. `null`
 * is "read, and there was nothing there" — a refresh, a bookmark, a storage
 * that refused to store — and gets the empty panel. Anything else is a trace.
 *
 * `useSyncExternalStore` is what makes the first frame honest. React renders
 * the server snapshot on the server and again for the client's hydration pass,
 * so the two agree; the real read follows immediately on the client. Rendering
 * the empty state first instead would flash "No analysis data" over a page that
 * has data, which is precisely the kind of statement this page is not allowed
 * to make.
 *
 * ## Enrichment is a render-time overlay
 *
 * The trace that comes out of storage is the parse result, unaltered, and the
 * looked-up attribution is folded in here, on the way to the table. Nothing is
 * written back to `sessionStorage` — what is stored stays a record of what was
 * measured, so a database updated tomorrow changes tomorrow's page rather than
 * a document that claims to be a trace.
 *
 * That also keeps the two layers' failures apart. The hook returns an empty map
 * until the server answers and forever if it never does, so the page renders
 * the moment the trace is read, with em dashes where attribution would go. A
 * data source that is slow, missing or broken costs the page three columns; it
 * cannot cost it the trace.
 */
export function AnalysisView() {
  const trace = useSyncExternalStore<ParsedTrace | null | undefined>(
    subscribeToTrace,
    getTraceSnapshot,
    getTraceServerSnapshot,
  );

  // Called before the early returns below, because a hook cannot be skipped —
  // `trace?.hops` is what lets it be called unconditionally while still doing
  // nothing until there is a trace to enrich.
  const enrichment = useEnrichment(trace?.hops);

  if (trace === undefined) return null;
  if (trace === null) return <EmptyPanel />;

  const summary = summarize(trace);

  // The same trace, with each hop's attribution attached where the lookup
  // answered for its address. A hop whose address was filtered out, or that the
  // database had nothing on, comes through as the parser wrote it.
  const enriched: ParsedTrace = {
    ...trace,
    hops: trace.hops.map((hop) =>
      applyEnrichment(hop, hop.ip === undefined ? undefined : enrichment.get(hop.ip)),
    ),
  };

  return (
    <>
      <AnalysisHeader trace={enriched} summary={summary} />

      <div className="mt-xxl flex flex-col gap-xxl">
        <RouteSummary trace={enriched} summary={summary} />
        <AsPath />
        <HopDetails trace={enriched} />
        <MapPlaceholder />
      </div>
    </>
  );
}
