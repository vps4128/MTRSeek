import { describe, expect, it } from "vitest";

import { parseNextTrace } from "@/lib/parsers";

/**
 * NextTrace's row shape shifts with the flags it was run under, so this fixture
 * carries several of them at once: a bare address, an address with an ASN,
 * an address with a country code and an ISP name, an ASN with no address, and a
 * timeout.
 */
const REPORT = `NextTrace v1.3.0 2024-05-01T12:00:00Z 6c1f0d
[NextTrace API] preferred API IP - 104.21.40.176 - 12.34ms - Cloudflare
traceroute to 1.1.1.1, 30 hops max, 32 byte packets
1   10.0.0.1  0.42ms
2   100.64.0.1  1.23ms
3   59.43.80.1  AS4809  5.20ms
4   202.97.12.9  AS4134  [CN]  China Telecom  31.50ms
5   *
6   AS13335  8.10ms
7   1.1.1.1  AS13335  9.90ms
2 hops, 5.60ms
`;

describe("parseNextTrace", () => {
  describe("a real report", () => {
    const trace = parseNextTrace(REPORT);

    it("reads the source and the target the tool named", () => {
      expect(trace.source).toBe("nexttrace");
      expect(trace.target).toEqual({ ip: "1.1.1.1" });
    });

    it("reads a hop per row", () => {
      expect(trace.hops.map((hop) => hop.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("reads a bare address and its RTT", () => {
      expect(trace.hops[0]).toEqual({
        index: 1,
        ip: "10.0.0.1",
        last: 0.42,
        best: 0.42,
        worst: 0.42,
        avg: 0.42,
      });
    });

    it("reads the address and leaves the ASN out of it", () => {
      expect(trace.hops[2]).toMatchObject({ index: 3, ip: "59.43.80.1", avg: 5.2 });
      expect(trace.hops[2]).not.toHaveProperty("hostname");
    });

    it("leaves the country code and the ISP name out of it", () => {
      expect(trace.hops[3]).toMatchObject({ index: 4, ip: "202.97.12.9", avg: 31.5 });
      expect(trace.hops[3]).not.toHaveProperty("hostname");
    });

    it("keeps a hop that timed out, with its index and nothing else", () => {
      expect(trace.hops[4]).toMatchObject({ index: 5 });
      expect(trace.hops[4]).not.toHaveProperty("ip");
      expect(trace.hops[4]).not.toHaveProperty("hostname");
      expect(trace.hops[4].avg).toBeUndefined();
    });

    it("does not mistake an ASN for a hostname when the address is withheld", () => {
      expect(trace.hops[5]).toMatchObject({ index: 6, avg: 8.1 });
      expect(trace.hops[5]).not.toHaveProperty("hostname");
      expect(trace.hops[5]).not.toHaveProperty("ip");
    });

    it("does not read the closing summary as a hop", () => {
      // `2 hops, 5.60ms` has a hop number and an RTT by shape.
      expect(trace.hops).toHaveLength(7);
      expect(trace.hops.map((hop) => hop.hostname)).not.toContain("hops,");
    });

    it("does not read the banner or the API line as hops", () => {
      expect(trace.hops.every((hop) => hop.index <= 7)).toBe(true);
    });
  });

  describe("variants", () => {
    it("reads a hostname as a hostname", () => {
      const trace = parseNextTrace("1   gateway.local  1.23ms");

      expect(trace.hops[0]).toMatchObject({ index: 1, hostname: "gateway.local" });
      expect(trace.hops[0]).not.toHaveProperty("ip");
    });

    it("reads a compressed IPv6 address", () => {
      const trace = parseNextTrace("1   2001:db8::1  1.23ms");

      expect(trace.hops[0].ip).toBe("2001:db8::1");
    });

    it("reads `*` as a timeout", () => {
      const trace = parseNextTrace("1   *");

      expect(trace.hops[0]).toMatchObject({ index: 1 });
      expect(trace.hops[0]).not.toHaveProperty("ip");
    });

    it("reads `???` as a missing address", () => {
      const trace = parseNextTrace("1   ???  1.23ms");

      expect(trace.hops[0]).not.toHaveProperty("hostname");
      expect(trace.hops[0].last).toBe(1.23);
    });

    it("reads several probes on one row", () => {
      const trace = parseNextTrace("1   10.0.0.1  1.10ms  2.20ms  3.30ms");

      expect(trace.hops[0]).toMatchObject({ index: 1, last: 3.3, best: 1.1, worst: 3.3 });
      expect(trace.hops[0].avg).toBeCloseTo(2.2, 3);
    });

    it("falls back to the final hop when the tool printed no header", () => {
      const trace = parseNextTrace("1   10.0.0.1  0.42ms\n2   example.com  9.90ms");

      expect(trace.target).toEqual({ host: "example.com" });
    });
  });

  describe("input that is not a report", () => {
    it("returns no hops for empty input", () => {
      expect(parseNextTrace("").hops).toEqual([]);
    });

    it("returns no hops for input that is not a trace", () => {
      expect(parseNextTrace("hello, this is not a trace").hops).toEqual([]);
    });

    it("keeps the hops it found and skips the lines it could not read", () => {
      const trace = parseNextTrace("1   10.0.0.1  0.42ms\nnot a hop\n2   10.0.0.2  0.43ms");

      expect(trace.hops.map((hop) => hop.index)).toEqual([1, 2]);
    });
  });
});
