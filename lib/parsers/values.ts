/**
 * Field-level readers shared by the parsers.
 *
 * Trace tools write "no value" in about six different ways — `???`, `--`, `-`,
 * `*`, an empty column, `0.0` where they mean "no measurement" — and every one
 * of them has to come back as `undefined` rather than as `0` or `NaN`. These
 * helpers are where that judgement lives, so the parsers can stay line-shape
 * code and four parsers cannot disagree about what `???` means.
 */

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/** Tokens that mean "this field was not measured", in every dialect. */
const NONE = new Set(["", "-", "--", "???", "??", "?", "*", "n/a", "N/A"]);

/**
 * Reads a decimal, or `undefined` when the field carries no measurement.
 *
 * `0` is returned as `0` — a real zero and an absent value are different facts
 * all the way up to the table cell, which prints `0.0` for one and `—` for the
 * other.
 */
export function toNumber(token: string | undefined): number | undefined {
  if (token === undefined) return undefined;
  const text = token.trim();
  if (NONE.has(text)) return undefined;

  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Reads a loss figure. MTR writes `0.0%` and sometimes a bare `100.0`; WinMTR
 * writes a bare integer. A trailing `%` is accepted either way.
 */
export function toLoss(token: string | undefined): number | undefined {
  if (token === undefined) return undefined;
  const text = token.trim().replace(/%$/, "");
  return toNumber(text);
}

export function isIpv4(token: string): boolean {
  return IPV4.test(token);
}

/**
 * Loose on purpose. This decides whether a token is an address or a hostname,
 * not whether it is routable, and it has to accept the IPv6 shapes routers
 * actually print — compressed (`2001:db8::1`), loopback (`::1`) and
 * zone-scoped (`fe80::1%en0`).
 */
export function isIpv6(token: string): boolean {
  const bare = token.replace(/%.*$/, "");
  if (!bare.includes(":") || !/^[0-9a-f:]+$/i.test(bare)) return false;
  return (bare.match(/::/g) ?? []).length <= 1;
}

export function isIp(token: string): boolean {
  return isIpv4(token) || isIpv6(token);
}

/**
 * Splits an address token into the hop's `ip` and `hostname`.
 *
 * A tool prints either a resolved name, an address, or both as
 * `name (address)`. Whichever it printed is what goes in; nothing here resolves
 * a name to an address or the reverse.
 */
export function splitAddress(token: string): {
  ip?: string;
  hostname?: string;
} {
  if (token.length === 0 || NONE.has(token.trim())) return {};

  const parenthesised = token.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (parenthesised) {
    const [, name, address] = parenthesised;

    const found: { ip?: string; hostname?: string } = {};
    if (isIp(address)) found.ip = address;
    // The tool printing a name identical to the address has told us nothing
    // extra, so no hostname is recorded.
    if (name.length > 0 && name !== address) found.hostname = name;
    return found;
  }

  return isIp(token) ? { ip: token } : { hostname: token };
}

/** An autonomous-system token, e.g. `AS4134`. Not an address. */
const ASN = /^AS\d+$/i;

/**
 * Pulls the address out of the text that follows a hop number.
 *
 * traceroute and NextTrace put the address first and everything else after it —
 * probe RTTs, an ASN, a country code, an ISP name — and the address itself is
 * written either bare (`10.0.0.1`), as a name (`gateway.local`) or as both
 * (`gateway.local (10.0.0.1)`). A hop that timed out prints `*` instead, and
 * that has to come back empty rather than as a hostname called `*`. An ASN in
 * first position means the address was withheld, not that `AS4134` is a host.
 */
export function readAddress(text: string): {
  ip?: string;
  hostname?: string;
} {
  const cleaned = text
    .replace(/^(\s*\*\s*)+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return {};

  // Rebuilt rather than passed through, so that trailing columns — NextTrace
  // writes `59.43.80.1 (AS4809) [CN]` — do not stop `splitAddress` matching.
  const parenthesised = cleaned.match(/^(.*?)\s*\(([^)]+)\)/);
  if (parenthesised) {
    return splitAddress(`${parenthesised[1].trim()} (${parenthesised[2]})`);
  }

  const [first] = cleaned.split(" ");
  if (first === undefined || ASN.test(first) || first.startsWith("[")) return {};

  return splitAddress(first);
}

/**
 * A trace's target, from an address as the tool printed it.
 *
 * A hop calls its name a `hostname` and a trace calls its destination a `host`.
 * Same text, two roles, so the conversion happens here rather than in each
 * parser.
 */
export function readTarget(text: string): { host?: string; ip?: string } {
  const { ip, hostname } = readAddress(text);
  return compact({ host: hostname, ip });
}

/**
 * Drops keys whose value is `undefined`.
 *
 * A parsed trace is written as JSON between the input and the analysis page,
 * and JSON has no `undefined`: a key that is present-but-undefined at parse
 * time comes back absent after a reload. Building hops without those keys makes
 * the two shapes identical, so nothing downstream has to care whether the trace
 * it is holding has been through storage.
 */
export function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

/**
 * Summarises the probe RTTs printed on one line.
 *
 * traceroute and NextTrace print several probes per hop; MTR prints columns.
 * `last` is the most recent probe — for a line reading left to right, the last
 * one printed — and best/worst/avg are arithmetic over the values actually on
 * the line, not estimates.
 */
export function rttStats(values: number[]): {
  last?: number;
  best?: number;
  worst?: number;
  avg?: number;
} {
  if (values.length === 0) return {};

  return {
    last: values[values.length - 1],
    best: Math.min(...values),
    worst: Math.max(...values),
    avg: values.reduce((total, value) => total + value, 0) / values.length,
  };
}
