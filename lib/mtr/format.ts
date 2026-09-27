import type { TraceSource } from "@/lib/analysis/types";
import { detectTraceSource } from "@/lib/parsers/detect";

/**
 * Trace-output format sniffing, for the homepage's "Detected format" badge.
 *
 * This is a thin label layer over the parser's own detector rather than a
 * second implementation of it. The badge sits directly above the button that
 * submits the paste, so if the two disagreed the page could promise
 * `Detected format: MTR` and then refuse the text as unrecognisable. One
 * detector means the badge cannot say anything the parser will not honour.
 */

export const TRACE_FORMATS = ["MTR", "WinMTR", "NextTrace", "traceroute"] as const;

export type TraceFormat = (typeof TRACE_FORMATS)[number];

/** `TraceSource` as the badge spells it — the tools' own capitalisation. */
const LABELS: Record<TraceSource, TraceFormat> = {
  mtr: "MTR",
  winmtr: "WinMTR",
  nexttrace: "NextTrace",
  traceroute: "traceroute",
};

/**
 * Returns the tool that most likely produced `input`, or `null` when the text
 * is empty or matches nothing recognisable — the same verdict `parseTrace`
 * reaches, in the badge's vocabulary.
 */
export function detectTraceFormat(input: string): TraceFormat | null {
  const source = detectTraceSource(input);
  return source === null ? null : LABELS[source];
}
