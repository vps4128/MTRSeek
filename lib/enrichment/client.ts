import type { IpEnrichment } from "./types";

/**
 * Asking the server what it knows about these addresses.
 *
 * ## Failure is an empty answer, never an error
 *
 * Every way this can go wrong — no database configured, a network that dropped,
 * a malformed response, a server that is not running — ends the same way: an
 * empty map, and the hop table renders em dashes in the three looked-up
 * columns. The measurements are unaffected, because enrichment was never part
 * of them.
 *
 * That is a deliberate flattening of several different failures, and it is the
 * right one here. The alternative is an error state on the analysis page, and
 * there is no action for a reader to take about a GeoIP database on a server
 * they do not administer. A trace that says less is better than a trace that
 * will not render.
 *
 * ## The response is checked, not trusted
 *
 * The map is built by hand from fields that are read only if they are the right
 * type. `JSON.parse` gives `unknown` and the server is a separate process —
 * which is also true of a server that has just been deployed with a different
 * response shape than this client expects. An unchecked cast would put a
 * `undefined` in a cell and print it.
 */

function isIpEnrichment(value: unknown): value is IpEnrichment {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as IpEnrichment).ip === "string"
  );
}

export async function fetchEnrichment(
  ips: readonly string[],
): Promise<Map<string, IpEnrichment>> {
  const results = new Map<string, IpEnrichment>();
  if (ips.length === 0) return results;

  try {
    const response = await fetch("/api/enrich", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ips }),
    });

    if (!response.ok) return results;

    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) return results;

    const { data } = payload as { data?: unknown };
    if (!Array.isArray(data)) return results;

    for (const entry of data) {
      if (isIpEnrichment(entry)) results.set(entry.ip, entry);
    }

    return results;
  } catch {
    return results;
  }
}
