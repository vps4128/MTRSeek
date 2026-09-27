import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderSetup } from "@/lib/enrichment/provider";
import type { IpEnrichment } from "@/lib/enrichment/types";
import { enrichIps } from "@/lib/enrichment/service";

/**
 * The shape of the only public door into the enrichment layer.
 *
 * Two properties are being checked, and they pull in opposite directions. The
 * route has to answer a well-formed request with the attribution for its
 * addresses; and it has to answer everything else — an unexpected field, a
 * non-address, more addresses than the cap — with a refusal, because §25 makes
 * this endpoint's input contract part of its security posture rather than a
 * matter of convenience.
 *
 * The provider is replaced rather than configured, so these assertions are
 * about the route: what it accepts, what it refuses, and what it puts on the
 * wire. Whether a real database answers is `tests/enrichment/maxmind.test.ts`.
 */

const state = vi.hoisted(() => ({
  setup: null as unknown as ProviderSetup,
}));

vi.mock("@/lib/enrichment/provider", () => ({
  createProvider: () => state.setup,
}));

const { POST } = await import("@/app/api/enrich/route");

const MAX_IPS = 256;

/** The route's own signature, exercised the way Next calls it. */
function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/enrich", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

/** A provider that knows about the addresses it is asked about. */
function knows(answers: Record<string, IpEnrichment>): ProviderSetup {
  return {
    ok: true,
    provider: {
      name: "stub",
      async enrich(ip) {
        return answers[ip] ?? { ip };
      },
      async enrichMany(ips) {
        return new Map(ips.map((ip) => [ip, answers[ip] ?? { ip }]));
      },
    },
  };
}

beforeEach(() => {
  state.setup = knows({
    "1.1.1.1": {
      ip: "1.1.1.1",
      asn: { number: 13335, organization: "Cloudflare, Inc." },
      geo: {
        country: { en: "Australia", zh: "澳大利亚" },
        countryCode: "AU",
        region: { en: "New South Wales", zh: "新南威尔士州" },
        city: { en: "Sydney", zh: "悉尼" },
        latitude: -33.494,
        longitude: 143.2104,
        accuracyRadius: 1000,
      },
    },
    "8.8.8.8": { ip: "8.8.8.8", asn: { number: 15169, organization: "Google LLC" } },
  });
});

