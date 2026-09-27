import type { Hop } from "@/lib/analysis/types";
import type { Locale } from "@/i18n/routing";

import { localizeCountry, localizeName } from "./names";
import type { IpEnrichment } from "./types";

/**
 * One hop with its lookup folded in — the only place the two meet.
 *
 * ## It narrows, and it never overwrites a measurement
 *
 * The two fields it writes are the two a parser never touches, and it
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
 *
 * ## Why the locale is an argument
 *
 * The database answers a place in every language it was compiled with and a hop
 * needs one, so the choice is made here, on the way in. Here rather than in the
 * provider, which has no reader and would have had to make it once for
 * everybody; and here rather than in a component, which would leave the table
 * and anything built later each picking for itself and able to disagree about
 * the same hop.
 *
 * The country goes through `localizeCountry` rather than `localizeName`,
 * because a country is the one field this app sometimes names itself — Hong
 * Kong reads `中国香港`, and Macau and Taiwan are named the same way. It is the
 * same function the IP lookup page calls, so the two cannot answer differently
 * about one address. `localizeName` is the rest of the decision, and it falls
 * back from the reader's language to the database's English name and then to
 * nothing at all — nothing being printed as the em dash every other absent
 * field gets.
 */
export function applyEnrichment(
  hop: Hop,
  enrichment: IpEnrichment | undefined,
  locale: Locale,
): Hop {
  if (enrichment === undefined) return hop;

  const country = localizeCountry(
    enrichment.geo?.country,
    enrichment.geo?.countryCode,
    locale,
  );
  const region = localizeName(enrichment.geo?.region, locale);
  const city = localizeName(enrichment.geo?.city, locale);

  const hasLocation =
    country !== undefined || region !== undefined || city !== undefined;

  return {
    ...hop,
    asn: enrichment.asn,
    // Rebuilt from the three display parts rather than passing `geo` through,
    // so the coordinates, the country code and the other language's names cannot
    // leak into a hop and be read as if they belonged to the router.
    location: hasLocation ? { country, region, city } : undefined,
  };
}
