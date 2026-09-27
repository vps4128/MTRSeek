import { existsSync } from "node:fs";

import type { HopAsn } from "@/lib/analysis/types";

import type { ProviderSetup } from "../provider";
import type { EnrichmentProvider, IpEnrichment, IpGeo } from "../types";
import { openDatabase } from "./database";

import type { AsnResponse, CityResponse } from "maxmind";

/**
 * GeoLite2, read from local MMDB files.
 *
 * ## Local files, not the web service
 *
 * MaxMind also sells a web service, and using it would mean an account, a
 * licence key, a network round trip per address, and a rate limit shared by
 * every reader of this app. The databases are the same data and are already a
 * free download, so the lookup is a file read the process can do for itself.
 * No address a reader pastes leaves the machine it was pasted on, which is the
 * better property to have by accident as well as on purpose.
 *
 * ## Two databases, one answer
 *
 * ASN and geography live in separate files and are queried separately, then
 * merged here. That merge belongs to this adapter rather than to the service
 * because this is the only layer that knows there are two databases at all —
 * the service sees one provider that answers about one address.
 *
 * ## What the free data does not have
 *
 * `isp` stays absent, always. MaxMind's ISP, Connection-Type and Domain traits
 * belong to the paid GeoIP2 products; `GeoLite2-City` has no such field to
 * read. The trait is read if a database is ever built that carries it, which
 * costs one optional access and means a licensed database would light the
 * column up without a code change. What is never done is the substitution that
 * would fill it today — copying `autonomous_system_organization` into it. An AS
 * is an allocation; an ISP is a service sold over it.
 */

type MaxmindConfig = {
  asnPath?: string;
  cityPath?: string;
};

/**
 * The database's English name for a place.
 *
 * `names` carries several languages and marks only `en` as guaranteed — a
 * database is compiled with whatever locales its builder chose, so `zh-CN` is
 * present in MaxMind's official builds and absent from any rebuild that did not
 * ask for it. Reading a fixed language also keeps a given address rendering
 * identically in both of this app's locales, which is what "this is data, not
 * copy" requires: a place name that changed with the interface language would
 * be a translated fact, and the translation would be the invention.
 */
function englishName(names: { en?: string } | undefined): string | undefined {
  const name = names?.en?.trim();
  return name ? name : undefined;
}

function asnFrom(record: AsnResponse): HopAsn | undefined {
  const number = record.autonomous_system_number;
  const organization = record.autonomous_system_organization?.trim();

  if (number === undefined && !organization) return undefined;

  return {
    ...(number === undefined ? {} : { number }),
    ...(organization ? { organization } : {}),
  };
}

/**
 * Geography, as far as the city database resolves it.
 *
 * Every part is optional because the database answers in whatever depth it has
 * for a given range (§11) — a block-level record has a city, a country-level
 * one stops at the country, and neither is an error. The subdivision is read
 * when it is there and skipped when it is not; a database that carries none is
 * normal, not broken.
 */
