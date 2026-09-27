import { isIP } from "node:net";

import { isPublicIp } from "./ip";
import type { ProviderSetup } from "./provider";
import type { IpEnrichment } from "./types";

/**
 * One address, looked up, with the reason when there is nothing to show.
 *
 * ## Why this is not just `enrichIps`
 *
 * The service answers "what does the database know about these addresses" and
 * answers an empty map when it knows nothing — which is the right shape for a
 * trace, where a hop with no attribution is a row of em dashes and the reader
 * has something else to look at. A page whose entire subject is one address is
 * different: there is nothing else to look at, and "nothing" has several
 * distinct causes that a reader can act on differently. A typo is theirs to
 * fix. A private address is a fact about the address, not a failure. An
 * unallocated range is a fact about the database's coverage. A missing database
 * is a fact about the deployment. Collapsing those into one empty answer —
 * which the service's return type cannot help but do — would tell a reader who
 * mistyped an octet the same thing as one whose server has no GeoIP data
 * installed.
 *
 * So the causes are separated here, and they are separated *before* the lookup
 * where they can be. `ip.ts` already knows which addresses are worth asking
 * about and is reused rather than reimplemented: this module adds no range
 * table of its own.
 *
 * ## Why the provider is asked directly
 *
 * `enrichIps` exists to make a batch of addresses cheap and to keep one bad
 * address from taking a whole trace down, and both of those are achieved by
 * swallowing a failure — it resolves with an empty map and logs. For a trace
 * that is right. Here it would be the exact collapse this module exists to
 * prevent: a database that cannot be read would arrive as `no-record`, which
 * tells the reader the databases have never heard of their address when in fact
 * nobody asked them.
 *
 * `EnrichmentProvider.enrich` is documented to reject in precisely that case —
 * "a rejection is reserved for the lookup itself failing, such as a database
 * that cannot be read" — so it is the method that can still tell the two apart,
 * and it is the method used. Nothing the service does for a batch is lost: one
 * address needs no deduplication, and the two checks it would apply (is this an
 * address, is it routable) have already been made above, with more to say about
 * the answer.
 *
 * ## Why `isIP` is asked as well
 *
 * `isPublicIp` answers one question with one answer — is this a well-formed
 * address the internet routes — and answers `false` to a hostname, to an empty
 * string and to `192.168.0.1` alike. That is the right contract for the filter,
 * and it is why the format question is asked separately here rather than by
 * loosening the filter. `isIP` is Node's, so this module is server-only like
 * the rest of the lookup path.
 *
 * ## Why the deployment is asked about last
 *
 * A mistyped address is a mistyped address whether or not a database is
 * installed, and a reader who typed one should be told that rather than told
 * about a server's configuration. So the two questions about the string are
 * asked first, and the deployment is asked about only once the string deserves
 * a lookup.
 */

/** What one address came back as. */
export type IpLookupOutcome =
  /** The reader has not asked about anything yet. */
  | { status: "empty" }
  /** Not an IPv4 or IPv6 address at all. */
  | { status: "invalid" }
  /** A well-formed address the public internet does not route. */
  | { status: "not-public" }
  /**
   * The lookup could not be made: no database is configured, or the one that
   * is could not be read.
   *
   * `detail` is the operator's line, not the reader's — it names the
   * environment variable that is unset, or nothing at all when the failure was
   * a read that threw. What the reader is told is the same sentence either way.
   */
  | { status: "unavailable"; detail?: string }
  /** The lookup ran and neither database has a record of the address. */
  | { status: "no-record"; ip: string }
  /** The lookup ran and found something. */
  | { status: "found"; enrichment: IpEnrichment };

/**
 * The answer for one address, whatever the question was worth asking.
 *
 * Resolves for every input rather than throwing. The one failure that is not
 * foreseeable — a database that was readable when the provider was built and is
 * not when it is read — is logged and answered as `unavailable`, because a
 * throw here would take down a page the reader can otherwise use.
 */
export async function lookupIpAddress(
  input: string,
  setup: ProviderSetup,
): Promise<IpLookupOutcome> {
  const address = input.trim();
  if (address === "") return { status: "empty" };

  if (isIP(address) === 0) return { status: "invalid" };
  if (!isPublicIp(address)) return { status: "not-public" };

  if (!setup.ok) return { status: "unavailable", detail: setup.message };

  let enrichment: IpEnrichment;
  try {
    enrichment = await setup.provider.enrich(address);
  } catch (error) {
    console.error(`[enrichment] ${setup.provider.name} lookup failed`, error);
    return { status: "unavailable" };
  }

  // A provider that holds a record naming neither an operator nor a place has
  // answered this page's question, and the answer is that there is nothing to
  // show. No filler is invented for either field — §8's rule, arriving here as
  // an absent value rather than as `Unknown ASN`.
  if (enrichment.asn === undefined && enrichment.geo === undefined) {
    return { status: "no-record", ip: address };
  }

  return { status: "found", enrichment };
}
