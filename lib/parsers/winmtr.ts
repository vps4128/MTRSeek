import type { Hop, ParsedTrace } from "@/lib/analysis/types";

import { compact, readAddress, readTarget, toLoss, toNumber } from "./values";

/**
 * WinMTR parser.
 *
 * WinMTR draws its table with `|` rules, so the columns are delimited rather
 * than merely aligned, and a row can be split on the pipe instead of measured
 * against a header. What that buys is that the banner, the column header and
 * the `|---|` rules are all rejected by the same numeric check that accepts a
 * data row — none of them need to be recognised by name, and a paste with the
 * banner stripped off parses the same way.
 *
 * WinMTR prints no hop numbers: the row's position in the table *is* the hop
 * index. It also prints no sub-second precision, so RTTs arrive as whole
 * milliseconds.
 */

/**
 * A data row's cells, with the outer pipes removed.
 *
 * `| host - % | Sent | Recv | Best | Avrg | Wrst | Last |` splits into a
 * leading and a trailing empty cell; everything between them is the row.
 */
function readCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  if (trimmed.length < 2) return null;

  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());

  // host, Sent, Recv, Best, Avrg, Wrst, Last.
  if (cells.length !== 7) return null;

  return cells;
}

export function parseWinMtr(input: string): ParsedTrace {
  const hops: Hop[] = [];
  let packetCount: number | undefined;

  for (const line of input.split(/\r?\n/)) {
    const cells = readCells(line);
    if (cells === null) continue;

    const [head, sent, , best, avg, worst, last] = cells;

    // The guard that separates a data row from the column header and the
    // `|---|` rules: every cell after the first must be a plain number.
    const readings = [sent, best, avg, worst, last].map(toNumber);
    if (readings.some((value) => value === undefined)) continue;

    // `192.168.1.1 - 0`, or `??? - 100` for a hop that never answered.
    const host = head.match(/^(.*?)\s+-\s+(\S+)$/);
    if (host === null) continue;

    const [, address, loss] = host;

    hops.push(
      compact({
        index: hops.length + 1,
        ...readAddress(address),
        loss: toLoss(loss),
        best: readings[1],
        avg: readings[2],
        worst: readings[3],
        last: readings[4],
      }),
    );

    const probes = readings[0];
    if (probes !== undefined) {
      packetCount = packetCount === undefined ? probes : Math.max(packetCount, probes);
    }
  }

  const last = hops[hops.length - 1];

  return {
    source: "winmtr",
    // As with MTR, the target was a command argument and is not in the output;
    // the final hop stands in for it.
    target: last ? readTarget(last.hostname ?? last.ip ?? "") : {},
    hops,
    metadata: { packetCount },
  };
}
