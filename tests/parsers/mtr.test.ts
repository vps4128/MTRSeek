import { describe, expect, it } from "vitest";

import { EXAMPLE_MTR_OUTPUT } from "@/lib/mock/trace";
import { parseMtr } from "@/lib/parsers";

/**
 * MTR prints a fixed-width table, so a fixture that is not padded to the real
 * column positions would silently exercise the whitespace fallback instead of
 * the header-driven path. These helpers reproduce MTR's own alignment: the
 * header ends are the ones a real `mtr -rw` produces, which means the tests
 * read the format the way the parser does.
 */
const COLUMN_ENDS = [54, 60, 67, 73, 79, 85, 91];
const COLUMN_LABELS = ["Loss%", "Snt", "Last", "Avg", "Best", "Wrst", "StDev"];

/** One aligned row: the leading section, then one value per column. */
function row(lead: string, values: string[]): string {
  let line = lead.padEnd(COLUMN_ENDS[0] - values[0].length, " ");
  COLUMN_ENDS.forEach((end, index) => {
    const value = values[index];
    line = line.padEnd(end - value.length, " ") + value;
  });
  return line;
}

/** A full report: the column header, then the rows. */
function report(rows: string[]): string {
  return [row("HOST: server", COLUMN_LABELS), ...rows].join("\n");
}

/** A single-hop report, the shape most of the edge cases need. */
function oneHop(lead: string, values: string[]): string {
  return report([row(lead, values)]);
}

