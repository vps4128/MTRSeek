import type { HopAsn, HopLocation } from "@/lib/analysis/types";

/**
 * What a lookup can say about one address.
 *
 * ## Why every field is optional
 *
 * A GeoIP database answers with what it knows and stays silent about the rest.
 * A city database may resolve an address to a street-level block, to a country
 * and nothing finer, or — for a range nobody has ever cared about — to nothing
 * at all. Encoding that as required fields would force a filler, and the only
 * fillers available are lies: `Unknown`, `N/A`, or a neighbouring country
 * copied across. So a field that the database did not answer is absent, and the
 * display prints an em dash for it. §8 states the same rule from the outside,
 * and forbids the three specific strings — `Unknown ISP`, `Unknown ASN`,
 * `Unknown City` — that would otherwise creep in here.
 *
 * `{ ip: "1.2.3.4" }` is therefore a complete and honest answer, and the one
 * every private address and unallocated range produces.
 *
 * ## Why this is not `Hop`
 *
 * This is the lookup's own vocabulary, keyed by address and carrying things the
 * hop table has no column for — coordinates, an accuracy radius, a country
 * code. `Hop` is what one row of the table needs. `applyEnrichment` is the one
 * place the two meet, and it narrows rather than copies.
 */

/**
 * GeoIP's own answer about where an address is, with the precision the database
 * attached to it.
 *
 * Extends `HopLocation` with the three fields the hop table does not show.
 * Keeping the display fields in the same shape as the hop's means the merge is
 * a pick rather than a translation, and there is no second spelling of
 * "country" to drift out of step with the first.
 */
export type IpGeo = HopLocation & {
  /** ISO 3166-1 alpha-2, as the database stores it. Not shown in the table. */
  countryCode?: string;

  /**
   * Where the lookup places the address, to the accuracy it claims.
   *
   * An approximate point, and nothing else. It is the centre of an area the
   * database associates with the address — routinely the provider's regional
   * office or a city centroid — and never the position of the router that
   * answered. Anything that draws these has to say "approximate", and the
   * accuracy radius is what makes that statement quantitative, which is why it
   * is carried rather than discarded.
   */
  latitude?: number;
  longitude?: number;

  /** Radius in kilometres around the point above, as the database reports it. */
  accuracyRadius?: number;
};

/** One address, as a provider answers for it. */
export type IpEnrichment = {
  ip: string;

  /**
   * Only ever set from a database field that means "ISP".
   *
   * Nothing in the MaxMind free data means that, so this stays absent and the
   * hop table stays an em dash. It is never derived from `asn.organization` —
   * see `Hop.isp` for why those are two different facts.
   */
  isp?: string;

  asn?: HopAsn;

  geo?: IpGeo;
};

/**
 * A source of enrichment.
 *
 * One method is required and the plural one is not, because the plural is
 * always a loop: the shape exists so a provider with a genuinely batchable
 * backend can override it later without the service changing. What the service
 * needs from a provider is only that it answers per address, and answers with
 * an absent field rather than an exception when it has nothing.
 */
export type EnrichmentProvider = {
  /** For logging and diagnostics. Not shown to readers. */
  readonly name: string;

  /**
   * Looks up one address.
   *
   * Expected to resolve for any address it has no data for — the answer is an
   * `IpEnrichment` carrying little, not a rejection. A rejection is reserved
   * for the lookup itself failing, such as a database that cannot be read.
   */
  enrich(ip: string): Promise<IpEnrichment>;

  enrichMany(ips: readonly string[]): Promise<Map<string, IpEnrichment>>;
};

/**
 * Why an enrichment request could not be served at all.
 *
 * Distinct from an address having no data, which is a normal answer. These are
 * the cases where the service cannot be asked the question: no database
 * configured, or one configured and unreadable. §14 requires that neither takes
 * the app down, so they surface as a message on one request and never as a
 * throw at import time.
 */
export type EnrichmentErrorCode =
  | "ASN_DB_NOT_CONFIGURED"
  | "CITY_DB_NOT_CONFIGURED"
  | "DATABASE_UNREADABLE";
