import type { ParsedTrace } from "@/lib/analysis/types";

/**
 * Route classification — the shape, and only the shape.
 *
 * RouteLens will eventually need to say that a path crosses CN2, CMI or CMIN2.
 * Nothing in this phase can: that judgement is made from an AS path, the
 * prefixes on it, the hop sequence and a rule set, and this phase has no ASN,
 * prefix or BGP data at all. `Hop` declares an `asn` field for the enrichment
 * layer to fill, but nothing populates it yet, so there is still no AS path
 * here to classify.
 *
 * So this file declares what detection will consume and produce, and implements
 * none of it. There is deliberately no function here, no rule table and no
 * hard-coded AS number anywhere in the app — a stub that returns "CN2" for
 * 59.43.x.x would be a guess wearing the clothes of a measurement.
 *
 * When the enrichment layer exists, a rule reads a `RouteEvidence` and returns
 * a `RouteDetection`, and the UI gains a place to show it. Until then, the AS
 * Path panel says the data is not available, which is true.
 */

/** One hop as a rule will see it, once enrichment exists. */
export type RouteEvidence = {
  hop: Pick<ParsedTrace["hops"][number], "index" | "ip" | "avg">;

  /** The ASNs announced along the path, nearest first. */
  asPath?: number[];

  /** The prefix the destination address belongs to. */
  prefix?: string;
};

/** What a rule concludes, with the observations that led to it. */
export type RouteDetection = {
  /** The carrier or product line the path is classified as. */
  label: string;

  /** 0–1. How much of the expected evidence was actually present. */
  confidence: number;

  /** The hops, ASNs or prefixes the conclusion rests on, for the reader. */
  evidence: RouteEvidence[];
};
