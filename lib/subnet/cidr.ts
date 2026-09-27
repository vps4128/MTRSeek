/**
 * IPv4 CIDR arithmetic.
 *
 * Everything a subnet calculator needs from one string: the mask, the network
 * and broadcast addresses, the usable range and its size, and the wildcard.
 * Pure functions over numbers — no storage, no React, no `node:` imports.
 *
 * ## Why it cannot share the parser in `lib/enrichment/ip.ts`
 *
 * That module also reads dotted quads, and its `parseIpv4` is the same six
 * lines. It is not reused here because it is a *server* module: it imports
 * `isIP` from `node:net`, so anything that imports it is Node-only, and this
 * one has to run in the browser — the calculator computes as the reader types.
 * The two are also answering different questions. That one classifies an
 * address as routable or not; this one does arithmetic on it. Splitting the
 * shared lines out would mean moving the octet reader into a third module that
 * both import, which is a real option — but it would edit a tested module that
 * the analysis and IP pages both depend on, and the duplicate is small enough
 * that the coupling costs more than it saves.
 *
 * ## Why the arithmetic is in doubles, not `Uint32Array`
 *
 * Every address fits in a JavaScript number exactly, and the only places that
 * need a 32-bit reinterpretation are the bitwise operators — which is what the
 * `>>> 0` on each of them is for. `&`, `|` and `<<` return *signed* 32-bit
 * integers, so `255.255.255.255 & 255.255.255.0` is `-256` without the fix and
 * `4294967040` with it. Host counts are plain multiplication, not shifts,
 * because `2 ** 32` is a number the shift operators cannot express.
 */

/** What went wrong, for the caller to translate. */
export type SubnetErrorCode = "EMPTY_INPUT" | "BAD_ADDRESS" | "BAD_PREFIX";

/**
 * The eight facts, plus the two the page needs to render them.
 *
 * `address` and `network` are both here and are often different: a reader who
 * types `192.168.1.5/24` is shown the address they typed *and* the network it
 * falls in. Collapsing them into one would mean silently rewriting what was
 * asked, which is the thing the separate rows exist to avoid.
 */
export type SubnetFacts = {
  /** The address as typed, in canonical form. */
  address: string;
  /** 0–32. */
  prefix: number;
  /** `192.168.1.0/24` — the network with its prefix. */
  cidr: string;
  mask: string;
  wildcard: string;
  network: string;
  /**
   * The broadcast address, or `undefined` on a `/31` or `/32`.
   *
   * Not an empty string and not a best guess: those two prefixes have no
   * broadcast address, and the page renders the absence with the em dash the
   * rest of this app uses for a fact that does not exist. See `hasBroadcast`.
   */
  broadcast: string | undefined;
  first: string;
  last: string;
  hosts: number;
};

export type SubnetResult =
  | { ok: true; facts: SubnetFacts }
  | { ok: false; code: SubnetErrorCode };

const ALL_ONES = 0xffffffff;

/**
 * A dotted quad as four octets, or `null`.
 *
 * A leading zero is refused rather than read. `010` is 8 to a parser that
 * treats it as octal and 10 to one that does not, and those are two different
 * networks — so the string is rejected and the reader is told, rather than one
 * of the two readings being assumed on their behalf.
 */
function toOctets(text: string): [number, number, number, number] | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];

  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;

    const value = Number(part);
    if (value > 255) return null;

    octets.push(value);
  }

  return octets as [number, number, number, number];
}

/** Four octets as one unsigned 32-bit number. */
function toInt(octets: [number, number, number, number]): number {
  return (
    ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
  );
}

/** An unsigned 32-bit number as a dotted quad. */
function toAddress(value: number): string {
  return [
    value >>> 24,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join(".");
}

/**
 * The mask for a prefix length.
 *
 * The `/0` case is spelled out because JavaScript's shift operators take the
 * count modulo 32: `ALL_ONES << 32` evaluates as `ALL_ONES << 0`, so the mask
 * for a `/0` would come back as the mask for a `/32` — the widest subnet
 * rendered as the narrowest, which is the one answer a reader would not catch.
 */
function maskOf(prefix: number): number {
  return prefix === 0 ? 0 : (ALL_ONES << (32 - prefix)) >>> 0;
}

/**
 * RFC 3021: a `/31` is a point-to-point link.
 *
 * Both of its addresses are usable hosts and it has no network or broadcast
 * address. Subtracting those two from the total, as every other prefix does,
 * reports 0 usable hosts for a link that has two — and reports **-1** for a
 * `/32`, which is how the formula announces that it does not apply here.
 */
function hostCount(prefix: number): number {
  if (prefix === 31) return 2;
  if (prefix === 32) return 1;

  return 2 ** (32 - prefix) - 2;
}

/**
 * Reads `192.168.1.0/24` into its eight facts.
 *
 * Never throws and never returns a partial answer: either every fact is
 * present or the caller gets a code to translate. A missing prefix is an error
 * rather than an assumed `/32` — a reader who typed an address without one is
 * told the shape to use instead of being handed an answer to a question they
 * did not ask.
 */
export function parseCidr(input: string): SubnetResult {
  const text = input.trim();
  if (text.length === 0) return { ok: false, code: "EMPTY_INPUT" };

  const parts = text.split("/");
  if (parts.length !== 2) return { ok: false, code: "BAD_PREFIX" };

  const [addressText, prefixText] = parts.map((part) => part.trim());

  const octets = toOctets(addressText);
  if (octets === null) return { ok: false, code: "BAD_ADDRESS" };

  // `0` or a two-digit number with no leading zero — the same rule the octets
  // get, for the same reason.
  if (!/^(0|[1-9]\d?)$/.test(prefixText)) return { ok: false, code: "BAD_PREFIX" };

  const prefix = Number(prefixText);
  if (prefix > 32) return { ok: false, code: "BAD_PREFIX" };

  const address = toInt(octets);
  const mask = maskOf(prefix);
  const wildcard = (~mask) >>> 0;
  const network = (address & mask) >>> 0;
  const upper = (network | wildcard) >>> 0;

  // The top of the range is the broadcast address everywhere except a /31 and a
  // /32, where it is simply the last usable address.
  const hasBroadcast = prefix <= 30;

  return {
    ok: true,
    facts: {
      address: toAddress(address),
      prefix,
      cidr: `${toAddress(network)}/${prefix}`,
      mask: toAddress(mask),
      wildcard: toAddress(wildcard),
      network: toAddress(network),
      broadcast: hasBroadcast ? toAddress(upper) : undefined,
      first: toAddress(hasBroadcast ? network + 1 : network),
      last: toAddress(hasBroadcast ? upper - 1 : upper),
      hosts: hostCount(prefix),
    },
  };
}
