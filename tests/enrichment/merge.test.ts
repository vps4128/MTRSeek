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
 *
 * The second thing checked here is which language the place name comes out in.
 * The hop is where the database's per-language answer becomes the one string a
 * row shows, so this is where the choice can be got wrong — and getting it wrong
 * is not a crash but a page quietly reading in the wrong language, which is why
 * each entry of the fallback chain is asserted separately.
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
    country: { en: "Australia", zh: "澳大利亚" },
    countryCode: "AU",
    region: { en: "New South Wales", zh: "新南威尔士州" },
    city: { en: "Sydney", zh: "悉尼" },
    latitude: -33.494,
    longitude: 143.2104,
    accuracyRadius: 1000,
  },
};

describe("folding a lookup into a hop", () => {
  it("leaves every measurement exactly as the parser wrote it", () => {
    const enriched = applyEnrichment(MEASURED, ANSWER, "zh");

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
    const enriched = applyEnrichment(MEASURED, ANSWER, "zh");

    expect(enriched.asn).toEqual({
      number: 13335,
      organization: "Cloudflare, Inc.",
    });
    expect(enriched.location).toEqual({
      country: "澳大利亚",
      region: "新南威尔士州",
      city: "悉尼",
    });
    // The ASN is not a name the database translates, so it is the same string
    // whatever the page is written in.
    expect(enriched.asn?.organization).toBe("Cloudflare, Inc.");
  });

  it("falls back to the English name when the database has no other", () => {
    // A country-level answer arrives in `en` alone. Showing the em dash for it
    // would be throwing away a fact the database did state — and this is the
    // case that keeps `en` among the languages a name is read in even though
    // the app is offered in Chinese only.
    const englishOnly = applyEnrichment(
      MEASURED,
      { ip: "1.1.1.1", geo: { country: { en: "Australia" } } },
      "zh",
    );

    expect(englishOnly.location).toEqual({ country: "Australia" });
  });

  it("shows nothing at all when the record names the place in no language", () => {
    // The end of the chain. `location` is undefined rather than a location with
    // a missing part, which is the same shape a database that answered nothing
    // produces — and the row prints the same em dash for both.
    const unnamed = applyEnrichment(
      MEASURED,
      { ip: "1.1.1.1", geo: { country: {} } },
      "zh",
    );

    expect(unnamed.location).toBeUndefined();
  });

  it("keeps the coordinates off the hop", () => {
    // The coordinates belong to the IP lookup page, and the hop is not where
    // they are kept. A latitude on a hop would be a number nothing renders and
    // everything downstream could mistake for a property of the router.
    const enriched = applyEnrichment(MEASURED, ANSWER, "zh");

    expect(enriched.location).not.toHaveProperty("latitude");
    expect(enriched.location).not.toHaveProperty("accuracyRadius");
    expect(enriched.location).not.toHaveProperty("countryCode");
    expect(Object.keys(enriched.location ?? {})).toEqual([
      "country",
      "region",
      "city",
    ]);
  });

  it("returns the parser's own hop when there was no answer", () => {
    // Identity, not equality: a hop nobody looked up is the very object that
    // came out of the parser, so there is no copy for a field to drift into.
    expect(applyEnrichment(MEASURED, undefined, "zh")).toBe(MEASURED);
  });

  it("shows nothing rather than an empty location", () => {
    // A database that knows only a country code has nothing the Location
    // column can print, so the hop carries no location at all rather than a
    // location with all three parts missing.
    const codeOnly = applyEnrichment(
      MEASURED,
      { ip: "1.1.1.1", geo: { countryCode: "AU" } },
      "zh",
    );
    expect(codeOnly.location).toBeUndefined();

    const nothing = applyEnrichment(MEASURED, { ip: "1.1.1.1" }, "zh");
    expect(nothing.location).toBeUndefined();
    expect(nothing.asn).toBeUndefined();
  });

  it("names a territory the way this app is to name it", () => {
    // The second page that shows a country, and the reason the choice lives in
    // one shared function rather than in either page: `applyEnrichment` and the
    // IP lookup both call `localizeCountry`, so a hop and a lookup cannot spell
    // the same territory two different ways.
    const hk: IpEnrichment = {
      ip: "1.1.1.1",
      geo: { countryCode: "HK", country: { en: "Hong Kong", zh: "香港" } },
    };
    const tw: IpEnrichment = {
      ip: "1.1.1.1",
      geo: { countryCode: "TW", country: { en: "Taiwan", zh: "台湾" } },
    };

    expect(applyEnrichment(MEASURED, hk, "zh").location).toEqual({
      country: "中国香港",
    });
    expect(applyEnrichment(MEASURED, tw, "zh").location).toEqual({
      country: "中国台湾",
    });
  });

  it("adds exactly two fields, and no third to hold a provider name", () => {
    // §3 used to be a rule enforced here: the ASN organization reads like an
    // ISP name (`China Telecom`), and copying it into an ISP field was the
    // substitution to refuse. There is no such field any more, so the
    // substitution is not expressible — a hop carries an `asn` and a
    // `location`, and nowhere else for an operator name to go. What is still
    // worth checking is that those two are all the merge adds.
    const enriched = applyEnrichment(MEASURED, ANSWER, "zh");

    expect(Object.keys(enriched).sort()).toEqual(
      [...Object.keys(MEASURED), "asn", "location"].sort(),
    );
    expect(enriched.asn?.organization).toBe("Cloudflare, Inc.");
  });
});
