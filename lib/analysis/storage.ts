import { createSessionStore } from "@/lib/session-store";

import type { Hop, ParsedTrace } from "./types";

/**
 * Where a parsed trace waits between one submission and the next.
 *
 * `sessionStorage` rather than the URL: a trace is kilobytes of text, and
 * putting it in a query string would produce an unshareable link that breaks
 * the moment someone pastes it into a chat client. Session storage also gives
 * the right lifetime for free — the trace belongs to the tab that produced it,
 * and a new tab or a new paste starts clean.
 *
 * ## Who writes it
 *
 * One writer: the paste band, which stores what it has just parsed on the way
 * to showing it. That band is on the analysis page, directly above the results,
 * so the write and the redraw are the same interaction — the store notifies the
 * page's subscriber and the results below the band replace themselves, with no
 * navigation and nothing to reload. The band used to live on the homepage and
 * hand off by navigating, which is the one thing that no longer happens here.
 *
 * ## What is deliberately not stored
 *
 * Enrichment. What comes out of here is the parse result alone, so a database
 * updated tomorrow changes tomorrow's page rather than a document that claims
 * to be a trace. The looked-up columns are folded in at render time, on the way
 * to the table.
 *
 * The mechanics — the memoised snapshot, the notification, the tolerance for a
 * storage that refuses to be read — are `createSessionStore`'s. What is here is
 * the key and the shape check.
 */

const KEY = "routelens:analysis:v1";

function isHop(value: unknown): value is Hop {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Hop).index === "number"
  );
}

/**
 * Checks the shape before trusting it.
 *
 * What comes back out of storage was written by an earlier version of this app
 * — or by something else entirely, since the key is guessable. A malformed
 * value has to read as "no trace", not as a page that renders `undefined` down
 * its length.
 */
function isParsedTrace(value: unknown): value is ParsedTrace {
  if (typeof value !== "object" || value === null) return false;

  const trace = value as ParsedTrace;
  return (
    typeof trace.source === "string" &&
    typeof trace.target === "object" &&
    trace.target !== null &&
    Array.isArray(trace.hops) &&
    trace.hops.every(isHop)
  );
}

const store = createSessionStore<ParsedTrace>({
  key: KEY,
  isValid: isParsedTrace,
});

/** Stores a trace, and tells the analysis page there is a new one to draw. */
export function saveTrace(trace: ParsedTrace): void {
  store.save(trace);
}

/**
 * Tells the subscriber when a trace is saved.
 *
 * Not a `storage` event listener: `storage` fires in *other* tabs, and
 * `sessionStorage` does not fire one at all. The write that has to be noticed
 * is this tab's own, which is why the notification comes from `saveTrace`.
 */
export function subscribeToTrace(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** The current trace, or `null` when there is none. */
export function getTraceSnapshot(): ParsedTrace | null {
  return store.getSnapshot();
}

/** What the server renders, and what the client's first pass agrees with. */
export function getTraceServerSnapshot(): undefined {
  return store.getServerSnapshot();
}
