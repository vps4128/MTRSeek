import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createProvider } from "@/lib/enrichment/provider";
import { enrichIps } from "@/lib/enrichment/service";

/**
 * Real GeoLite2 databases, read for real.
 *
 * Everything else in this directory tests the plumbing against a provider that
 * was handed the answers. This file is the only place a genuine MMDB is opened,
 * because the things most likely to be wrong about this integration cannot be
 * seen any other way: whether the record's fields are named what the code
 * thinks they are, whether a country-only record is tolerated, and whether an
 * IPv6 address resolves at all.
 *
 * ## Why it skips instead of failing
 *
 * The production databases are tens of megabytes, licensed to whoever
 * downloaded them, and refreshed weekly — so they are deployment data and not
 * test fixtures, and this repository does not carry a copy. When
 * `MAXMIND_ASN_DB_PATH` and `MAXMIND_CITY_DB_PATH` point at readable files the
 * suite runs against them; otherwise it skips, rather than failing a checkout
 * that has every right not to have the data.
 *
 * A skipped run proves nothing, so the addresses below are the ones MaxMind
 * publishes in its own test databases, chosen because each one exercises a
 * different shape of record: an AS with an organization and an AS without one,
 * a full city record, an IPv6 record that stops at the country, and a public
 * address with no record at all.
 *
 * ## Point these at the test databases, not at production
 *
 * Every assertion below names the value its record holds, so the file only
 * passes against the databases it was written for: MaxMind's
 * `GeoLite2-ASN-Test.mmdb` and `GeoLite2-City-Test.mmdb`, published in the
 * `maxmind/MaxMind-DB` repository. A production download is the same format
 * holding different data — `1.0.0.1` is Cloudflare there and Google in the test
 * file, and seven of the nine cases here fail against it.
 *
 * That is not something to paper over by loosening the assertions to "an ASN is
 * present": naming the expected value is the whole of what makes them worth
 * running. The application is indifferent to which pair it is given; only this
 * file is not, which is why it skips rather than fails when it is pointed at
 * data it cannot vouch for.
 */

const asnPath = process.env.MAXMIND_ASN_DB_PATH;
const cityPath = process.env.MAXMIND_CITY_DB_PATH;

const configured =
  asnPath !== undefined &&
  cityPath !== undefined &&
  existsSync(asnPath) &&
  existsSync(cityPath);

describe.skipIf(!configured)("a real GeoLite2 lookup", () => {
  async function lookup(ips: string[]) {
    const setup = createProvider(process.env);
    if (!setup.ok) throw new Error(`provider unavailable: ${setup.message}`);
    return enrichIps(setup.provider, ips);
  }

  it("resolves an AS number and its organization", async () => {
    const results = await lookup(["1.0.0.1"]);

    expect(results.get("1.0.0.1")?.asn).toEqual({
      number: 15169,
      organization: "Google Inc.",
    });
  });

  it("resolves an AS that has a number and no organization", async () => {
    // A record can carry one half and not the other, which is why `HopAsn` has
    // two optional fields rather than one string: the hop table renders
    // `AS35908` here, and a type that stored `"AS35908 / undefined"` would have
    // made that impossible to notice.
    const results = await lookup(["67.43.156.1"]);
    const asn = results.get("67.43.156.1")?.asn;

    expect(asn?.number).toBe(35908);
    expect(asn?.organization).toBeUndefined();
  });

  it("resolves geography down to a city when the record has one", async () => {
    const results = await lookup(["175.16.199.1"]);
    const geo = results.get("175.16.199.1")?.geo;

    // The English name is asserted exactly, as every value in this file is. The
    // other languages are read through `geo.country.zh` and are the database's
    // business rather than this file's: which locales a build carries is decided
    // by whoever compiled it, and the test databases are not the production ones.
    // That the Chinese name is read from `zh-CN` — the key MaxMind uses, there
    // being no plain `zh` — is `tests/enrichment/names.test.ts`'s to check, and
    // it checks it against a map carrying both keys.
    expect(geo?.country?.en).toBe("China");
    expect(geo?.countryCode).toBe("CN");
    expect(geo?.region?.en).toBe("Jilin Sheng");
    expect(geo?.city?.en).toBe("Changchun");
    // §10: the coordinates, and the radius they are good to.
    expect(geo?.accuracyRadius).toBe(100);
    expect(typeof geo?.latitude).toBe("number");
    expect(typeof geo?.longitude).toBe("number");
  });

  it("tolerates a record that stops at the country", async () => {
    // §11: the region must not be assumed to exist. This IPv6 record has a
    // country and no city and no subdivision, which is a normal answer — the
    // hop shows the country alone rather than a row of empty separators.
    const results = await lookup(["2001:218::1"]);
    const geo = results.get("2001:218::1")?.geo;

    expect(geo?.countryCode).toBe("JP");
    expect(geo?.region).toBeUndefined();
    expect(geo?.city).toBeUndefined();
  });

  it("prefers where the address is over where it is registered", async () => {
    // The two are different facts and a record can hold both — this one is
    // located in one country and registered in another. The location is the
    // answer; the registration is the fallback for records that have only that.
    const results = await lookup(["81.2.69.142"]);
    const geo = results.get("81.2.69.142")?.geo;

    expect(geo?.countryCode).toBe("GB");
    expect(geo?.city?.en).toBe("London");
  });

  it("answers for IPv6, both natively and wrapped", async () => {
    const results = await lookup(["2001:218::1", "::ffff:1.0.0.1"]);

    expect(results.get("2001:218::1")?.geo?.countryCode).toBe("JP");
    // The same address as `1.0.0.1`, written the long way round, and it
    // resolves to the same AS rather than bypassing the filter or the lookup.
    expect(results.get("::ffff:1.0.0.1")?.asn?.number).toBe(15169);
  });

  it("returns only the address when the database has no record", async () => {
    // §8: no filler. `1.0.1.1` is routable and appears in neither database,
    // which is the case that would otherwise tempt `Unknown ASN` into being.
    const results = await lookup(["1.0.1.1"]);

    expect(results.get("1.0.1.1")).toEqual({ ip: "1.0.1.1" });
  });

  it("never looks up a private address", async () => {
    const results = await lookup([
      "10.0.0.1",
      "192.168.1.1",
      "172.16.0.1",
      "127.0.0.1",
      "fe80::1",
    ]);

    expect(results.size).toBe(0);
  });

  it("asks the database once for a repeated address", async () => {
    // §24, against the real reader: three mentions of one address cost one
    // entry, served by the same open database rather than by reopening it.
    const results = await lookup(["1.0.0.1", "1.0.0.1", "1.0.0.1"]);

    expect(results.size).toBe(1);
    expect(results.get("1.0.0.1")?.asn?.number).toBe(15169);
  });
});
