import { describe, expect, it, vi } from "vitest";

import { enrichIps } from "@/lib/enrichment/service";
import type { EnrichmentProvider, IpEnrichment } from "@/lib/enrichment/types";

/**
 * What reaches the provider, and in what order the answers come back.
 *
 * These are the guarantees the service exists to make, and none of them can be
 * checked from a page: whether an address was looked up once or five times, and
 * whether a private address was looked up at all, are both invisible in the
 * rendered table. So the provider is a recorder here — the assertions are
 * mostly about the calls it did and did not receive, rather than about the map
 * that came out.
 */

/** A provider that answers for the addresses it was given, and remembers. */
function recorder(
  answer: (ip: string) => IpEnrichment,
  options: { fail?: boolean } = {},
) {
  const calls: string[][] = [];

  const provider: EnrichmentProvider = {
    name: "recorder",
    async enrich(ip) {
      return answer(ip);
    },
    async enrichMany(ips) {
      calls.push([...ips]);
      if (options.fail) throw new Error("database is unreadable");
      return new Map(ips.map((ip) => [ip, answer(ip)]));
    },
  };

  return { provider, calls };
}

describe("the enrichment service", () => {
  it("asks about each address exactly once", () => {
    // A trace crosses the same router twice, and an MTR run prints a hop per
    // probe. §24: the provider is asked once per distinct address.
    const { provider, calls } = recorder((ip) => ({ ip }));

    return enrichIps(provider, [
      "1.1.1.1",
      "8.8.8.8",
      "1.1.1.1",
      "8.8.8.8",
      "1.1.1.1",
    ]).then(() => {
      expect(calls).toEqual([["1.1.1.1", "8.8.8.8"]]);
    });
  });

  it("never asks about an address that is not routable", () => {
    // §7: these three columns are em dashes for a private hop, and that is the
    // honest answer rather than a lookup that came back empty.
    const { provider, calls } = recorder((ip) => ({ ip }));

    return enrichIps(provider, [
      "10.0.0.1",
      "192.168.1.1",
      "172.16.0.1",
      "127.0.0.1",
      "fe80::1",
      "::1",
      "not-an-ip",
      "",
    ]).then((results) => {
      expect(calls).toEqual([]);
      expect(results.size).toBe(0);
    });
  });

  it("keeps the order the trace mentioned the addresses in", () => {
    // §12. The map's key order is the order the caller will read it in, and it
    // is built from the request rather than from whatever order the provider
    // happened to answer in.
    const provider: EnrichmentProvider = {
      name: "out-of-order",
      async enrich(ip) {
        return { ip };
      },
      async enrichMany(ips) {
        // Deliberately answers backwards, which a concurrent implementation
        // would be entitled to do.
        return new Map([...ips].reverse().map((ip) => [ip, { ip }]));
      },
    };

    return enrichIps(provider, ["1.1.1.1", "8.8.8.8", "9.9.9.9"]).then(
      (results) => {
        expect([...results.keys()]).toEqual(["1.1.1.1", "8.8.8.8", "9.9.9.9"]);
      },
    );
  });

  it("treats a skipped address as one with nothing to report", () => {
    // A provider that returns fewer entries than it was asked about must not
    // cause a key to appear for an address nobody looked up.
    const provider: EnrichmentProvider = {
      name: "partial",
      async enrich(ip) {
        return { ip };
      },
      async enrichMany(ips) {
        return new Map(
          ips.filter((ip) => ip === "8.8.8.8").map((ip) => [ip, { ip }]),
        );
      },
    };

    return enrichIps(provider, ["1.1.1.1", "8.8.8.8"]).then((results) => {
      expect([...results.keys()]).toEqual(["8.8.8.8"]);
    });
  });

  it("answers with an empty map rather than throwing when the provider fails", () => {
    // §7: a lookup that cannot run leaves its hops showing em dashes. The page
    // is unaffected, so the failure stops here.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { provider } = recorder((ip) => ({ ip }), { fail: true });

    return enrichIps(provider, ["1.1.1.1"]).then((results) => {
      expect(results.size).toBe(0);
      // Logged once for the batch, not once per address.
      expect(logged).toHaveBeenCalledTimes(1);
      logged.mockRestore();
    });
  });

  it("does not call the provider for an empty request", async () => {
    const { provider, calls } = recorder((ip) => ({ ip }));

    await expect(enrichIps(provider, [])).resolves.toEqual(new Map());
    expect(calls).toEqual([]);
  });

  it("carries whatever the provider answered through unchanged", async () => {
    const { provider } = recorder((ip) => ({
      ip,
      asn: { number: 13335, organization: "Cloudflare, Inc." },
      geo: {
        country: { en: "Australia", zh: "澳大利亚" },
        countryCode: "AU",
        city: { en: "Sydney" },
      },
    }));

    const results = await enrichIps(provider, ["1.1.1.1"]);
    expect(results.get("1.1.1.1")).toEqual({
      ip: "1.1.1.1",
      asn: { number: 13335, organization: "Cloudflare, Inc." },
      geo: {
        country: { en: "Australia", zh: "澳大利亚" },
        countryCode: "AU",
        city: { en: "Sydney" },
      },
    });
  });
});
