import { describe, expect, it } from "vitest";

import { isPublicIp } from "@/lib/enrichment/ip";

/**
 * The addresses that must never reach a lookup.
 *
 * §7 names four by example — `10.0.0.1`, `192.168.1.1`, `172.16.0.1`,
 * `127.0.0.1` — and the point of this file is that the filter is a property of
 * the address space rather than a list of four strings. Every range below is
 * one a trace can genuinely contain, and each has a specific reason to be
 * excluded: it is private, it is the machine itself, it is the segment between
 * two adjacent routers, or it is reserved for documentation.
 *
 * The IPv6 cases carry the same weight. A dual-stack trace prints v6 addresses,
 * and a filter that only understood dotted quads would send `fe80::1` to a
 * database that has no entry for it — and, worse, would send `::ffff:192.168.1.1`,
 * which is a private address written the long way round.
 */

const NOT_PUBLIC = [
  // The four §7 names.
  "10.0.0.1",
  "192.168.1.1",
  "172.16.0.1",
  "127.0.0.1",

  // The rest of the private and loopback space.
  "10.255.255.254",
  "172.31.255.255",
  "192.168.0.1",
  "127.0.0.53",
  "0.0.0.0",

  // Link-local, which is what a trace's first hop usually is.
  "169.254.1.1",

  // Carrier-grade NAT: a home router's public side, in ten million homes.
  "100.64.0.1",
  "100.127.255.255",

  // Reserved, documentation and benchmarking ranges.
  "192.0.0.1",
  "192.0.2.1",
  "192.88.99.1",
  "198.18.0.1",
  "198.51.100.1",
  "203.0.113.1",

  // Multicast and the reserved top of the space.
  "224.0.0.1",
  "239.255.255.250",
  "240.0.0.1",
  "255.255.255.255",

  // IPv6: unspecified, loopback, link-local, unique-local, multicast.
  "::",
  "::1",
  "fe80::1",
  "fe80::a00:27ff:fe4e:66a1",
  "febf::1",
  "fc00::1",
  "fd00::1",
  "fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
  "ff02::1",
  "ff00::",

  // IPv6 that wraps a private IPv4 address is exactly as private.
  "::ffff:192.168.1.1",
  "::ffff:10.0.0.1",
  "::ffff:127.0.0.1",
  "::192.168.1.1",

  // Documentation.
  "2001:db8::1",
  "100::1",

  // Not addresses at all — a hostname, an empty cell, and near-misses that
  // `isIP` rejects but a hand-rolled regex would let through.
  "example.com",
  "",
  "   ",
  "not-an-ip",
  "999.1.1.1",
  "1.2.3",
  "1.2.3.4.5",
  "01.2.3.4",
  "2001:db8:::1",
  "fe80::1%en0",
];

const PUBLIC = [
  "1.1.1.1",
  "8.8.8.8",
  "114.114.114.114",
  "223.5.5.5",
  "9.255.255.255",
  "172.15.255.255",
  "172.32.0.0",
  "100.63.255.255",
  "100.128.0.0",
  "192.167.255.255",
  "192.169.0.0",
  "223.255.255.255",

  // IPv6, including a global one and one that wraps a public IPv4 address.
  "2001:4860:4860::8888",
  "2606:4700:4700::1111",
  "::ffff:1.1.1.1",
];

describe("addresses worth looking up", () => {
  it("refuses every address that is not globally routable", () => {
    for (const address of NOT_PUBLIC) {
      expect(isPublicIp(address), `${address} was sent to a lookup`).toBe(
        false,
      );
    }
  });

  it("accepts the addresses the internet actually routes", () => {
    for (const address of PUBLIC) {
      expect(isPublicIp(address), `${address} was filtered out`).toBe(true);
    }
  });

  it("treats a wrapped IPv4 address as the address inside it", () => {
    // The one case where the two families have to agree. `::ffff:8.8.8.8` is
    // the same address as `8.8.8.8` and has to classify identically, or a
    // dual-stack trace would bypass the filter.
    expect(isPublicIp("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicIp("::ffff:8.8.8.8")).toBe(isPublicIp("8.8.8.8"));
    expect(isPublicIp("::ffff:192.168.1.1")).toBe(isPublicIp("192.168.1.1"));
  });

  it("classifies the boundaries of each range, not just its middle", () => {
    // A range check written with `<` instead of `<=` passes a test that only
    // samples the middle of a range and fails on the address next to the edge.
    expect(isPublicIp("172.15.255.255")).toBe(true);
    expect(isPublicIp("172.16.0.0")).toBe(false);
    expect(isPublicIp("172.31.255.255")).toBe(false);
    expect(isPublicIp("172.32.0.0")).toBe(true);

    expect(isPublicIp("100.63.255.255")).toBe(true);
    expect(isPublicIp("100.64.0.0")).toBe(false);
    expect(isPublicIp("100.127.255.255")).toBe(false);
    expect(isPublicIp("100.128.0.0")).toBe(true);
  });
});