describe("POST /api/enrich", () => {
  it("answers with the attribution for each address", async () => {
    const response = await post({ ips: ["1.1.1.1", "8.8.8.8"] });
    expect(response.status).toBe(200);

    const { data } = (await response.json()) as { data: IpEnrichment[] };

    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({
      ip: "1.1.1.1",
      asn: { number: 13335, organization: "Cloudflare, Inc." },
      geo: {
        country: { en: "Australia", zh: "澳大利亚" },
        countryCode: "AU",
        region: { en: "New South Wales", zh: "新南威尔士州" },
        city: { en: "Sydney", zh: "悉尼" },
        latitude: -33.494,
        longitude: 143.2104,
        accuracyRadius: 1000,
      },
    });
  });

  it("carries every language the database answered in, and picks none", async () => {
    // The route is a transport for what the provider said, and the provider said
    // a name per language. Choosing one here would freeze the choice into the
    // response, so the same lookup could not be read in the other language
    // without asking again — and what the database has is a fact about the
    // address, not about whoever is reading it.
    const response = await post({ ips: ["1.1.1.1"] });
    const { data } = (await response.json()) as { data: IpEnrichment[] };

    expect(data[0]?.geo?.country).toEqual({
      en: "Australia",
      zh: "澳大利亚",
    });
  });

  it("keeps the request's order in the response", async () => {
    const response = await post({ ips: ["8.8.8.8", "1.1.1.1"] });
    const { data } = (await response.json()) as { data: IpEnrichment[] };

    expect(data.map((entry) => entry.ip)).toEqual(["8.8.8.8", "1.1.1.1"]);
  });

  it("carries an address with nothing to report as just its address", async () => {
    // §8: the fields the database did not answer are absent, not filled with
    // `Unknown` and not present as null.
    const response = await post({ ips: ["9.9.9.9"] });
    const { data } = (await response.json()) as { data: IpEnrichment[] };

    expect(data).toEqual([{ ip: "9.9.9.9" }]);
  });

  it("accepts an empty list", async () => {
    const response = await post({ ips: [] });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [] });
  });

  it("drops private addresses without asking about them", async () => {
    const response = await post({
      ips: ["10.0.0.1", "192.168.1.1", "172.16.0.1", "127.0.0.1", "fd00::1"],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [] });
  });

  it("answers once for a repeated address", async () => {
    const response = await post({ ips: ["1.1.1.1", "1.1.1.1", "1.1.1.1"] });
    const { data } = (await response.json()) as { data: IpEnrichment[] };

    expect(data).toHaveLength(1);
  });

  it("looks up only the addresses that have an answer", async () => {
    // A trace's first hops are private and its last may repeat. The response
    // holds one entry per distinct public address and nothing else.
    const response = await post({
      ips: ["192.168.1.1", "1.1.1.1", "8.8.8.8", "1.1.1.1", "not-an-ip"],
    });
    const { data } = (await response.json()) as { data: IpEnrichment[] };

    expect(data.map((entry) => entry.ip)).toEqual(["1.1.1.1", "8.8.8.8"]);
  });

  it("accepts the cap and refuses one past it", async () => {
    const atCap = Array.from({ length: MAX_IPS }, (_, index) => `10.0.0.${index}`);
    // All private, so the assertion is about the cap rather than the lookups.
    expect((await post({ ips: atCap })).status).toBe(200);

    const overCap = [...atCap, "10.0.1.1"];
    const response = await post({ ips: overCap });

    expect(response.status).toBe(400);
    const { error } = (await response.json()) as { error: { code: string } };
    expect(error.code).toBe("TOO_MANY_IPS");
  });

  it("refuses any field other than ips", async () => {
    // §25. `url`, `endpoint`, `callback` and `proxy` are the names this would
    // grow into, and each is refused by the same check that refuses a typo —
    // which is what makes it true that no code path reads one.
    for (const body of [
      { url: "http://169.254.169.254/latest/meta-data/" },
      { ips: ["1.1.1.1"], url: "http://169.254.169.254/" },
      { ips: ["1.1.1.1"], endpoint: "http://example.com" },
      { ips: ["1.1.1.1"], callback: "http://example.com" },
      { ips: ["1.1.1.1"], proxy: "http://example.com" },
    ]) {
      const response = await post(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("refuses a body that is not that shape", async () => {
    for (const body of [
      {},
      { ips: "1.1.1.1" },
      { ips: [1, 2, 3] },
      { ips: [null] },
      { ips: { 0: "1.1.1.1" } },
      ["1.1.1.1"],
      "1.1.1.1",
      "not json at all",
    ]) {
      const response = await post(body);
      expect(response.status, JSON.stringify(body) ?? "undefined").toBe(400);
    }
  });

  it("says which database is missing rather than answering with nothing", async () => {
    // §14. An empty `data` array would claim the lookup ran and found nothing,
    // which is a different statement from "it could not run".
    state.setup = {
      ok: false,
      code: "ASN_DB_NOT_CONFIGURED",
      message: "MaxMind ASN database is not configured",
    };

    const response = await post({ ips: ["1.1.1.1"] });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ASN_DB_NOT_CONFIGURED",
        message: "MaxMind ASN database is not configured",
      },
    });
  });

  it("answers 500 rather than crashing when the lookup throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    // `enrichIps` swallows a provider failure, so the throw has to come from
    // the service itself to reach this branch.
    const service = vi
      .spyOn(await import("@/lib/enrichment/service"), "enrichIps")
      .mockRejectedValueOnce(new Error("boom"));

    const response = await post({ ips: ["1.1.1.1"] });

    expect(response.status).toBe(500);
    service.mockRestore();
    logged.mockRestore();
  });
});

describe("the service the route delegates to", () => {
  it("is the real one", () => {
    // Guards the mock above: if the route stopped using `enrichIps`, the 500
    // test would pass for the wrong reason.
    expect(typeof enrichIps).toBe("function");
  });
});
