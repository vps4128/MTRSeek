import type { Locale } from "@/i18n/routing";

/**
 * Place names, in the languages this app reads them in.
 *
 * ## Why a place name is not a string
 *
 * An MMDB `names` map holds one entry per language the database was compiled
 * with — MaxMind's own builds carry eight, and `en` is the only key the format
 * guarantees. A provider that read one language out of that would decide for
 * every reader at once, and decide it somewhere no reader exists: the hop table
 * and the IP lookup would each have to make the same choice again, or inherit
 * whichever of them got there first. So the lookup reads the languages this app
 * can show and `IpGeo` carries them; the choice is made once, at the point
 * where an answer becomes a row.
 *
 * ## The languages a name is read in are not the languages the app is offered in
 *
 * The app is Chinese and nothing else: `Locale` is the single member `"zh"`.
 * `NameLanguage` is not, because what a database carries is a separate fact
 * from what a page is written in. MaxMind's builds key Chinese as `zh-CN` and
 * carry `en` as well, and plenty of records — a region, a city, a small
 * territory — have no `zh-CN` entry at all and an `en` one. Dropping `en` when
 * the English pages went would have taken the fallback with it and printed an
 * em dash for every one of those places. So the two types are deliberately not
 * one, and the difference between them is exactly the fallback.
 *
 * `DATABASE_LOCALE` is a `Record<NameLanguage, …>` rather than a list, so the
 * mapping is exhaustive by construction and a language added to `NameLanguage`
 * without a database key is a compile error. It is taken as a *type*, so the
 * server route that shares this module loads nothing from the i18n layer at
 * runtime.
 *
 * ## The names that are not the database's
 *
 * `localizeCountry` answers a country from a short table of this app's own
 * before it answers from the record, which is the single exception to
 * everything above. It exists because a territory's own name and the way a
 * reader says where it is are two different things, and it is kept to one
 * function rather than spread across the two pages that show a country so that
 * the hop table and the IP lookup cannot disagree about the same address.
 *
 * ## What is not a name
 *
 * An ASN organization is not a `names` map. The database has exactly one
 * spelling of `CHINA UNICOM China169 Backbone` and no translation of it, so it
 * passes through `asnFrom` untouched and is never offered to this module. That
 * is the same rule as a place name's, applied to the field that has only one
 * language: nothing here invents a Chinese name for an operator, because the
 * database does not have one.
 */

/**
 * The languages a name can be read as.
 *
 * Wider than `Locale` by exactly one member, and `en` is there for the fallback
 * rather than because the app is offered in it: it is the one key an MMDB
 * `names` map is guaranteed to carry, so a database that dropped every other
 * language still answers in that one.
 */
export type NameLanguage = "zh" | "en";

/**
 * A place name as the database has it, one entry per language.
 *
 * Every language is optional because a database is compiled with whatever
 * locales its builder chose: `zh-CN` is present in MaxMind's official builds
 * and absent from a rebuild that did not ask for it. A name with no entry in the
 * reader's language falls back — see `localizeName`.
 */
export type GeoName = Partial<Record<NameLanguage, string>>;

/**
 * The database key each language above reads.
 *
 * The Chinese key is `zh-CN` and not `zh`: it is what MaxMind compiles into the
 * databases, and asking for `zh` finds nothing and answers with the English
 * name — a failure that looks like data rather than like a bug.
 */
const DATABASE_LOCALE = {
  en: "en",
  zh: "zh-CN",
} as const satisfies Record<NameLanguage, string>;

/**
 * The languages above, in the order the table declares them.
 *
 * `Object.keys` returns `string[]` whatever it is given, and the `satisfies` on
 * the table above is what makes its keys exactly the languages — so this cast
 * says something the compiler already knows and cannot express, rather than
 * asserting something unchecked.
 */
const LANGUAGES = Object.keys(DATABASE_LOCALE) as NameLanguage[];

