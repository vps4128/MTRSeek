import type { HopAsn, HopLocation, TraceSource } from "./types";

/**
 * Presentation of parsed measurements.
 *
 * Kept out of the components so that "no measurement" is rendered the same way
 * in every cell of every panel — and so that `undefined` can never reach the
 * DOM as the string `undefined`, `null` or `NaN`.
 */

/**
 * What a cell shows when the trace has no value for it.
 *
 * An em dash, not a zero and not a blank: a hop that did not answer is a fact
 * about the route, and a zero would state a measurement that was never taken.
 */
export const EMPTY_VALUE = "—";

/**
 * RTT always carries one decimal, loss never carries a redundant one.
 *
 * These are two different rendering problems. RTTs are read down a monospace
 * column, where `1 ms` sitting under `42.7 ms` makes the figures harder to scan
 * than `1.0 ms` does — and MTR itself prints `1.0`, so one decimal is also the
 * format the numbers arrived in. Loss is read one value at a time as a
 * percentage, where `0.0%` is noise; §13's own example is `0% packet loss`.
 */
function trimLoss(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** `1.4 ms`, or the empty marker. */
export function formatRtt(value: number | undefined): string {
  return value === undefined ? EMPTY_VALUE : `${value.toFixed(1)} ms`;
}

/** `0%`, or the empty marker. */
export function formatLoss(value: number | undefined): string {
  return value === undefined ? EMPTY_VALUE : `${trimLoss(value)}%`;
}

/** `10`, or the empty marker. */
export function formatCount(value: number | undefined): string {
  return value === undefined ? EMPTY_VALUE : String(value);
}

/**
 * `中国 · 广东 · 广州`, narrowing to whatever the lookup actually returned, or
 * the empty marker.
 *
 * The parts are names out of a GeoIP database, in the reader's language where
 * the database has one. Nothing is translated on the way here: a database
 * compiled with several languages carries a name for each, and
 * `lib/enrichment/names.ts` picks the entry to show — so a Chinese page reads
 * `中国 · 吉林 · 长春` and an English one reads `China · Jilin Sheng ·
 * Changchun`, and neither is a translation this app performed. A name the
 * database does not carry in either language is left out entirely rather than
 * replaced with one this app assembled. Only the separator is ours.
 *
 * Parts are dropped when absent, so a lookup that knows the country and
 * nothing else reads `美国` rather than `美国 · · `.
 */
export function formatLocation(location: HopLocation | undefined): string {
  const parts = [location?.country, location?.region, location?.city].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length === 0 ? EMPTY_VALUE : parts.join(" · ");
}

/**
 * `AS4134`, or the empty marker.
 *
 * The `AS` prefix is added here rather than stored, so the number stays a number
 * — the database returns an integer, and a `Hop` carrying the string `"AS4134"`
 * would have thrown away the fact that it was one.
 *
 * A function of its own because the IP lookup page gives the number and the
 * operator a row each, and it is the same function `formatAsn` joins, so the
 * two pages cannot spell the prefix differently.
 */
export function formatAsnNumber(asn: HopAsn | undefined): string {
  return asn?.number === undefined ? EMPTY_VALUE : `AS${asn.number}`;
}

/**
 * `AS4134 / China Telecom`, narrowing to whichever half the lookup returned, or
 * the empty marker.
 *
 * Both halves are joined rather than one being chosen, because they answer
 * different questions: the number is the allocation and the name is who holds
 * it, and a reader comparing two hops wants to see at a glance both that the
 * numbers differ and by whose name. Joining rather than stacking keeps the row
 * one line, which is what the hop table's scroll height is computed from.
 *
 * The organization is passed through untranslated, like a place name: it is
 * what the database says the operator is called.
 */
export function formatAsn(asn: HopAsn | undefined): string {
  const number = formatAsnNumber(asn);
  const parts: string[] = [];

  if (number !== EMPTY_VALUE) parts.push(number);
  if (asn?.organization) parts.push(asn.organization);

  return parts.length === 0 ? EMPTY_VALUE : parts.join(" / ");
}

/**
 * The tool name as the tool spells it.
 *
 * Not translated and not title-cased from the source key: `WinMTR` and
 * `NextTrace` are proper nouns with their own capitalisation, and `traceroute`
 * is the command you type.
 */
export const SOURCE_LABELS: Record<TraceSource, string> = {
  mtr: "MTR",
  winmtr: "WinMTR",
  nexttrace: "NextTrace",
  traceroute: "traceroute",
};
