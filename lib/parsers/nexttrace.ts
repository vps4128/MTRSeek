import type { Hop, ParsedTrace } from "@/lib/analysis/types";

import { compact, readAddress, readTarget, rttStats } from "./values";

/**
 * NextTrace text parser.
 *
 * NextTrace is the least fixed of the four formats: it prints a banner, a
 * header, per-hop rows and a summary, and the row shape changes with the flags
 * it was run under — an ASN here, a country code and ISP name there, sometimes
 * a bare address. So nothing here is matched as a whole line. Each line is
 * asked two independent questions — "is there a hop number?" and "which
 * millisecond readings are on it?" — and a line that answers neither is
 * skipped, leaving the hops around it intact.
 *
 * Only the hop number, the address and the RTTs are read. NextTrace's ASN, ISP
 * and geolocation columns are deliberately dropped: they are the tool's own
 * lookups, not something RouteLens resolved, and this phase resolves nothing.
 */

/** Every `12.3ms` / `12.3 ms` on a line. */
const RTT = /(\d+(?:\.\d+)?)\s*ms/gi;

/** A hop row: a number, then whatever the run was asked to print. */
const HOP_ROW = /^\s*(\d+)\s+(.*)$/;

/**
 * `traceroute to 1.1.1.1, 30 hops max, 32 byte packets`.
 *
 * The host stops at a comma: NextTrace writes the hop limit straight after it,
 * and without this the separator would be read as part of the name.
 */
const TARGET = /^\s*traceroute6?\s+to\s+([^\s,]+)(?:\s+\(([^)]+)\))?/i;

/** The banner and the column header — identified, never read as hops. */
const NOT_A_HOP = /nexttrace|^\s*\|/i;

/**
 * NextTrace's closing line, `2 hops, 5.60ms`. It has a hop number and an RTT by
 * shape, so without this it would be read as a hop called `hops,`.
 */
const SUMMARY = /^\s*\d+\s+hops?\b/i;

export function parseNextTrace(input: string): ParsedTrace {
  const hops: Hop[] = [];
  let target: ParsedTrace["target"] = {};

  for (const line of input.split(/\r?\n/)) {
    const header = line.match(TARGET);
    if (header) {
      target = readTarget(header[2] ? `${header[1]} (${header[2]})` : header[1]);
      continue;
    }

    if (NOT_A_HOP.test(line) || SUMMARY.test(line)) continue;

    const row = line.match(HOP_ROW);
    if (row === null) continue;

    const rtts: number[] = [];
    const remainder = row[2].replace(RTT, (_match, value: string) => {
      rtts.push(Number(value));
      return " ";
    });

    hops.push(
      compact({
        index: Number(row[1]),
        ...readAddress(remainder),
        ...rttStats(rtts),
      }),
    );
  }

  const last = hops[hops.length - 1];
  if (target.host === undefined && target.ip === undefined && last) {
    target = readTarget(last.hostname ?? last.ip ?? "");
  }

  return { source: "nexttrace", target, hops };
}
