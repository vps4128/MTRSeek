import type { Hop } from "./types";

/**
 * The autonomous systems a trace was observed to cross, read off its hops.
 *
 * ## What this is, and what it is not
 *
 * This is not a BGP AS path. BGP announces a path of AS numbers as a route
 * attribute, and reading one means querying a routing-information service for a
 * prefix. Nothing here does that, and nothing here queries anything: the input
 * is the hops of one trace, and each hop's `asn` is what a GeoLite2 lookup
 * answered for that hop's own address.
 *
 * What that produces is a different and weaker object — the sequence of
 * allocations the addresses in this trace belong to, in the order the trace
 * reached them. It is an observation of the trace, not a claim about the
 * routing table, and the two disagree routinely: a path can cross an AS without
 * any of its routers answering, and a hop that does not answer contributes
 * nothing. This is why the section is titled AS Path and described as observed
 * rather than being called a route.
 *
 * ## What gets merged, and what never does
 *
 * Consecutive hops in the same AS become one segment, so three hops of one
 * carrier read `AS4809` once with the hop range beside it rather than three
 * times. Merging is *only* ever between neighbours: `AS4809, AS4809, AS4134,
 * AS4809` is three segments, because the fourth hop is a genuine return to an
 * AS the trace had left. Collapsing that to two would erase the single most
 * interesting thing the sequence has to say. There is no deduplication here and
 * no sorting — the order is the trace's own order, and it is the whole point.
 *
 * A hop with no AS number ends the run and starts nothing. That includes a hop
 * nobody looked up, an address no database has a record for, and a hop whose
 * record carried an organization and no number. Two segments either side of
 * such a hop are therefore never merged, and their hop ranges are not
 * adjacent — the gap stays visible in the ranges rather than being closed by
 * assuming the missing hop belonged to either neighbour.
 *
 * ## Identity
 *
 * A segment is identified by `asn`, the number, and only by that. The
 * organization is carried along as metadata: it is a name the database gives to
 * the allocation, two records for the same number may spell it differently or
 * omit it, and treating a name as identity would split one AS into two segments
 * over a difference in punctuation. When neighbours share a number, the first
 * organization seen is the one kept, and a neighbour with no organization
 * leaves the name already held in place.
 *
 * ## Purity
 *
 * A pure function from hops to segments. It does not read a database, call an
 * API, touch storage or reach for a browser — every fact it needs is already on
 * the hops it was handed, which is what makes it testable without a fixture and
 * safe to call during a render.
 */

/**
 * One run of consecutive hops in the same autonomous system.
 *
 * `startHop` and `endHop` are hop indices — the same 1-based positions the hop
 * table prints — and they are equal for a segment one hop long. They are what
 * makes a gap legible: two segments whose ranges are not adjacent came from
 * hops that resolved to nothing in between.
 */
export type AsPathSegment = {
  /** The AS number. The segment's identity, and the only thing merged on. */
  asn: number;

  /**
   * The operator the database names for that allocation, when it named one.
   *
   * Metadata rather than identity, and passed through untranslated: it is what
   * the database says the operator is called.
   */
  organization?: string;

  /** 1-based index of the first hop in the run. */
  startHop: number;

  /** 1-based index of the last hop in the run, inclusive. */
  endHop: number;
};

/**
 * Fold a trace's hops into the observed AS path.
 *
 * One pass, no allocation beyond the result. The output is empty when no hop
 * resolved to an AS — an ordinary state, not an error, and the caller's cue to
 * show an empty section rather than a placeholder AS number.
 */
export function buildAsPath(hops: Hop[]): AsPathSegment[] {
  const segments: AsPathSegment[] = [];
  let current: AsPathSegment | undefined;

  for (const hop of hops) {
    const asn = hop.asn?.number;

    if (asn === undefined) {
      // Nothing to attribute this hop to, so it breaks the run: a later hop
      // with the same number as an earlier one is a separate segment, because
      // whether the trace stayed in that AS across the gap is not known.
      current = undefined;
      continue;
    }

    if (current !== undefined && current.asn === asn) {
      current.endHop = hop.index;
      current.organization ??= hop.asn?.organization;
      continue;
    }

    current = {
      asn,
      organization: hop.asn?.organization,
      startHop: hop.index,
      endHop: hop.index,
    };
    segments.push(current);
  }

  return segments;
}
