import { describe, expect, it, vi } from "vitest";

import { lookupIpAddress } from "@/lib/enrichment/lookup";
import type { ProviderSetup } from "@/lib/enrichment/provider";
import type { EnrichmentProvider, IpEnrichment } from "@/lib/enrichment/types";

/**
 * What one address comes back as, and why "nothing" is several different
 * answers.
 *
 * The page under the form renders one message per outcome, so this file is
 * where the distinctions are actually made or lost. Two of them are easy to
 * merge by accident and are the reason the module exists: an address the
 * databases have never heard of is a fact about the address, and a server with
 * no databases is a fact about the server. Both produce an empty result, and
 * only one of them is worth the reader's attention.
 *
 * The recorder is here for the assertions a rendered page cannot make — that a
 * typo never reaches the provider, and that a missing database is not reported
 * for an address that was never going to be looked up anyway.
 */

/** A provider that answers for the addresses it was given, and remembers. */
function recorder(answer: (ip: string) => IpEnrichment): {
  setup: ProviderSetup;
  calls: string[];
} {
  const calls: string[] = [];

  const provider: EnrichmentProvider = {
    name: "recorder",
    async enrich(ip) {
      calls.push(ip);
      return answer(ip);
    },
    async enrichMany(ips) {
      return new Map(ips.map((ip) => [ip, answer(ip)]));
    },
  };

  return { setup: { ok: true, provider }, calls };
}

/** Everything the databases know, for an address that has it all. */
const ANSWERED: IpEnrichment = {
  ip: "8.8.8.8",
  asn: { number: 15169, organization: "Google LLC" },
  geo: {
    countryCode: "US",
    country: { en: "United States", zh: "美国" },
    latitude: 37.4056,
    longitude: -122.0775,
    accuracyRadius: 1000,
  },
};

const NO_DATABASE: ProviderSetup = {
  ok: false,
  code: "ASN_DB_NOT_CONFIGURED",
  message: "MAXMIND_ASN_DB_PATH is not set.",
};

describe("an address the reader typed", () => {
  it("says there is nothing to report before anything was typed", async () => {
    // The first visit. Not an error — there is no question yet, and the form is
    // the whole page.
    const { setup, calls } = recorder(() => ANSWERED);

    expect(await lookupIpAddress("", setup)).toEqual({ status: "empty" });
    expect(await lookupIpAddress("   ", setup)).toEqual({ status: "empty" });
    expect(calls).toEqual([]);
  });

  it("tells a malformed address apart from an unrouteable one", async () => {
    // The distinction the whole module exists for. `10.0.0.1` is a perfectly
    // good address that no GeoIP database covers; `8.8.8.8.8` is a typo. They
    // get different messages because they get different fixes.
    const { setup, calls } = recorder(() => ANSWERED);

    for (const typed of ["8.8.8.8.8", "999.1.1.1", "8.8.8.8/24", "example.com"]) {
      expect(await lookupIpAddress(typed, setup), typed).toEqual({
        status: "invalid",
      });
    }

    for (const typed of [
      "10.0.0.1",
      "192.168.1.1",
      "172.16.0.1",
      "127.0.0.1",
      "169.254.1.1",
      "224.0.0.1",
      "::1",
      "fe80::1",
      "fd00::1",
    ]) {
      expect(await lookupIpAddress(typed, setup), typed).toEqual({
        status: "not-public",
      });
    }

    // None of them was worth the provider's time.
    expect(calls).toEqual([]);
  });

  it("looks up the address it was given, trimmed", async () => {
    // A paste from a terminal or a web page carries whitespace, and the space
    // is not part of the address. The key the provider is asked about is the
    // address, so that is what it must be handed.
    const { setup, calls } = recorder(() => ANSWERED);

    const outcome = await lookupIpAddress("  8.8.8.8\n", setup);

    expect(calls).toEqual(["8.8.8.8"]);
    expect(outcome).toEqual({ status: "found", enrichment: ANSWERED });
  });

  it("answers with whatever half of the record exists", async () => {
    // A record with an operator and no location is common: the ASN database
    // covers more of the address space than the city one does. Neither half is
    // padded out to look like the other, and a record with neither is a third
    // answer of its own.
    const asnOnly = recorder((ip) => ({
      ip,
      asn: { number: 15169, organization: "Google LLC" },
    }));
    const geoOnly = recorder((ip) => ({
      ip,
      geo: { countryCode: "US", country: { en: "United States" } },
    }));
    const nothing = recorder((ip) => ({ ip }));

    expect((await lookupIpAddress("8.8.8.8", asnOnly.setup)).status).toBe(
      "found",
    );
    expect((await lookupIpAddress("8.8.8.8", geoOnly.setup)).status).toBe(
      "found",
    );
    expect(await lookupIpAddress("8.8.8.8", nothing.setup)).toEqual({
      status: "no-record",
      ip: "8.8.8.8",
    });
  });
});

describe("a lookup that cannot be made at all", () => {
  it("reports a missing database rather than an empty answer", async () => {
    // §14 from the other side. "The databases have no record of 8.8.8.8" and
    // "there are no databases" are different sentences, and the second is the
    // one an operator has to see.
    expect(await lookupIpAddress("8.8.8.8", NO_DATABASE)).toEqual({
      status: "unavailable",
      detail: "MAXMIND_ASN_DB_PATH is not set.",
    });
  });

  it("checks the address before it checks the deployment", async () => {
    // A reader who typed something wrong should be told about the typing. Being
    // told about the server's configuration instead would send them looking for
    // a problem that is not theirs and that does not explain nothing appearing.
    expect(await lookupIpAddress("8.8.8.8.8", NO_DATABASE)).toEqual({
      status: "invalid",
    });
    expect(await lookupIpAddress("192.168.1.1", NO_DATABASE)).toEqual({
      status: "not-public",
    });
  });

  it("reports a database that failed on read as unavailable, not as no record", async () => {
    // A file that stat'd cleanly and then could not be read. Reporting this as
    // `no-record` — which is what a batch-oriented lookup would do — would tell
    // the reader the databases have never heard of their address when in fact
    // nobody asked them. The failure is logged, and the page stays up.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider: EnrichmentProvider = {
      name: "broken",
      async enrich() {
        throw new Error("database is unreadable");
      },
      async enrichMany() {
        throw new Error("database is unreadable");
      },
    };

    try {
      expect(
        await lookupIpAddress("8.8.8.8", { ok: true, provider }),
      ).toEqual({ status: "unavailable" });
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });
});
