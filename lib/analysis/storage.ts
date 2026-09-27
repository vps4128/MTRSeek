import { createSessionStore } from "@/lib/session-store";

import type { Hop, ParsedTrace } from "./types";

/**
 * What one press of 开始分析 leaves behind.
 *
 * The text that was pasted and the trace it parsed into, together, because they
 * are two halves of one submission and the page shows both at once: the band on
 * top still holding the paste, the results below it. Stored apart they could
 * disagree — a second paste written to one key but not yet the other would put
 * new text above old results — and there is no version of this page where the
 * text and the trace it produced are allowed to be from different submissions.
 *
 * The text is kept verbatim, including the parts the parser ignored. It is what
 * goes back in the textarea, and a reader who comes back to trim one line and
 * submit again should find their paste as they left it, not a reconstruction.
 */
export type Submission = {
  text: string;
  trace: ParsedTrace;
};

/**
 * Where a submission waits between one visit and the next.
 *
 * `sessionStorage` rather than the URL: a trace is kilobytes of text, and
 * putting it in a query string would produce an unshareable link that breaks
 * the moment someone pastes it into a chat client. Session storage also gives
 * the right lifetime for free — the trace belongs to the tab that produced it,
 * and a new tab or a new paste starts clean.
 *
 * ## Who writes it
 *
 * One writer: the paste band, on the way to showing what it has just parsed.
 * That band is on the analysis page, directly above the results, so the write
 * and the redraw are the same interaction — the store notifies the page's
 * subscriber and the results below the band replace themselves, with no
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
 * A failed parse is not stored either, and cannot be: nothing here is written
 * until `parseTrace` has said yes. That is what lets the band keep a rejected
 * paste in its textarea — the error is answered under the box, so a bad paste
 * costs a correction rather than the whole paste.
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
 * value has to read as "nothing submitted", not as a page that renders
 * `undefined` down its length.
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

/**
 * Both halves or neither.
 *
 * A record whose text survived and whose trace did not would render an empty
 * results panel under a full textarea, which is a state this page has no other
 * way to reach and no message for. So the text has to be a string *and* the
 * trace has to parse, and anything else reads as a first visit.
 */
function isSubmission(value: unknown): value is Submission {
  if (typeof value !== "object" || value === null) return false;

  const submission = value as Submission;
  return (
    typeof submission.text === "string" && isParsedTrace(submission.trace)
  );
}

const store = createSessionStore<Submission>({
  key: KEY,
  isValid: isSubmission,
});

/**
 * Stores a submission, and tells the analysis page there is a new one to draw.
 *
 * One call for both halves, which is the point of the shape above: there is no
 * way to write the text without the trace it came from.
 */
export function saveSubmission(submission: Submission): void {
  store.save(submission);
}

/**
 * Tells the subscriber when a submission is saved.
 *
 * Not a `storage` event listener: `storage` fires in *other* tabs, and
 * `sessionStorage` does not fire one at all. The write that has to be noticed
 * is this tab's own, which is why the notification comes from `saveSubmission`.
 */
export function subscribeToSubmission(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** The current submission, or `null` when there is none. */
export function getSubmissionSnapshot(): Submission | null {
  return store.getSnapshot();
}

/** What the server renders, and what the client's first pass agrees with. */
export function getSubmissionServerSnapshot(): undefined {
  return store.getServerSnapshot();
}
