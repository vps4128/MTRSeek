"use client";

import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";

import { AnalysisHeader } from "@/components/analysis/analysis-header";
import { AsPath } from "@/components/analysis/as-path";
import { EmptyPanel } from "@/components/analysis/empty-panel";
import { HopDetails } from "@/components/analysis/hop-details";
import { RouteSummary } from "@/components/analysis/route-summary";
import { useEnrichment } from "@/components/analysis/use-enrichment";
import {
  getSubmissionServerSnapshot,
  getSubmissionSnapshot,
  subscribeToSubmission,
  type Submission,
} from "@/lib/analysis/storage";
import { summarize } from "@/lib/analysis/summary";
import type { ParsedTrace } from "@/lib/analysis/types";
import { applyEnrichment } from "@/lib/enrichment/merge";
import { resolveLocale } from "@/i18n/routing";

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
 * The four sections are stacked in the order a route is read: what was
 * analysed, its summary figures, the AS path, and the hops themselves. There is
 * no tab bar and no view state, because none of these is an alternative to any
 * other — a reader who wants the hop table also wants the summary above it, and
 * hiding three quarters of the page behind a click makes the page harder to
 * read rather than shorter.
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
 *
 * The map that used to close this page read the same enriched hops for its
 * labels and the lookup result for its coordinates. With the map gone the
 * coordinates have no reader here at all, which is why the hook no longer
 * reports whether it is still waiting: the em dash is the same either way, and
 * nothing else was ever waiting on it.
 *
 * ## The locale is read here, once
 *
 * A place name arrives with one entry per language the database was compiled
 * with, and the hop needs the reader's. That choice is made here — at the only
 * point where the i18n layer and the lookup meet — and handed to the merge, so
 * the table and the map read the same resolved string off the same hop rather
 * than each resolving it from the lookup map and being free to differ.
 */
export function AnalysisView() {
  // Only the trace half of the submission is read here. The text half belongs
  // to the band above, which is the only thing that shows it, and pulling it
  // out of storage twice would be two readers of one record with no way to
  // notice if they stopped agreeing.
  const submission = useSyncExternalStore<Submission | null | undefined>(
    subscribeToSubmission,
    getSubmissionSnapshot,
    getSubmissionServerSnapshot,
  );

  // Unfolded by hand rather than with `?.`, because the two absences this store
  // distinguishes mean different things and `?.trace` would merge them: `null`
  // is "nothing has been submitted" and draws the empty panel, `undefined` is
  // "storage has not been read yet" and draws nothing at all. Collapsed, the
  // empty panel would be unreachable and a first visit would render blank.
  const trace =
    submission === undefined
      ? undefined
      : submission === null
        ? null
        : submission.trace;

  // Both hooks are called before the early returns below, because a hook cannot
  // be skipped — `trace?.hops` is what lets the lookup hook be called
  // unconditionally while still doing nothing until there is a trace to enrich.
  const locale = resolveLocale(useLocale());
  const enrichment = useEnrichment(trace?.hops);

  if (trace === undefined) return null;
  if (trace === null) return <EmptyPanel />;

  const summary = summarize(trace);

  // The same trace, with each hop's attribution attached where the lookup
  // answered for its address, in the language the page is being read in. A hop
  // whose address was filtered out, or that the database had nothing on, comes
  // through as the parser wrote it.
  const enriched: ParsedTrace = {
    ...trace,
    hops: trace.hops.map((hop) =>
      applyEnrichment(
        hop,
        hop.ip === undefined ? undefined : enrichment.get(hop.ip),
        locale,
      ),
    ),
  };

  return (
    <>
      <AnalysisHeader trace={enriched} summary={summary} />

      {/* The order the sections are read in. The hop table comes before the AS
          path rather than after it: the table is the trace itself and the
          route's shape is a reading of it, so the evidence precedes the summary
          drawn from it. The AS path's own heading is what says so — it stands
          on its own and needs nothing above it but the hops it describes. */}
      <div className="mt-xxl flex flex-col gap-xxl">
        <RouteSummary trace={enriched} summary={summary} />
        <HopDetails trace={enriched} />
        <AsPath hops={enriched.hops} />
      </div>
    </>
  );
}
