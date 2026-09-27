import type { Hop, ParsedTrace } from "@/lib/analysis/types";

import { compact, readAddress, readTarget, rttStats } from "./values";

/**
 * `traceroute` / `traceroute6` parser.
 *
 * The simplest of the four: a target header, then one numbered row per hop
 * carrying up to three probe RTTs. Unlike MTR, the tool names its destination
 * in the output, so the target is read rather than inferred — and unlike MTR it
 * prints each probe separately, so `last` is the final probe on the row and
 * best/worst/avg are arithmetic over the probes actually printed.
 *
 * A hop that never answered prints `* * *`, which is a row with an index and a
 * timeout and nothing else — kept, not dropped, so the route keeps its shape.
 */

/** Every `1.123 ms` on a row. */
const RTT = /(\d+(?:\.\d+)?)\s*ms/gi;

/** A hop row: a number, then the address and its probes. */
const HOP_ROW = /^\s*(\d+)\s+(.*)$/;

/**
 * `traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets`.
 *
 * The host stops at a comma, because when there is no parenthesised address the
 * separator before the hop limit would otherwise be read as part of the name.
 */
const TARGET = /^\s*traceroute6?\s+to\s+([^\s,]+)(?:\s+\(([^)]+)\))?/i;

export function parseTraceroute(input: string): ParsedTrace {
  const hops: Hop[] = [];
  let target: ParsedTrace["target"] = {};

  for (const line of input.split(/\r?\n/)) {
    const header = line.match(TARGET);
    if (header) {
      target = readTarget(header[2] ? `${header[1]} (${header[2]})` : header[1]);
      continue;
    }

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

  return { source: "traceroute", target, hops };
}
