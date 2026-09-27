import { describe, expect, it } from "vitest";

import type { Hop } from "@/lib/analysis/types";
import { applyEnrichment } from "@/lib/enrichment/merge";
import type { IpEnrichment } from "@/lib/enrichment/types";

/**
 * Where a looked-up fact is allowed to land on a hop.
 *
 * §18 states the rule from the outside — enrichment must not touch Loss, RTT,
 * Hostname, Hop index or the address, and must not take part in any
 * measurement. This file checks the rule as a property of every hop shape
 * rather than of one example, because the failure it guards against is a
 * measurement quietly changing value.
 */

const MEASURED: Hop = {
  index: 4,
  ip: "1.1.1.1",
  hostname: "one.one.one.one",
  loss: 0,
  last: 1.345,
  avg: 1.234,
  best: 1.123,
  worst: 1.456,
  stddev: 0.1,
};

const ANSWER: IpEnrichment = {
  ip: "1.1.1.1",
  asn: { number: 13335, organization: "Cloudflare, Inc." },
  geo: {
    country: "Australia",
    countryCode: "AU",
    region: "New South Wales",
    city: "Sydney",
    latitude: -33.494,
    longitude: 143.2104,
    accuracyRadius: 1000,
  },
};

describe("folding a lookup into a hop", () => {
  it("leaves every measurement exactly as the parser wrote it", () => {
    const enriched = applyEnrichment(MEASURED, ANSWER);

    for (const field of [
      "index",
      "ip",
      "hostname",
      "loss",
      "last",
      "avg",
      "best",
      "worst",
      "stddev",
    ] as const) {
      expect(enriched[field], `${field} was changed by a lookup`).toBe(
        MEASURED[field],
      );
    }
  });

  it("carries the attribution the lookup found", () => {
    const enriched = applyEnrichment(MEASURED, ANSWER);

    expect(enriched.asn).toEqual({
      number: 13335,
      organization: "Cloudflare, Inc.",
    });
    expect(enriched.location).toEqual({
      country: "Australia",
      region: "New South Wales",
      city: "Sydney",
    });
  });

  it("keeps the coordinates off the hop", () => {
    // §19 keeps the coordinates for a future map, and the hop is not where they
    // are kept. A latitude on a hop would be a number nothing renders and
    // everything downstream could mistake for a property of the router.
    const enriched = applyEnrichment(MEASURED, ANSWER);

    expect(enriched.location).not.toHaveProperty("latitude");
    expect(enriched.location).not.toHaveProperty("accuracyRadius");
    expect(Object.keys(enriched.location ?? {})).toEqual([
      "country",
      "region",
      "city",
    ]);
  });

  it("returns the parser's own hop when there was no answer", () => {
    // Identity, not equality: a hop nobody looked up is the very object that
    // came out of the parser, so there is no copy for a field to drift into.
    expect(applyEnrichment(MEASURED, undefined)).toBe(MEASURED);
  });

  it("shows nothing rather than an empty location", () => {
    // A database that knows only a country code has nothing the Location
    // column can print, so the hop carries no location at all rather than a
    // location with all three parts missing.
    const codeOnly = applyEnrichment(MEASURED, {
      ip: "1.1.1.1",
      geo: { countryCode: "AU" },
    });
    expect(codeOnly.location).toBeUndefined();

    const nothing = applyEnrichment(MEASURED, { ip: "1.1.1.1" });
    expect(nothing.location).toBeUndefined();
    expect(nothing.asn).toBeUndefined();
    expect(nothing.isp).toBeUndefined();
  });

  it("never invents an ISP from the ASN organization", () => {
    // §3, and the single most tempting substitution in this codebase: the
    // organization is right there and reads like an ISP name. It is not one.
    const enriched = applyEnrichment(MEASURED, ANSWER);

    expect(enriched.isp).toBeUndefined();
    expect(enriched.isp).not.toBe(ANSWER.asn?.organization);
  });

  it("takes an ISP only when the provider states one", () => {
    const withIsp = applyEnrichment(MEASURED, {
      ip: "1.1.1.1",
      isp: "Example Broadband",
      asn: { number: 64500, organization: "Example Network" },
    });

    expect(withIsp.isp).toBe("Example Broadband");
    expect(withIsp.asn?.organization).toBe("Example Network");
  });
});
