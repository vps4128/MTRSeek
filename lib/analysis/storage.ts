import type { Hop, ParsedTrace } from "./types";

/**
 * Where a parsed trace waits between the homepage and the analysis page.
 *
 * `sessionStorage` rather than the URL: a trace is kilobytes of text, and
 * putting it in a query string would produce an unshareable link that breaks
 * the moment someone pastes it into a chat client. Session storage also gives
 * the right lifetime for free — the trace belongs to the tab that produced it,
 * and a new tab or a new paste starts clean.
 *
 * Every access is wrapped, because `sessionStorage` is not guaranteed to exist:
 * it throws outright in some privacy modes, and is absent during prerendering.
 * A failure here is a missing trace, never a broken page.
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

export function saveTrace(trace: ParsedTrace): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(trace));
  } catch {
    // Nothing to recover: the analysis page will show its empty state, which is
    // the same thing it shows when no trace was ever submitted.
  }
}

/** The stored text as a trace, or `null` if it is absent or not one. */
function parseStored(raw: string | null): ParsedTrace | null {
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isParsedTrace(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The raw stored text, or `null` when it cannot be reached at all. */
function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/* ============================================================================
   Reading it from a component
   ----------------------------------------------------------------------------
   The analysis page cannot read the trace while rendering: `sessionStorage`
   does not exist on the server, so a read during render would put the trace in
   the client's first pass and nothing in the server's, and React would answer
   with a hydration mismatch.

   So the store is exposed as the three functions `useSyncExternalStore` asks
   for. React calls `getServerSnapshot` for the server render *and* for the
   client's hydration pass, which is what makes the two agree; the real read
   happens straight after, on the client, and the page fills in. Until then the
   reader sees an empty page rather than a flash of "No analysis data" — the
   empty state is a statement about the trace, and it would be a lie for the
   first frame of a page that has one.
   ============================================================================ */

/**
 * Deliberately a no-op.
 *
 * Nothing else writes to this key while the analysis page is open — only the
 * homepage does, and it navigates here immediately afterwards. A page that did
 * want to react to another tab writing would need a `storage` event listener
 * here, and `sessionStorage` does not fire one.
 */
export function subscribeToTrace(): () => void {
  return () => {};
}

/**
 * The current trace, or `null` when there is none.
 *
 * Memoised on the raw stored string, because `useSyncExternalStore` compares
 * snapshots by identity and a fresh `JSON.parse` on every call would re-render
 * forever. Comparing the raw text rather than a version counter also means the
 * cache cannot go stale: any write changes the string, and a changed string is
 * a miss.
 */
let cachedRaw: string | null = null;
let cachedValue: ParsedTrace | null = null;
let cached = false;

export function getTraceSnapshot(): ParsedTrace | null {
  const raw = readRaw();

  if (!cached || raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseStored(raw);
    cached = true;
  }

  return cachedValue;
}

/** What the server renders, and what the client's first pass agrees with. */
export function getTraceServerSnapshot(): undefined {
  return undefined;
}
