import type { Hop } from "@/lib/analysis/types";

import type { IpEnrichment } from "./types";

/**
 * One hop with its lookup folded in — the only place the two meet.
 *
 * ## It narrows, and it never overwrites a measurement
 *
 * The three fields it writes are the three a parser never touches, and it
 * writes nothing else. Loss, RTT, hostname and the address itself pass through
 * untouched, which is §18's rule stated as code: a database lookup must not be
 * able to change what was measured. The spread does the work — enrichment has
 * no key that collides with a measurement, so there is nothing to overwrite
 * even by accident.
 *
 * ## Why the result is a copy
 *
 * The trace in `sessionStorage` is the parse result and stays that way. What
 * comes out of here lives for one render, so a database that is updated
 * tomorrow changes tomorrow's page rather than a document that claims to be a
 * record of a trace. It also means a hop that a provider could not answer for
 * is returned as the very object the parser produced, with every field exactly
 * as parsed.
 *
 * ## An absent answer is not an empty one
 *
 * `undefined` enrichment and an enrichment with no fields produce the same hop,
 * because `Hop` expresses both as absent. There is no representation of "looked
 * up, found nothing" on a hop and there should not be: the hop table prints an
 * em dash either way, and only the API response — which is about addresses, not
 * hops — distinguishes them.
 */
export function applyEnrichment(
  hop: Hop,
  enrichment: IpEnrichment | undefined,
): Hop {
  if (enrichment === undefined) return hop;

  const { country, region, city } = enrichment.geo ?? {};
  const hasLocation =
    country !== undefined || region !== undefined || city !== undefined;

  return {
    ...hop,
    isp: enrichment.isp,
    asn: enrichment.asn,
    // Rebuilt from the three display parts rather than passing `geo` through,
    // so the coordinates and the accuracy radius cannot leak into a hop and be
    // read as if they belonged to the router.
    location: hasLocation ? { country, region, city } : undefined,
  };
}
