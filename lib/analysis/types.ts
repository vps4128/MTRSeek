/**
 * The one shape every parser produces.
 *
 * Each trace tool prints its own table with its own column names and its own
 * idea of what a "hop" is. Everything downstream — the analysis page, the hop
 * table, the route summary — reads this shape and nothing else, so adding a
 * fifth format later means writing one more parser and touching no UI.
 *
 * ## Parsed facts, and looked-up ones
 *
 * `isp`, `asn` and `location` are declared on `Hop` but are not parsed from
 * anything: no trace tool prints them, and they arrive from the enrichment
 * layer, which looks each address up in a GeoIP database.
 *
 * The two kinds of data are kept apart by where they are allowed to live, not
 * by the type. `lib/parsers` writes only the measured fields and never touches
 * these three; `lib/enrichment` fills these three and never touches a
 * measurement. §18 draws the same line from the outside: enrichment is not
 * allowed near Loss, RTT, Hostname, Hop index or the address itself, because a
 * lookup must not be able to change what was measured.
 *
 * Enrichment is applied to an in-memory copy on its way to the screen and is
 * never written back to storage, so what `sessionStorage` holds — and what a
 * reload re-reads — is the parse result alone. A looked-up value is derived
 * from a database that changes on its own schedule; storing it would freeze
 * one day's answer into a document that claims to be a trace.
 *
 * Route classification is still absent outright, and so is prefix: there is no
 * field for either.
 */

/** The tool a `ParsedTrace` was read out of. */
export type TraceSource = "mtr" | "winmtr" | "nexttrace" | "traceroute";

/**
 * Where an address is registered, as a GeoIP database would report it.
 *
 * Three optional parts rather than one string, because lookups disagree about
 * how much they know: some resolve a city, some stop at the country. Keeping
 * them apart lets the display show the country alone rather than a string with
 * an empty tail.
 *
 * This is registration data, not a machine's whereabouts. A GeoIP city is
 * routinely the ISP's regional office rather than the router's rack, which is
 * why the hop table calls the column Location and never anything more precise.
 */
export type HopLocation = {
  country?: string;

  region?: string;

  city?: string;
};

/**
 * The autonomous system an address is announced from, as a lookup reports it.
 *
 * Two parts rather than the `AS4134` string the hop table prints, for the same
 * reason `HopLocation` is three: the number and the operator's name are
 * separate facts with separate sources, and joining them at the point of the
 * lookup would destroy the distinction between "the database named this
 * operator" and "the database knew only a number". The display joins what it
 * was given and shows `AS4134 / China Telecom`, or just the half it has.
 *
 * `organization` is the operator that holds the allocation. It is not an ISP
 * name and the two are not interchangeable — see `Hop.isp`.
 */
export type HopAsn = {
  /** The number alone, so the display supplies the `AS` prefix. */
  number?: number;

  organization?: string;
};

/**
 * One hop of a route.
 *
 * Every measurement is optional, because "no answer" is a normal thing for a
 * router to say and is information in itself: a hop that timed out has an
 * `index` and nothing else, and the UI renders that as an em dash rather than
 * inventing a zero. `0` and `undefined` mean different things here — 0% loss is
 * a measurement, `undefined` is the absence of one.
 */
export type Hop = {
  /** 1-based position in the route, as printed by the tool. */
  index: number;

  ip?: string;

  hostname?: string;

  /**
   * The access provider serving the address, when the database states one.
   *
   * Stayed empty through Phase 3, and deliberately. MaxMind's free GeoLite2
   * databases carry no ISP field at all — that trait belongs to the paid
   * GeoIP2 ISP product — so there is nothing here to read, and the hop table
   * prints an em dash. The field exists because a database that does state an
   * ISP should be believed; what must never happen is the substitution that
   * would fill it today, copying `asn.organization` across. An AS is an
   * allocation and an ISP is a service: an address announced by AS4134 may be
   * served by anyone, and the two names agreeing for the large carriers is a
   * coincidence of the Chinese market rather than a rule.
   *
   * Never inferred from the address.
   */
  isp?: string;

  /**
   * The autonomous system the address is announced from.
   *
   * Filled by enrichment from a GeoLite2 ASN lookup. Never inferred from the
   * address or from an ISP name — both directions of that inference run
   * backwards, since one AS carries many providers and one provider spans many
   * ASes.
   */
  asn?: HopAsn;

  /** Filled by enrichment from a GeoLite2 City lookup. */
  location?: HopLocation;

  /** Percentage, 0–100. */
  loss?: number;

  /** RTT of the most recent probe, in milliseconds. */
  last?: number;

  avg?: number;

  best?: number;

  worst?: number;

  stddev?: number;
};

export type ParsedTrace = {
  source: TraceSource;

  /**
   * Left empty when the output does not name a destination. MTR and WinMTR
   * never print the target (it was an argument to the command), so for those
   * the parsers fall back to the trace's final hop — the destination by
   * definition of a trace. When that hop is a `???` timeout, the target stays
   * empty rather than being guessed at.
   */
  target: {
    host?: string;
    ip?: string;
  };

  hops: Hop[];

  metadata?: {
    /** The trace's own start time, when it printed one. */
    timestamp?: string;
    duration?: number;
    /** Probes sent per hop, when the format reports it. */
    packetCount?: number;
  };
};

/**
 * Why a parse failed.
 *
 * A code rather than a sentence: the parsers are pure data code and hold no
 * copy, so the three messages the reader sees live in the translation
 * catalogs and are looked up by this key.
 */
export type ParseErrorCode = "EMPTY_INPUT" | "UNRECOGNIZED_FORMAT" | "NO_HOPS";

/**
 * The result of `parseTrace`.
 *
 * A discriminated union rather than `ParsedTrace | null` so a caller cannot
 * reach `trace` without having handled the failure — and cannot render an
 * empty page by treating "no hops" as "a trace with no hops".
 */
export type ParseResult =
  | { ok: true; trace: ParsedTrace }
  | { ok: false; error: { code: ParseErrorCode; message: string } };
