import { createSessionStore } from "@/lib/session-store";

import type { IpEnrichment } from "./types";

/**
 * The last lookup this tab got an answer to.
 *
 * The lookup page reads its question out of the URL, so `/zh/ip?q=1.1.1.1` is
 * the whole of it: a bookmark, a reload and a shared link all answer the same
 * thing. That is what makes the page worth having, and it is also why arriving
 * at `/zh/ip` with nothing after it used to show an empty form — the page had
 * no question, so it had nothing to say. What this module adds is the answer to
 * the question the reader asked a moment ago, so stepping over to the analysis
 * page and back does not throw it away.
 *
 * ## Why the answer is stored and not the address
 *
 * Keeping `1.1.1.1` and looking it up again on the way back would draw the same
 * card from the same files, and would be one fewer thing to keep true. It is
 * also not the same thing, in the two cases that decide it: the databases can
 * go missing between the two visits, and the reader did not ask a second time.
 * What is remembered here is what the page showed, so returning to the page
 * shows it again; the form is still there for anyone who wants a fresh answer.
 *
 * ## What it is not
 *
 * Not a cache and not a history. One address, replaced by the next successful
 * lookup, and never written by an unsuccessful one — a lookup that came back
 * "not a public address" is not an answer worth carrying, and letting it
 * overwrite a real one would mean coming back to the page showed *less* than
 * leaving it did.
 *
 * ## Why session storage
 *
 * The same reason the trace uses it: what a reader looks up is their own
 * business and belongs to the tab they looked it up in. A shared computer, a
 * new tab and a closed window all start from an empty prompt, which is the
 * right default for an address somebody typed.
 *
 * The mechanics — the memoised snapshot, the notification, the tolerance for a
 * storage that refuses to be read — are `createSessionStore`'s. What is here is
 * the key and the shape check.
 */

const KEY = "routelens:ip:v1";

/**
 * Checks the shape before trusting it.
 *
 * `ip` is the one required field of `IpEnrichment` and the only one the card
 * reads unconditionally, so it is the one that has to be a string. Everything
 * else is optional by the type's own design, and the card reaches every one of
 * them through `?.` — an absent field and a field of the wrong type render the
 * same em dash, so there is nothing further to check.
 */
function isIpEnrichment(value: unknown): value is IpEnrichment {
  if (typeof value !== "object" || value === null) return false;

  return typeof (value as IpEnrichment).ip === "string";
}

const store = createSessionStore<IpEnrichment>({
  key: KEY,
  isValid: isIpEnrichment,
});

/** Remembers one address's answer, replacing whatever was remembered before. */
export function saveLastLookup(enrichment: IpEnrichment): void {
  store.save(enrichment);
}

/** Tells the subscriber when a lookup is remembered. */
export function subscribeToLastLookup(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** The remembered answer, or `null` when this tab has not looked anything up. */
export function getLastLookupSnapshot(): IpEnrichment | null {
  return store.getSnapshot();
}

/** What the server renders, and what the client's first pass agrees with. */
export function getLastLookupServerSnapshot(): undefined {
  return store.getServerSnapshot();
}