function geoFrom(record: CityResponse): IpGeo | undefined {
  // Where the address is, falling back to where it is registered. The two are
  // different questions and the fallback is a real one: a range can be used
  // anywhere while being registered to one country, and for a country-level
  // answer the registration is the only thing the database knows. It is used
  // only when the location itself is silent, so it never overrides a better
  // answer with a worse one.
  const country = record.country ?? record.registered_country;

  const countryName = englishName(country?.names);
  const countryCode = country?.iso_code;
  const region = englishName(record.subdivisions?.[0]?.names);
  const city = englishName(record.city?.names);

  const location = record.location;
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const accuracyRadius = location?.accuracy_radius;

  const geo: IpGeo = {
    ...(countryName ? { country: countryName } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...(region ? { region } : {}),
    ...(city ? { city } : {}),
    ...(latitude === undefined ? {} : { latitude }),
    ...(longitude === undefined ? {} : { longitude }),
    ...(accuracyRadius === undefined ? {} : { accuracyRadius }),
  };

  return Object.keys(geo).length === 0 ? undefined : geo;
}

function createMaxmindProvider(config: MaxmindConfig): EnrichmentProvider {
  const { asnPath, cityPath } = config;

  async function enrich(ip: string): Promise<IpEnrichment> {
    // Both databases are consulted at once. A reader is already open after the
    // first request, so these resolve without I/O.
    const [asnRecord, cityRecord] = await Promise.all([
      asnPath === undefined
        ? Promise.resolve(null)
        : openDatabase<AsnResponse>(asnPath).then((reader) => reader.get(ip)),
      cityPath === undefined
        ? Promise.resolve(null)
        : openDatabase<CityResponse>(cityPath).then((reader) => reader.get(ip)),
    ]);

    const enrichment: IpEnrichment = { ip };

    const asn = asnRecord === null ? undefined : asnFrom(asnRecord);
    if (asn !== undefined) enrichment.asn = asn;

    const geo = cityRecord === null ? undefined : geoFrom(cityRecord);
    if (geo !== undefined) enrichment.geo = geo;

    // Read, never derived. `GeoLite2-City` does not carry this trait, so in
    // practice the column stays an em dash — which is the correct answer, not a
    // shortcoming to work around.
    const isp = cityRecord?.traits?.isp?.trim();
    if (isp) enrichment.isp = isp;

    // A record that answered nothing is `{ ip }` and nothing more. No filler
    // string is written for any field: §8 forbids `Unknown ISP`, `Unknown ASN`
    // and `Unknown City` by name, and the general rule is the same one — an
    // absent field is a fact, a placeholder is a lie that renders.
    return enrichment;
  }

  return {
    name: "maxmind",

    enrich,

    /**
     * Looked up concurrently, and a rejection is allowed to escape.
     *
     * The two are separate decisions. Concurrency because the lookups are
     * independent and a trace has as many as it has hops. Letting the rejection
     * out because there is nothing useful to say per address: `reader.get`
     * returns `null` rather than throwing for an address the database has no
     * record of, so by the time something throws it is the database that is
     * broken, and the same failure would be repeated for every address in the
     * batch. The caller decides what a broken provider means — one log line and
     * a page full of em dashes, rather than N identical stack traces.
     */
    async enrichMany(ips: readonly string[]): Promise<Map<string, IpEnrichment>> {
      const answered = await Promise.all(ips.map((ip) => enrich(ip)));
      return new Map(answered.map((enrichment) => [enrichment.ip, enrichment]));
    },
  };
}

/**
 * Builds the provider the app should use, or explains why it cannot.
 *
 * ## Why this is synchronous, and why it checks the files
 *
 * Reading environment variables is not I/O, so this needs no promise — and
 * being able to answer "no" before any work is done is worth more than the
 * tidiness of making it async. §14 asks for a clear error rather than a crash,
 * and the clearest one names which database is missing and says whether it was
 * never configured or configured and not found. That distinction is the whole
 * difference between "you have not set this up yet" and "your path is wrong",
 * and it is available here for the cost of a `stat`.
 *
 * The paths are read from the environment rather than compiled in, so a
 * deployment can put the databases wherever it keeps data — and so that the
 * files, which run to tens of megabytes and are refreshed on MaxMind's
 * schedule, stay out of the repository entirely. `.env.example` names both
 * variables.
 *
 * One database is enough to answer with something. A deployment that has only
 * the ASN file gets ASN columns and em dashes for geography, which is a partial
 * answer and an honest one. Only having neither is a failure.
 */
export function createMaxmindProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ProviderSetup {
  const asnPath = env.MAXMIND_ASN_DB_PATH?.trim() || undefined;
  const cityPath = env.MAXMIND_CITY_DB_PATH?.trim() || undefined;

  if (asnPath === undefined && cityPath === undefined) {
    return {
      ok: false,
      code: "ASN_DB_NOT_CONFIGURED",
      message: "MaxMind ASN database is not configured",
    };
  }

  for (const [label, databasePath] of [
    ["ASN", asnPath],
    ["City", cityPath],
  ] as const) {
    // The path is dynamic on purpose — pointing it at the databases is the
    // whole of the configuration — but the bundler cannot tell a path an
    // operator chose from one the build could follow, so it assumes the worst
    // and traces the entire project into the server output. The comment is its
    // documented opt-out for a read that is known to be runtime-only.
    if (
      databasePath !== undefined &&
      !existsSync(/* turbopackIgnore: true */ databasePath)
    ) {
      // The path is logged rather than returned. It is the operator who needs
      // it, and the reader being shown the message has no use for a filesystem
      // path from someone else's server.
      console.error(
        `[enrichment] MaxMind ${label} database not found at ${databasePath}`,
      );
      return {
        ok: false,
        code: "DATABASE_UNREADABLE",
        message: `MaxMind ${label} database was not found at the configured path`,
      };
    }
  }

  return {
    ok: true,
    provider: createMaxmindProvider({ asnPath, cityPath }),
  };
}
