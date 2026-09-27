import { isPublicIp } from "./ip";
import type { EnrichmentProvider, IpEnrichment } from "./types";

/**
 * The Enrichment Service.
 *
 * Everything between "here are the addresses a trace mentioned" and "here is
 * what the provider said about each". The work is entirely about narrowing:
 * a trace names the same address more than once, names addresses that are not
 * routable, and names things that are not addresses at all, and the provider
 * should be asked exactly once about each address that has an answer.
 *
 * ## What it guarantees
 *
 * - **Nothing unreasonable is asked.** Only strings that parse as addresses and
 *   are globally routable reach the provider. The reasoning is in `ip.ts`.
 * - **Nothing is asked twice.** Addresses are deduplicated before the call, so
 *   a twenty-hop trace through four networks costs four lookups.
 * - **Nothing is reordered.** The result is a `Map` built by walking the input
 *   once, so its keys are in the order the trace first mentioned them — which
 *   is what §12 asks for and what makes a failure easy to read: the addresses
 *   that come back are the ones that were asked about, in the order they
 *   appeared.
 * - **A failure is not fatal.** §7: a lookup that cannot answer leaves its hops
 *   showing em dashes and the analysis page rendering as normal. So this
 *   function resolves for every input, including an empty one and one whose
 *   provider is entirely broken — the only caller that has to distinguish those
 *   cases is the API route, which asks `createProvider` first.
 *
 * ## What it deliberately does not do
 *
 * It does not decide what an absent field means, hold a cache, or touch a hop.
 * Merging into the display shape is `applyEnrichment`'s job, and it lives apart
 * from this file because this file never runs in a browser.
 */
export async function enrichIps(
  provider: EnrichmentProvider,
  ips: readonly string[],
): Promise<Map<string, IpEnrichment>> {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const ip of ips) {
    // Trimmed and deduplicated as exact strings, because the caller looks the
    // result up with the address the trace printed. Normalising here — folding
    // `2001:DB8::1` and `2001:db8::1` into one key — would save a lookup and
    // lose the hop, since the map would then have a key no hop matches.
    const address = ip.trim();
    if (seen.has(address) || !isPublicIp(address)) continue;
    seen.add(address);
    candidates.push(address);
  }

  const results = new Map<string, IpEnrichment>();
  if (candidates.length === 0) return results;

  let answered: Map<string, IpEnrichment>;
  try {
    answered = await provider.enrichMany(candidates);
  } catch (error) {
    // The provider failed as a whole — an unreadable database, most likely.
    // Every hop keeps its measurements and shows an em dash where the lookup
    // would have been, which is the same page a reader gets when the answer is
    // genuinely "no data". The difference is worth having in the log.
    console.error(`[enrichment] ${provider.name} lookup failed`, error);
    return results;
  }

  for (const address of candidates) {
    const enrichment = answered.get(address);
    // A provider that skipped an address is treated exactly like one that
    // answered with nothing, so a key is never invented for an address nobody
    // looked up.
    if (enrichment !== undefined) results.set(address, enrichment);
  }

  return results;
}