describe("parseMtr", () => {
  describe("a real report", () => {
    const trace = parseMtr(EXAMPLE_MTR_OUTPUT);

    it("reads the source and the trace metadata", () => {
      expect(trace.source).toBe("mtr");
      expect(trace.metadata?.timestamp).toBe("2026-09-26T21:04:11+0800");
      expect(trace.metadata?.packetCount).toBe(10);
    });

    it("reads every column of every hop", () => {
      expect(trace.hops).toHaveLength(9);

      expect(trace.hops[0]).toEqual({
        index: 1,
        hostname: "_gateway",
        loss: 0,
        last: 0.9,
        avg: 1.1,
        best: 0.7,
        worst: 1.6,
        stddev: 0.3,
      });

      expect(trace.hops[8]).toEqual({
        index: 9,
        hostname: "example.com",
        loss: 0,
        last: 39.6,
        avg: 40.3,
        best: 38.8,
        worst: 42.9,
        stddev: 1.5,
      });
    });

    it("takes the final hop as the target", () => {
      expect(trace.target).toEqual({ host: "example.com" });
    });
  });

  describe("hops that did not answer", () => {
    it("reads `???` as a missing address, not a hostname", () => {
      const trace = parseMtr(
        oneHop("  1.|-- ???", ["100.0%", "10", "0.0", "0.0", "0.0", "0.0", "0.0"]),
      );

      expect(trace.hops[0]).toEqual({
        index: 1,
        loss: 100,
        last: 0,
        avg: 0,
        best: 0,
        worst: 0,
        stddev: 0,
      });
      expect(trace.hops[0]).not.toHaveProperty("hostname");
      expect(trace.hops[0]).not.toHaveProperty("ip");
      // A `???` destination is not a target, and is not guessed at.
      expect(trace.target).toEqual({});
    });

    it("reads `*` as a missing address", () => {
      const trace = parseMtr(
        oneHop("  1.|-- *", ["100.0%", "10", "0.0", "0.0", "0.0", "0.0", "0.0"]),
      );

      expect(trace.hops[0].index).toBe(1);
      expect(trace.hops[0]).not.toHaveProperty("ip");
      expect(trace.hops[0]).not.toHaveProperty("hostname");
    });

    it("reads `--` as a missing address", () => {
      const trace = parseMtr(
        oneHop("  1.|-- --", ["100.0%", "10", "0.0", "0.0", "0.0", "0.0", "0.0"]),
      );

      expect(trace.hops[0]).not.toHaveProperty("hostname");
    });

    it("keeps a hop whose measurements are all `???`", () => {
      const trace = parseMtr(
        oneHop("  1.|-- 192.168.1.1", ["0.0%", "10", "???", "???", "???", "???", "???"]),
      );

      expect(trace.hops[0]).toEqual({ index: 1, ip: "192.168.1.1", loss: 0 });
    });

    it("keeps a hop row that carries nothing after the address", () => {
      const trace = parseMtr(report(["  1.|-- ???"]));

      expect(trace.hops).toEqual([{ index: 1 }]);
    });
  });

  describe("addresses", () => {
    it("reads an IPv4 address as an address, not a hostname", () => {
      const trace = parseMtr(
        oneHop("  1.|-- 192.168.1.1", ["0.0%", "10", "1.2", "1.4", "1.0", "2.1", "0.3"]),
      );

      expect(trace.hops[0].ip).toBe("192.168.1.1");
      expect(trace.hops[0]).not.toHaveProperty("hostname");
    });

    it("reads a hostname as a hostname, not an address", () => {
      const trace = parseMtr(
        oneHop("  1.|-- gateway.local", ["0.0%", "10", "1.2", "1.4", "1.0", "2.1", "0.3"]),
      );

      expect(trace.hops[0].hostname).toBe("gateway.local");
      expect(trace.hops[0]).not.toHaveProperty("ip");
    });

    it("reads a compressed IPv6 address", () => {
      const trace = parseMtr(
        oneHop("  1.|-- 2001:db8::1", ["0.0%", "10", "1.2", "1.4", "1.0", "2.1", "0.3"]),
      );

      expect(trace.hops[0].ip).toBe("2001:db8::1");
      expect(trace.hops[0]).not.toHaveProperty("hostname");
    });

    it("reads a zone-scoped IPv6 address", () => {
      const trace = parseMtr(
        oneHop("  1.|-- fe80::1%en0", ["0.0%", "10", "1.2", "1.4", "1.0", "2.1", "0.3"]),
      );

      expect(trace.hops[0].ip).toBe("fe80::1%en0");
    });
  });

  describe("loss", () => {
    it("keeps a measured zero distinct from no measurement", () => {
      const zero = parseMtr(
        oneHop("  1.|-- 192.168.1.1", ["0.0%", "10", "1.2", "1.4", "1.0", "2.1", "0.3"]),
      );
      expect(zero.hops[0].loss).toBe(0);

      const absent = parseMtr(
        oneHop("  1.|-- 192.168.1.1", ["???", "10", "1.2", "1.4", "1.0", "2.1", "0.3"]),
      );
      expect(absent.hops[0].loss).toBeUndefined();
    });

    it("reads a loss figure written without a percent sign", () => {
      const trace = parseMtr(
        oneHop("  1.|-- 192.168.1.1", ["100.0", "10", "0.0", "0.0", "0.0", "0.0", "0.0"]),
      );

      expect(trace.hops[0].loss).toBe(100);
    });

    it("reads a fractional loss figure", () => {
      const trace = parseMtr(
        oneHop("  1.|-- 192.168.1.1", ["12.5%", "10", "1.2", "1.4", "1.0", "2.1", "0.3"]),
      );

      expect(trace.hops[0].loss).toBe(12.5);
    });
  });

  describe("without a column header", () => {
    it("reads the fields in order", () => {
      const trace = parseMtr(
        "  1.|-- 192.168.1.1  0.0%  10  1.2  1.4  1.0  2.1  0.3",
      );

      expect(trace.hops[0]).toEqual({
        index: 1,
        ip: "192.168.1.1",
        loss: 0,
        last: 1.2,
        avg: 1.4,
        best: 1.0,
        worst: 2.1,
        stddev: 0.3,
      });
    });

    it("does not read the `Start:` line as a hop", () => {
      const trace = parseMtr("Start: 2026-09-27T00:00:00+0800");

      expect(trace.hops).toEqual([]);
      expect(trace.metadata?.timestamp).toBe("2026-09-27T00:00:00+0800");
    });

    it("does not read the `HOST:` line as a hop", () => {
      expect(parseMtr("HOST: server").hops).toEqual([]);
    });
  });

  describe("input that is not a report", () => {
    it("returns no hops for empty input", () => {
      expect(parseMtr("").hops).toEqual([]);
    });

    it("returns no hops for input that is not a trace", () => {
      expect(parseMtr("hello, this is not a trace").hops).toEqual([]);
    });

    it("keeps the hops it found and skips the lines it could not read", () => {
      const trace = parseMtr(
        report([
          "  1.|-- 192.168.1.1",
          "this line is not part of the table",
          "  2.|-- 10.0.0.1",
        ]),
      );

      expect(trace.hops.map((hop) => hop.index)).toEqual([1, 2]);
    });
  });
});
