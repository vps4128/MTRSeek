import { isIP } from "node:net";

/**
 * Which addresses are worth looking up.
 *
 * A trace to a distant target crosses a home router, a carrier's access
 * network, and often a tunnel, before it reaches anything the outside world can
 * route to. Those addresses have no entry in a GeoIP database and never will:
 * `192.168.1.1` is in ten million homes and `100.64.0.1` is in every carrier
 * NAT, so "where is it" is not a question with an answer. Asking would spend a
 * lookup to be told nothing, and — worse — a database that answered anyway
 * would be making something up.
 *
 * So they are filtered here, before the provider is called, and the hop table
 * shows an em dash in all three looked-up columns. That is the honest render:
 * the address is known, its network attribution is not a thing that exists.
 *
 * §7 lists the addresses this has to catch by example — `10.0.0.1`,
 * `192.168.1.1`, `172.16.0.1`, `127.0.0.1` — and this module is deliberately
 * broader than that list. The four are the private and loopback cases a home
 * trace shows; the ranges below are the rest of the space that is not globally
 * routable, and a filter that let them through would be answering "not found"
 * for `169.254.x.x` and `2001:db8::` as though they were real places.
 */

/** `1.2.3.4` → `[1, 2, 3, 4]`, or `null` if it is not an IPv4 address. */
function parseIpv4(address: string): [number, number, number, number] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => Number(part));
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }

  return octets as [number, number, number, number];
}

/**
 * An IPv6 address as eight 16-bit groups, or `null` if it is not one.
 *
 * Written out rather than reached for from a library, because classifying an
 * address needs the groups and the platform offers no way to ask for them:
 * `net.isIP` answers whether a string is an address but hands back nothing
 * decoded. The two are used together — `isIP` is the gate that says the string
 * is well formed, and this only has to expand what `isIP` already accepted.
 *
 * A trailing dotted quad is folded into the two groups it stands for, so
 * `::ffff:192.168.1.1` and `::ffff:c0a8:101` classify identically.
 */
function expandIpv6(address: string): number[] | null {
  // A zone index (`fe80::1%en0`) names an interface, not part of the address.
  const bare = address.split("%")[0];

  const halves = bare.split("::");
  if (halves.length > 2) return null;

  const toGroups = (part: string): number[] | null => {
    if (part === "") return [];

    const groups: number[] = [];
    for (const field of part.split(":")) {
      if (field.includes(".")) {
        // Only legal as the final field, and only as a whole IPv4 address.
        const quad = parseIpv4(field);
        if (quad === null) return null;
        groups.push((quad[0] << 8) | quad[1], (quad[2] << 8) | quad[3]);
        continue;
      }

      if (!/^[0-9a-fA-F]{1,4}$/.test(field)) return null;
      groups.push(Number.parseInt(field, 16));
    }
    return groups;
  };

  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (head === null || tail === null) return null;

  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    return [...head, ...new Array<number>(fill).fill(0), ...tail];
  }

  return head.length === 8 ? head : null;
}

/** True when the address is one the public internet routes. */
function isPublicIpv4(octets: [number, number, number, number]): boolean {
  const [a, b, c] = octets;

  // Each line is a range that is not globally routable, with the reason the
  // address space exists at all. Kept as explicit comparisons rather than a
  // table so a reader can check one against the registry.
  if (a === 0) return false; // "this network"
  if (a === 10) return false; // private
  if (a === 127) return false; // loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0 && c === 0) return false; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return false; // TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return false; // 6to4 relay anycast
  if (a === 198 && b === 18) return false; // benchmarking
  if (a === 198 && b === 19) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast, reserved, broadcast

  return true;
}

function isPublicIpv6(groups: number[]): boolean {
  const [g0, g1] = groups;

  const isZero = (from: number, to: number) =>
    groups.slice(from, to).every((group) => group === 0);

  if (isZero(0, 8)) return false; // unspecified `::`
  if (isZero(0, 7) && groups[7] === 1) return false; // loopback `::1`

  // An address that wraps an IPv4 address is exactly as public as the IPv4
  // address inside it — `::ffff:192.168.1.1` is a private address wearing a
  // v6 coat, and letting it through would defeat the filter for every
  // dual-stack trace.
  const wrapsV4 =
    (isZero(0, 5) && groups[5] === 0xffff) || isZero(0, 6); // ::ffff:0:0/96, ::/96
  if (wrapsV4) {
    const embedded = [
      groups[6] >> 8,
      groups[6] & 0xff,
      groups[7] >> 8,
      groups[7] & 0xff,
    ] as [number, number, number, number];
    return isPublicIpv4(embedded);
  }

  if ((g0 & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((g0 & 0xff00) === 0xff00) return false; // multicast ff00::/8
  if (g0 === 0x0100 && isZero(1, 4)) return false; // discard-only 100::/64
  if (g0 === 0x2001 && g1 === 0x0db8) return false; // documentation

  return true;
}

/**
 * True when the string is a well-formed address the public internet routes.
 *
 * One question with one answer, because both halves of it are needed at the
 * same moment: a caller that has to remember to check validity *and* routability
 * will eventually check one of them. A hostname, an empty string and a
 * `192.168.0.1` all fail it for their own reasons, and all three are handled
 * the same way downstream — no lookup, an em dash in the table.
 */
export function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = parseIpv4(address);
    return octets !== null && isPublicIpv4(octets);
  }
  if (version === 6) {
    const groups = expandIpv6(address);
    return groups !== null && isPublicIpv6(groups);
  }
  return false;
}
