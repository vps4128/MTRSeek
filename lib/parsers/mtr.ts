import type { Hop, ParsedTrace } from "@/lib/analysis/types";

import { compact, readAddress, readTarget, toLoss, toNumber } from "./values";

/**
 * Linux MTR report parser (`mtr -r`, `mtr -rw`, `mtr --report`).
 *
 * ## Why the header is read first
 *
 * MTR prints a fixed-width table: every value is right-aligned to the right
 * edge of its column, and the header labels sit in those same columns. So the
 * header line is a coordinate system, and each row is read by slicing it at the
 * label boundaries rather than by splitting on whitespace.
 *
 * That matters for the rows a whitespace split gets wrong. `1.|-- ???` with no
 * measurements, a hostname containing a space, `???` sitting where an RTT
 * should be — all of them keep their column positions, and only the slice knows
 * where each field was. Splitting on whitespace also cannot tell `???` the
 * hostname from `???` the RTT without guessing.
 *
 * When the header is absent — someone pasted only the rows — the parser falls
 * back to reading the fixed fields in order, which is what the format
 * guarantees when it is not padded.
 */

/** MTR's columns, in the order it prints them. */
const COLUMNS = ["Loss%", "Snt", "Last", "Avg", "Best", "Wrst", "StDev"] as const;

/**
 * A hop row: `1.|-- host`, `1. |-- host`, `1. host` or `1 |-- host`.
 *
 * The dot or the `|--` is required, which is what keeps a timestamp such as
 * `2026-09-27T00:00:00+0800` from being read as hop 2026.
 */
const HOP_ROW = /^\s*(\d+)\s*(?:\.\s*(?:\|?-{0,2})?|\|--)\s*(.*)$/;

/**
 * The right edge of each column, found from the header.
 *
 * Returns `null` when the line is not an MTR header, which is also what tells
 * the caller to use the whitespace fallback.
 */
function readLayout(header: string): number[] | null {
  const ends: number[] = [];
  let cursor = 0;

  for (const label of COLUMNS) {
    const at = header.indexOf(label, cursor);
    if (at === -1) return null;
    cursor = at + label.length;
    ends.push(cursor);
  }

  return ends;
}

/** The text of one column, or `undefined` when the row stops short of it. */
function column(line: string, from: number, to: number): string | undefined {
  if (line.length <= from) return undefined;
  return line.slice(from, to);
}

/**
 * Splits a row's leading section into the hop number, the address and the loss
 * figure.
 *
 * The loss is read as the trailing token and then validated as a number, so a
 * row that carries no loss at all does not have its address mistaken for one.
 */
function readHead(head: string): {
  index: number;
  address?: string;
  loss?: number;
} | null {
  const match = head.match(HOP_ROW);
  if (!match) return null;

  const index = Number(match[1]);
  const rest = (match[2] ?? "").replace(/\s+$/, "");
  if (rest.length === 0) return { index };

  const token = rest.split(/\s+/).pop() ?? "";
  const loss = toLoss(token);
  if (loss === undefined) return { index, address: rest };

  const address = rest.slice(0, rest.length - token.length).trim();
  return { index, address: address.length > 0 ? address : undefined, loss };
}

/**
 * Fields read in order from a row's tail, for output with no header to measure
 * against: `loss snt last avg best wrst stdev`.
 */
function readFields(tokens: string[]): Partial<Hop> {
  const [loss, , last, avg, best, worst, stddev] = tokens;
  return compact({
    loss: toLoss(loss),
    last: toNumber(last),
    avg: toNumber(avg),
    best: toNumber(best),
    worst: toNumber(worst),
    stddev: toNumber(stddev),
  });
}

function parseRow(line: string, layout: number[] | null): Hop | null {
  const match = line.match(HOP_ROW);
  if (!match) return null;

  const index = Number(match[1]);
  const body = match[2] ?? "";

  if (layout === null) {
    const tokens = body.split(/\s+/).filter(Boolean);
    // Eight tokens or more means the address came through as well; fewer means
    // the row is measurements only, and the hop never answered.
    if (tokens.length >= 8) {
      return compact({
        index,
        ...readAddress(tokens[0]),
        ...readFields(tokens.slice(1)),
      });
    }
    return compact({ index, ...readFields(tokens) });
  }

  const head = readHead(line.slice(0, layout[0]));
  if (head === null) return null;

  return compact({
    index: head.index,
    ...readAddress(head.address ?? ""),
    loss: head.loss,
    last: toNumber(column(line, layout[1], layout[2])),
    avg: toNumber(column(line, layout[2], layout[3])),
    best: toNumber(column(line, layout[3], layout[4])),
    worst: toNumber(column(line, layout[4], layout[5])),
    stddev: toNumber(column(line, layout[5], layout[6])),
  });
}

export function parseMtr(input: string): ParsedTrace {
  const lines = input.split(/\r?\n/);

  const layout = lines.map(readLayout).find((found) => found !== null) ?? null;

  const hops: Hop[] = [];
  let timestamp: string | undefined;
  let packetCount: number | undefined;

  for (const line of lines) {
    const start = line.match(/^\s*Start:\s*(\S+)/);
    if (start) {
      timestamp = start[1];
      continue;
    }

    const hop = parseRow(line, layout);
    if (hop === null) continue;

    hops.push(hop);

    // `Snt` is the probe count per hop. It is normally identical on every row,
    // so the largest value is the one no interrupted run cut short.
    if (layout !== null) {
      const sent = toNumber(column(line, layout[0], layout[1]));
      if (sent !== undefined) {
        packetCount = packetCount === undefined ? sent : Math.max(packetCount, sent);
      }
    }
  }

  const last = hops[hops.length - 1];

  return {
    source: "mtr",
    // MTR does not print the target — it was an argument to the command — so
    // the trace's final hop stands in: it is the destination by definition of a
    // trace. A `???` final hop leaves the target empty rather than guessed at.
    target: last ? readTarget(last.hostname ?? last.ip ?? "") : {},
    hops,
    metadata: { timestamp, packetCount },
  };
}
