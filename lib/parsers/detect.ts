import type { TraceSource } from "@/lib/analysis/types";

/**
 * Which tool produced this text.
 *
 * The homepage's format badge and `parseTrace` both read this one function, so
 * a paste can never be labelled `MTR` and then rejected as unparseable — the
 * badge promises exactly what the parser will do.
 *
 * ## Why the order matters
 *
 * These formats overlap. WinMTR's table is built out of `|` columns that a
 * looser matcher would read as a shell artefact; NextTrace prints a
 * `traceroute to …` header, which is traceroute's marker; and MTR's `Loss%`
 * header also appears in NextTrace's MTR-style mode. So the formats with a
 * distinctive banner are claimed first, and the structural checks that follow
 * are the ones that cannot belong to anything above them.
 */

/** WinMTR's banner. */
const WINMTR_BANNER = /WinMTR/i;

/** `Avrg` — WinMTR's spelling. MTR writes `Avg`, so this cannot collide. */
const WINMTR_HEADER = /\bAvrg\b/;

/**
 * One WinMTR data row: a `|`-delimited line whose second cell holds a number.
 * Matched so that output with the banner stripped off is still recognised.
 */
const WINMTR_ROW = /^\s*\|[^|]+\|\s*\d+\s*\|/m;

const NEXTTRACE_BANNER = /NextTrace/i;

/** An ASN token, which traceroute never prints and NextTrace always may. */
const NEXTTRACE_ASN = /\bAS\d{1,6}\b/;

/** MTR's column header. Both labels are required to avoid matching prose. */
const MTR_HEADER = /Loss%/;
const MTR_HEADER_UNITS = /\bSnt\b/;

/** MTR's `1.|--` row marker. */
const MTR_ROW = /^\s*\d+\.\s*\|?-{1,2}/m;

const TRACEROUTE_HEADER = /^\s*traceroute6?\s+to\s/m;

/** A numbered row carrying a millisecond reading — traceroute's plain shape. */
const TRACEROUTE_ROW = /^\s*\d+\s+\S+.*\bms\b/m;

export function detectTraceSource(input: string): TraceSource | null {
  const text = input.trim();
  if (text.length === 0) return null;

  if (WINMTR_BANNER.test(text) || WINMTR_HEADER.test(text)) return "winmtr";
  if (WINMTR_ROW.test(text)) return "winmtr";

  if (NEXTTRACE_BANNER.test(text)) return "nexttrace";

  if (MTR_HEADER.test(text) && MTR_HEADER_UNITS.test(text)) return "mtr";
  if (MTR_ROW.test(text)) return "mtr";

  if (NEXTTRACE_ASN.test(text)) return "nexttrace";

  if (TRACEROUTE_HEADER.test(text)) return "traceroute";
  if (TRACEROUTE_ROW.test(text)) return "traceroute";

  return null;
}
