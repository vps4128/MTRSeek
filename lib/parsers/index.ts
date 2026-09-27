import type { ParsedTrace, ParseResult, TraceSource } from "@/lib/analysis/types";

import { detectTraceSource } from "./detect";
import { parseMtr } from "./mtr";
import { parseNextTrace } from "./nexttrace";
import { parseTraceroute } from "./traceroute";
import { parseWinMtr } from "./winmtr";

export { detectTraceSource } from "./detect";
export { parseMtr } from "./mtr";
export { parseNextTrace } from "./nexttrace";
export { parseTraceroute } from "./traceroute";
export { parseWinMtr } from "./winmtr";

/**
 * Every parser, keyed by the source it produces.
 *
 * Typed as a total map so that adding a member to `TraceSource` without
 * teaching `parseTrace` about it is a compile error rather than a paste that
 * silently falls through.
 */
const PARSERS: Record<TraceSource, (input: string) => ParsedTrace> = {
  mtr: parseMtr,
  winmtr: parseWinMtr,
  nexttrace: parseNextTrace,
  traceroute: parseTraceroute,
};

/**
 * Reads any supported trace output into a `ParsedTrace`.
 *
 * The only entry point the UI uses. It never throws and never returns a partial
 * result: a paste either becomes a trace with hops in it, or it becomes an
 * error the caller has to show. "Recognised the format but found no hops" is
 * the third case, and is kept distinct from "could not recognise it at all" so
 * the reader is told which of the two happened.
 */
export function parseTrace(input: string): ParseResult {
  if (input.trim().length === 0) {
    return {
      ok: false,
      error: { code: "EMPTY_INPUT", message: "There is nothing to parse." },
    };
  }

  const source = detectTraceSource(input);
  if (source === null) {
    return {
      ok: false,
      error: {
        code: "UNRECOGNIZED_FORMAT",
        message: "Unable to recognize trace format.",
      },
    };
  }

  const trace = PARSERS[source](input);
  if (trace.hops.length === 0) {
    return {
      ok: false,
      error: {
        code: "NO_HOPS",
        message: `Recognized ${source} output but found no hop rows in it.`,
      },
    };
  }

  return { ok: true, trace };
}
