import { NextResponse } from "next/server";

import { createProvider } from "@/lib/enrichment/provider";
import { enrichIps } from "@/lib/enrichment/service";

/**
 * `POST /api/enrich` — attribution for a list of addresses.
 *
 * The browser sends the addresses a trace mentioned; the server answers with
 * whatever the GeoIP databases know about them. It is a route rather than a
 * client-side lookup because the databases are files on the server: there is no
 * browser API for reading an MMDB, and shipping one to the client would mean
 * sending tens of megabytes to every reader to answer a question about a dozen
 * addresses.
 *
 * ## Why the request body is exactly one key
 *
 * §25: this must not become an open door to arbitrary outbound requests. The
 * danger is not the addresses themselves — they are validated and used as
 * lookup keys, never fetched — it is that a route which forwards to "a source"
 * is one refactor away from forwarding to a source the caller chose. So the
 * shape is fixed at `{ "ips": [...] }`, an unexpected key is a rejection rather
 * than something ignored, and there is no `url`, `endpoint`, `callback` or
 * `proxy` parameter to grow into. A request that carries one of those names is
 * refused by the same check that refuses a typo, which means there is no code
 * path where such a value is read at all.
 *
 * ## Why a missing database is a 503 and not an empty 200
 *
 * An empty `data` array is a true answer to "what do you know about these
 * addresses" only when the lookup ran. When no database is configured the
 * question was never asked, and returning `{"data": []}` would claim a negative
 * result from a lookup that did not happen — the same failure mode as an
 * invented ASN, one layer further out. So the two cases are separated: a
 * provider that cannot run is `503` with a message naming what is missing, and
 * a provider that ran and found nothing is `200` with little in it.
 *
 * The page is unaffected either way. It treats a failed request exactly like an
 * absent answer — the hops still render, with em dashes where the attribution
 * would be — so §14's requirement that a missing database not break the app
 * holds across the network boundary too.
 */

/** Node, not Edge: the lookup reads files with `node:fs`. */
export const runtime = "nodejs";

/**
 * The most addresses one request may carry.
 *
 * A cap exists so the route cannot be handed a hundred thousand addresses and
 * asked to walk a tree for each. It is set well above any real trace: the
 * parsers read at most 64 hops in practice, an MTR run to a distant target is
 * typically under 30, and the duplicates within one trace are removed before
 * any lookup. 256 leaves room for a caller batching several traces while
 * keeping the work for one request bounded and small.
 */
const MAX_IPS = 256;

/** Bad input, in the same envelope as a provider error. */
function badRequest(code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status: 400 });
}

/**
 * The addresses from a request body, or `null` if it is not that shape.
 *
 * Deliberately strict. `Object.keys(body).length !== 1` is what refuses an
 * unexpected field, and it costs nothing: `{"ips": [...]}` is the whole
 * contract, so anything else is a caller that has not read it.
 */
function readIps(body: unknown): string[] | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }

  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "ips") return null;

  const { ips } = body as { ips: unknown };
  if (!Array.isArray(ips)) return null;
  if (ips.some((ip) => typeof ip !== "string")) return null;

  return ips;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("INVALID_BODY", "Request body must be JSON.");
  }

  const ips = readIps(body);
  if (ips === null) {
    return badRequest(
      "INVALID_BODY",
      'Request body must be exactly { "ips": [ ... ] }.',
    );
  }

  if (ips.length > MAX_IPS) {
    return badRequest(
      "TOO_MANY_IPS",
      `At most ${MAX_IPS} addresses may be looked up in one request.`,
    );
  }

  const setup = createProvider();
  if (!setup.ok) {
    return NextResponse.json(
      { error: { code: setup.code, message: setup.message } },
      { status: 503 },
    );
  }

  try {
    const results = await enrichIps(setup.provider, ips);
    // Insertion order, which the service built by walking the request — so a
    // reader comparing a response against a trace sees the addresses in the
    // order the trace mentioned them. Addresses with nothing to report are
    // absent rather than present-and-empty (§8).
    return NextResponse.json({ data: [...results.values()] });
  } catch (error) {
    console.error("[enrichment] request failed", error);
    return NextResponse.json(
      {
        error: {
          code: "ENRICHMENT_FAILED",
          message: "The enrichment lookup failed.",
        },
      },
      { status: 500 },
    );
  }
}
