import { describe, expect, it } from "vitest";

import { parseWinMtr } from "@/lib/parsers";

/**
 * The banner, the column header and the rules are all present here on purpose:
 * WinMTR is recognised by its banner, but the rows have to be told apart from
 * the three line shapes around them by their contents alone.
 */
const REPORT = `|------------------------------------------------------------------------------------------|
|                                      WinMTR statistics                                   |
|                       Host              -   %  | Sent | Recv | Best | Avrg | Wrst | Last |
|------------------------------------------------|------|------|------|------|------|------|
|                           192.168.1.1 -    0 |   10 |   10 |    1 |    1 |    2 |    1 |
|                              10.0.0.1 -    0 |   10 |   10 |    3 |    3 |    5 |    3 |
|                             59.43.80.1 -    0 |   10 |   10 |    8 |    8 |    9 |    8 |
|                           203.0.113.7 -   10 |   10 |    9 |   38 |   39 |   44 |   39 |
|                            example.com -    0 |   10 |   10 |   39 |   40 |   43 |   40 |
|------------------------------------------------------------------------------------------|
`;

/** One row, wrapped in the pipes WinMTR draws it with. */
function row(host: string, pct: string, values: string[]): string {
  const [sent, recv, best, avrg, wrst, last] = values;
  return `| ${host} - ${pct} | ${sent} | ${recv} | ${best} | ${avrg} | ${wrst} | ${last} |`;
}

describe("parseWinMtr", () => {
  describe("a real report", () => {
    const trace = parseWinMtr(REPORT);

    it("reads the source", () => {
      expect(trace.source).toBe("winmtr");
    });

    it("reads a hop per data row, numbered by position", () => {
      expect(trace.hops).toHaveLength(5);
      expect(trace.hops.map((hop) => hop.index)).toEqual([1, 2, 3, 4, 5]);
    });

    it("maps every column onto the unified hop", () => {
      expect(trace.hops[0]).toEqual({
        index: 1,
        ip: "192.168.1.1",
        loss: 0,
        best: 1,
        avg: 1,
        worst: 2,
        last: 1,
      });
    });

    it("reads a non-zero loss figure", () => {
      expect(trace.hops[3]).toMatchObject({ index: 4, ip: "203.0.113.7", loss: 10 });
    });

    it("reads a hostname as a hostname", () => {
      expect(trace.hops[4].hostname).toBe("example.com");
      expect(trace.hops[4]).not.toHaveProperty("ip");
    });

    it("takes the probe count from Sent, and the final hop as the target", () => {
      expect(trace.metadata?.packetCount).toBe(10);
      expect(trace.target).toEqual({ host: "example.com" });
    });
  });

  describe("hops that did not answer", () => {
    it("reads `???` as a missing address", () => {
      const trace = parseWinMtr(row("???", "100", ["10", "0", "0", "0", "0", "0"]));

      expect(trace.hops[0]).toEqual({ index: 1, loss: 100, best: 0, avg: 0, worst: 0, last: 0 });
      expect(trace.hops[0]).not.toHaveProperty("ip");
    });

    it("keeps a measured zero distinct from no measurement", () => {
      const trace = parseWinMtr(row("192.168.1.1", "0", ["10", "10", "1", "1", "2", "1"]));

      expect(trace.hops[0].loss).toBe(0);
    });
  });

  describe("addresses", () => {
    it("reads an IPv4 address", () => {
      const trace = parseWinMtr(row("10.0.0.1", "0", ["10", "10", "3", "3", "5", "3"]));

      expect(trace.hops[0].ip).toBe("10.0.0.1");
    });

    it("reads a compressed IPv6 address", () => {
      const trace = parseWinMtr(row("2001:db8::1", "0", ["10", "10", "3", "3", "5", "3"]));

      expect(trace.hops[0].ip).toBe("2001:db8::1");
      expect(trace.hops[0]).not.toHaveProperty("hostname");
    });
  });

  describe("input that is not a report", () => {
    it("returns no hops for empty input", () => {
      expect(parseWinMtr("").hops).toEqual([]);
    });

    it("returns no hops for input that is not a trace", () => {
      expect(parseWinMtr("hello, this is not a trace").hops).toEqual([]);
    });

    it("parses output whose banner has been stripped off", () => {
      const trace = parseWinMtr(
        [
          "|                       Host              -   %  | Sent | Recv | Best | Avrg | Wrst | Last |",
          "|------------------------------------------------|------|------|------|------|------|------|",
          "|                           192.168.1.1 -    0 |   10 |   10 |    1 |    1 |    2 |    1 |",
        ].join("\n"),
      );

      expect(trace.hops).toEqual([
        { index: 1, ip: "192.168.1.1", loss: 0, best: 1, avg: 1, worst: 2, last: 1 },
      ]);
    });

    it("does not read the column header or the rules as hops", () => {
      const trace = parseWinMtr(REPORT);

      // Five data rows in a report that carries six pipe-drawn lines besides
      // them — banner, header, two rules, and the outer frame.
      expect(trace.hops).toHaveLength(5);
    });
  });
});
