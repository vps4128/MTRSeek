import { describe, expect, it, vi } from "vitest";

import { createProvider } from "@/lib/enrichment/provider";

/**
 * What happens when the databases are not where they should be.
 *
 * §14: a missing MMDB must not take the app down, and must produce a clear
 * error rather than silence. The three cases below are the three an operator
 * actually hits — nothing configured, a path that is wrong, and the working
 * case — and the distinction between the first two is the whole reason the
 * check exists: "you have not set this up" and "your path is wrong" are
 * different problems with different fixes, and one message for both would send
 * someone looking in the wrong place.
 *
 * Nothing here opens a database. `createProvider` reads the environment and
 * stats the paths, which is exactly the work that has to happen before a
 * request is accepted or refused.
 */

const EXISTING = `${process.cwd()}/package.json`;
const MISSING = `${process.cwd()}/data/geoip/GeoLite2-ASN.mmdb`;

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

/** `createMaxmindProviderFromEnv` logs the path it could not find. */
function quietly<T>(run: () => T): T {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    return run();
  } finally {
    logged.mockRestore();
  }
}

describe("choosing a provider", () => {
  it("refuses to serve when nothing is configured", () => {
    const setup = createProvider(env({}));

    expect(setup.ok).toBe(false);
    if (setup.ok) return;
    expect(setup.code).toBe("ASN_DB_NOT_CONFIGURED");
    // §14 names this message, and the API route passes it straight through.
    expect(setup.message).toBe("MaxMind ASN database is not configured");
  });

  it("treats a blank or whitespace path as unset", () => {
    // An uncommented `MAXMIND_ASN_DB_PATH=` in a `.env` file is empty, not
    // configured, and must not be mistaken for a path called "".
    for (const blank of ["", "   "]) {
      const setup = createProvider(
        env({ MAXMIND_ASN_DB_PATH: blank, MAXMIND_CITY_DB_PATH: blank }),
      );
      expect(setup.ok).toBe(false);
      if (!setup.ok) expect(setup.code).toBe("ASN_DB_NOT_CONFIGURED");
    }
  });

  it("names the database whose path is wrong", () => {
    const asn = quietly(() =>
      createProvider(env({ MAXMIND_ASN_DB_PATH: MISSING })),
    );
    expect(asn.ok).toBe(false);
    if (!asn.ok) {
      expect(asn.code).toBe("DATABASE_UNREADABLE");
      expect(asn.message).toContain("ASN");
    }

    const city = quietly(() =>
      createProvider(env({ MAXMIND_CITY_DB_PATH: MISSING })),
    );
    expect(city.ok).toBe(false);
    if (!city.ok) {
      expect(city.code).toBe("DATABASE_UNREADABLE");
      expect(city.message).toContain("City");
    }
  });

  it("does not put the server's filesystem path in the message", () => {
    // The reader of this message is a browser, and a path from someone else's
    // server is not theirs to know.
    const setup = quietly(() =>
      createProvider(env({ MAXMIND_ASN_DB_PATH: MISSING })),
    );
    if (!setup.ok) expect(setup.message).not.toContain(MISSING);
  });

  it("serves with only one database configured", () => {
    // A partial answer is an honest one: ASN columns fill and geography stays
    // an em dash. Only having neither is a failure.
    const asnOnly = createProvider(env({ MAXMIND_ASN_DB_PATH: EXISTING }));
    expect(asnOnly.ok).toBe(true);

    const cityOnly = createProvider(env({ MAXMIND_CITY_DB_PATH: EXISTING }));
    expect(cityOnly.ok).toBe(true);
  });

  it("serves with both configured", () => {
    const setup = createProvider(
      env({ MAXMIND_ASN_DB_PATH: EXISTING, MAXMIND_CITY_DB_PATH: EXISTING }),
    );

    expect(setup.ok).toBe(true);
    if (setup.ok) expect(setup.provider.name).toBe("maxmind");
  });
});
