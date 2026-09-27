import { describe, expect, it } from "vitest";

import {
  FALLBACK_LOCALE,
  localizeCountry,
  localizeName,
  readNames,
  type GeoName,
} from "@/lib/enrichment/names";

/**
 * Which name a reader sees, and what happens when there is not one.
 *
 * The lookup hands on every language the database was compiled with and the hop
 * table prints exactly one, so this module is the whole of that decision. The
 * cases below are the shapes an MMDB `names` map actually takes: several
 * languages, a language this app does not read, a key with nothing in it, and a
 * place the record names in no language at all.
 *
 * ## Why the English cases stayed after the English pages went
 *
 * The app is Chinese and only Chinese, but `en` is not a language it is offered
 * in — it is the one key an MMDB build is guaranteed to carry, and so the
 * fallback for every region, city and small territory MaxMind never translated.
 * Those cases are the ones that fail if someone decides the two ideas are the
 * same idea and narrows `GeoName` down to the app's own locale.
 *
 * ## Why the Chinese case is spelled out
 *
 * MaxMind's databases key Chinese as `zh-CN`, and there is no plain `zh` among
 * the eight locales they compile — a lookup that asked for `zh` would find
 * nothing and answer with the English name, which reads as data rather than as
 * the bug it is. The first test therefore hands the reader a map carrying *both*
 * keys and requires the `zh-CN` one, so a future edit to the table that looks
 * harmless fails here.
 */

/** `names` is a plain string map in the database; only these two are read. */
function names(entries: Record<string, string>): Record<string, string> {
  return entries;
}

describe("reading the languages this app reads out of a names map", () => {
  it("reads Chinese from zh-CN, not from a zh key", () => {
    // Both keys are present, as they would be in a database that also carried a
    // second Chinese locale. Only one of them is MaxMind's.
    const read = readNames(
      names({ en: "China", zh: "中國", "zh-CN": "中国", ja: "中国" }),
    );

    expect(read).toEqual({ en: "China", zh: "中国" });
  });

  it("keeps only the languages the app reads", () => {
    // Eight locales is what MaxMind compiles; two of them are read here. The
    // rest are dropped rather than carried along, so nothing downstream has to
    // know which of the eight it is looking at.
    const read = readNames(
      names({
        de: "China",
        en: "China",
        es: "China",
        fr: "Chine",
        ja: "中国",
        "pt-BR": "China",
        ru: "Китай",
        "zh-CN": "中国",
      }),
    );

    expect(Object.keys(read ?? {})).toEqual(["en", "zh"]);
  });

  it("answers with nothing when the record names no language the app shows", () => {
    // A database rebuilt without `en` is possible and is exactly the case the
    // absent field exists for: an English name would have to be invented here.
    expect(readNames(names({ ja: "日本", ru: "Япония" }))).toBeUndefined();
  });

  it("answers with nothing for a record that has no names at all", () => {
    expect(readNames(undefined)).toBeUndefined();
    expect(readNames(names({}))).toBeUndefined();
  });

  it("treats a blank name as the database having said nothing", () => {
    // A whitespace-only entry is not a name, and printing it would leave a
    // location reading ` ·  · ` rather than the em dash it should show.
    expect(readNames(names({ en: "   ", "zh-CN": "\t\n" }))).toBeUndefined();
    expect(readNames(names({ en: " China ", "zh-CN": "" }))).toEqual({
      en: "China",
    });
  });

  it("trims a name the database padded", () => {
    expect(readNames(names({ en: " China ", "zh-CN": " 中国 " }))).toEqual({
      en: "China",
      zh: "中国",
    });
  });
});

describe("choosing the one name a reader sees", () => {
  const BOTH: GeoName = { en: "China", zh: "中国" };

  it("uses the reader's language when the database has it", () => {
    expect(localizeName(BOTH, "zh")).toBe("中国");
  });

  it("falls back to English when the reader's language is missing", () => {
    // The case that keeps `en` in `NameLanguage` now that the app is Chinese
    // only: a region or a city MaxMind never translated has no `zh-CN` entry
    // and does have this one, and an em dash for every one of them would be a
    // worse answer than the database's own English name.
    expect(localizeName({ en: "Australia" }, "zh")).toBe("Australia");
    expect(localizeName({ en: "Central and Western" }, "zh")).toBe(
      "Central and Western",
    );
  });

  it("shows nothing for a place with no name to show", () => {
    expect(localizeName(undefined, "zh")).toBeUndefined();
    expect(localizeName({}, "zh")).toBeUndefined();
  });

  it("falls back to the one key the format guarantees", () => {
    // A guard on the constant rather than on a case: the fallback is only worth
    // having if it is the key every MMDB build carries, which is the whole
    // reason it is `en` and not a preference between languages.
    expect(FALLBACK_LOCALE).toBe("en");
  });
});

describe("the country names that are not the database's", () => {
  /** MaxMind's own answer for each territory, in both keys it compiles. */
  const HONG_KONG: GeoName = { en: "Hong Kong", zh: "香港" };
  const MACAU: GeoName = { en: "Macao", zh: "澳门" };
  const TAIWAN: GeoName = { en: "Taiwan", zh: "台湾" };

  it("reads each territory the way this app is to say it", () => {
    expect(localizeCountry(HONG_KONG, "HK", "zh")).toBe("中国香港");
    expect(localizeCountry(MACAU, "MO", "zh")).toBe("中国澳门");
    expect(localizeCountry(TAIWAN, "TW", "zh")).toBe("中国台湾");
  });

  it("answers from the table even when the record carries no name", () => {
    // The code is what the table is keyed on, and the code is a separate fact
    // from the name — so a record that resolved a code and nothing finer still
    // identifies the territory.
    expect(localizeCountry(undefined, "HK", "zh")).toBe("中国香港");
    expect(localizeCountry(undefined, "MO", "zh")).toBe("中国澳门");
    expect(localizeCountry(undefined, "TW", "zh")).toBe("中国台湾");
  });

  it("keys on the ISO code and not on the name", () => {
    // A record naming Hong Kong under some other code is not this territory as
    // far as this table is concerned, and is left exactly as the database
    // spells it. Matching on the name would make the table a filter over text,
    // which is a different and much larger thing than the three entries it
    // holds.
    expect(localizeCountry(HONG_KONG, "CN", "zh")).toBe("香港");
    expect(localizeCountry(HONG_KONG, undefined, "zh")).toBe("香港");
  });

  it("leaves every other country as the database spells it", () => {
    // Three entries, and an entry is not a policy: a code the table does not
    // name is the database's own answer, which is the Chinese one it was
    // compiled with or the English one it guarantees.
    expect(
      localizeCountry({ en: "Australia", zh: "澳大利亚" }, "AU", "zh"),
    ).toBe("澳大利亚");
    expect(localizeCountry({ en: "Singapore" }, "SG", "zh")).toBe("Singapore");
  });

  it("is a country-only rule", () => {
    // The table is applied to the country field and to nothing else. A region
    // that happens to read the same is a different field, and the chain below
    // is the one the region and the city go through unchanged.
    const area: GeoName = { en: "Hong Kong", zh: "香港" };

    expect(localizeName(area, "zh")).toBe("香港");
  });

  it("still answers nothing when there is no name and no code", () => {
    expect(localizeCountry(undefined, undefined, "zh")).toBeUndefined();
    expect(localizeCountry({}, "AU", "zh")).toBeUndefined();
  });
});
