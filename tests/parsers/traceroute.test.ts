import { describe, expect, it } from "vitest";

import { parseTraceroute } from "@/lib/parsers";

const REPORT = `traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets
 1  192.168.1.1 (192.168.1.1)  1.123 ms  1.234 ms  1.345 ms
 2  10.0.0.1  3.456 ms  3.567 ms  3.678 ms
 3  * * *
 4  gateway.local (10.0.0.1)  2.000 ms
 5  59.43.80.1  8.123 ms
`;

describe("parseTraceroute", () => {
  describe("a real report", () => {
    const trace = parseTraceroute(REPORT);

    it("reads the source and the target the tool named", () => {
      expect(trace.source).toBe("traceroute");
      expect(trace.target).toEqual({ host: "example.com", ip: "93.184.216.34" });
    });

    it("reads one hop per numbered row", () => {
      expect(trace.hops.map((hop) => hop.index)).toEqual([1, 2, 3, 4, 5]);
    });

    it("takes `last` from the final probe and the rest from the probes printed", () => {
      expect(trace.hops[0]).toMatchObject({
        index: 1,
        ip: "192.168.1.1",
        last: 1.345,
        best: 1.123,
        worst: 1.345,
      });
      expect(trace.hops[0].avg).toBeCloseTo(1.234, 3);
      expect(trace.hops[0]).not.toHaveProperty("hostname");
    });

    it("keeps a hop that timed out, with its index and nothing else", () => {
      expect(trace.hops[2]).toMatchObject({ index: 3 });
      expect(trace.hops[2]).not.toHaveProperty("ip");
      expect(trace.hops[2]).not.toHaveProperty("hostname");
      expect(trace.hops[2].avg).toBeUndefined();
    });

    it("reads a hostname and its address when the row carries both", () => {
      expect(trace.hops[3]).toMatchObject({ index: 4, hostname: "gateway.local", ip: "10.0.0.1" });
    });

    it("reads a row with a single probe", () => {
      expect(trace.hops[4]).toMatchObject({
        index: 5,
        ip: "59.43.80.1",
        last: 8.123,
        best: 8.123,
        worst: 8.123,
      });
    });
  });

  describe("variants", () => {
    it("reads the simplified form with no address on the header", () => {
      const trace = parseTraceroute("traceroute to example.com\n 1  192.168.1.1  1.123 ms");

      expect(trace.target).toEqual({ host: "example.com" });
      expect(trace.hops).toEqual([
        { index: 1, ip: "192.168.1.1", last: 1.123, best: 1.123, worst: 1.123, avg: 1.123 },
      ]);
    });

    it("reads `???` as a missing address", () => {
      const trace = parseTraceroute("traceroute to example.com\n 1  ???  1.123 ms");

      expect(trace.hops[0]).not.toHaveProperty("ip");
      expect(trace.hops[0]).not.toHaveProperty("hostname");
    });

    it("reads IPv6 output from traceroute6", () => {
      const trace = parseTraceroute(
        "traceroute6 to 2001:4860:4860::8888 (2001:4860:4860::8888), 30 hops max, 80 byte packets\n 1  2001:db8::1  1.123 ms",
      );

      // The name and the address the tool printed are the same string, so
      // there is no separate host to record.
      expect(trace.target).toEqual({ ip: "2001:4860:4860::8888" });
      expect(trace.hops[0].ip).toBe("2001:db8::1");
    });

    it("falls back to the final hop when the tool printed no header", () => {
      const trace = parseTraceroute(" 1  192.168.1.1  1.123 ms\n 2  example.com  2.234 ms");

      expect(trace.target).toEqual({ host: "example.com" });
    });
  });

  describe("input that is not a report", () => {
    it("returns no hops for empty input", () => {
      expect(parseTraceroute("").hops).toEqual([]);
    });

    it("returns no hops for input that is not a trace", () => {
      expect(parseTraceroute("hello, this is not a trace").hops).toEqual([]);
    });

    it("keeps the hops it found and skips the lines it could not read", () => {
      const trace = parseTraceroute(
        "traceroute to example.com\n 1  192.168.1.1  1.123 ms\nnot a hop\n 2  10.0.0.1  2.234 ms",
      );

      expect(trace.hops.map((hop) => hop.index)).toEqual([1, 2]);
    });
  });
});