/**
 * The language a name falls back to when it has none in the reader's.
 *
 * `en`, because it is the one key the MMDB format guarantees: a database that
 * dropped every other locale still has it. That is the whole reason — this is
 * not a preference between languages but the only entry that can be relied on to
 * be there, which is why the chain ends here rather than continuing into one.
 */
export const FALLBACK_LOCALE: NameLanguage = "en";

/**
 * An MMDB `names` map, narrowed to the languages read here.
 *
 * Structural and closed rather than an index signature, so reading a key the
 * table does not name is a compile error rather than an `undefined` at runtime.
 */
type DatabaseNames = Readonly<
  Partial<Record<(typeof DATABASE_LOCALE)[NameLanguage], string>>
>;

/**
 * Reads the languages this app reads out of an MMDB `names` map.
 *
 * Answers `undefined` — rather than an empty map — when the record names the
 * place in none of them, so that "the database said nothing" and "the database
 * said it in a language this app does not read" both arrive at a hop as an
 * absent field. A name that is present and blank is treated the same way: it is
 * not a name, and putting it on screen would leave a location reading ` ·  · `.
 */
export function readNames(
  names: DatabaseNames | undefined,
): GeoName | undefined {
  if (names === undefined) return undefined;

  const name: GeoName = {};
  for (const language of LANGUAGES) {
    const value = names[DATABASE_LOCALE[language]]?.trim();
    if (value) name[language] = value;
  }

  return Object.keys(name).length === 0 ? undefined : name;
}

/**
 * The one name to show for a place: the reader's language, then `en`, then
 * nothing.
 *
 * Nothing is a real answer, and the caller already has a way to print it — an em
 * dash, the same one a place the database never mentioned gets. The chain stops
 * there because everything past it would be this app's own work: transliterating
 * a name, deriving one from a country code, or showing the reader a language
 * they did not ask for under the heading of the one they did. The database's
 * English name is a fact; a Chinese name this app assembled is not.
 */
export function localizeName(
  name: GeoName | undefined,
  locale: Locale,
): string | undefined {
  return name?.[locale] ?? name?.[FALLBACK_LOCALE];
}

/**
 * The territories the database files under a code of their own and this app
 * does not.
 *
 * The database answers with the territory's own name, and the territory's own
 * name is not the whole of how a reader of this app says where it is. MaxMind
 * holds `香港`, `澳门` and `台湾` under `zh-CN`; the page is to read `中国香港`,
 * `中国澳门` and `中国台湾`.
 *
 * Keyed by ISO code rather than by name, because the code is the stable half:
 * a name is the thing this table exists to replace, and a later build of the
 * database is free to respell it. It is applied to the country and to nothing
 * else — a region or a city that happens to share the name is a different
 * field, and neither is a territory.
 *
 * Three entries, and an entry is not a policy: this table holds the claims this
 * app has been asked to make and no others, and a country code that is not one
 * of them is left exactly as the database spells it. Only the Chinese name is
 * written out, because only Chinese is read here; the fallback still supplies
 * the database's own name for anything this table does not name.
 */
const SOVEREIGN_NAMES: Readonly<Partial<Record<string, GeoName>>> = {
  HK: { zh: "中国香港" },
  MO: { zh: "中国澳门" },
  TW: { zh: "中国台湾" },
};

/**
 * The country a reader sees: the name above where there is one, and the
 * database's own where there is not.
 *
 * The two are chained rather than merged, and the chain works because
 * `localizeName` answers `undefined` for a language a `GeoName` has no entry
 * in — a code this table does not name falls straight through to the record.
 *
 * The code is a separate argument because it is a separate fact: a database
 * that resolved a code and no name is a real answer, and it still identifies
 * the territory.
 */
export function localizeCountry(
  name: GeoName | undefined,
  countryCode: string | undefined,
  locale: Locale,
): string | undefined {
  const sovereign =
    countryCode === undefined ? undefined : SOVEREIGN_NAMES[countryCode];

  return localizeName(sovereign, locale) ?? localizeName(name, locale);
}
