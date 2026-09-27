import { describe, expect, it } from "vitest";

import { EXAMPLE_MTR_OUTPUT } from "@/lib/mock/trace";
import { detectTraceFormat } from "@/lib/mtr/format";
import { parseTrace } from "@/lib/parsers";

/**
 * The homepage badge and the button under it have to agree.
 *
 * The badge reads "Detected format: MTR" directly above the button that
 * submits the paste. If the two used separate detectors, a paste could be
 * labelled and then refused as unrecognisable — the page contradicting itself
 * in the space of one click. They share one detector, and this holds them to
 * it.
 */

const SAMPLES: Record<string, string> = {
  // The real sample, which is what the "Load Example" button loads.
  mtr: EXAMPLE_MTR_OUTPUT,
  winmtr:
    "|------------------------------------------------------------------------------------------|\n|                                      WinMTR statistics                                   |\n|                       Host              -   %  | Sent | Recv | Best | Avrg | Wrst | Last |\n|--------------------------------|------|------|------|------|------|------|------|\n|                            10.0.0.1 -    0 |   10 |   10 |    1 |    2 |    5 |    1 |\n",
  nexttrace:
    "NextTrace v1.3.0\n> 1.1.1.1\n 1  192.168.1.1  1.23ms\n 2  59.43.80.1 (AS4809) [CN]  8.12ms\n",
  traceroute:
    "traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets\n 1  192.168.1.1  1.123 ms  1.234 ms\n",
};

describe("detectTraceFormat", () => {
  it("names the tool for every format the parsers accept", () => {
    expect(detectTraceFormat(SAMPLES.mtr)).toBe("MTR");
    expect(detectTraceFormat(SAMPLES.winmtr)).toBe("WinMTR");
    expect(detectTraceFormat(SAMPLES.nexttrace)).toBe("NextTrace");
    expect(detectTraceFormat(SAMPLES.traceroute)).toBe("traceroute");
  });

  it("returns null for empty input", () => {
    expect(detectTraceFormat("")).toBeNull();
    expect(detectTraceFormat("   \n  ")).toBeNull();
  });

  it("returns null for text that is not a trace", () => {
    expect(detectTraceFormat("hello, this is not a trace")).toBeNull();
  });

  it("parses every sample it labels", () => {
    for (const [name, input] of Object.entries(SAMPLES)) {
      expect(detectTraceFormat(input), `${name} should be labelled`).not.toBeNull();
      expect(parseTrace(input).ok, `${name} should parse`).toBe(true);
    }
  });

  it("never labels text that `parseTrace` cannot recognise", () => {
    // One-directional on purpose: the badge being absent is also correct for
    // empty input, which `parseTrace` reports as `EMPTY_INPUT` rather than as
    // an unrecognised format. What would be a contradiction is a label on text
    // the parser then refuses.
    for (const input of [...Object.values(SAMPLES), "", "   ", "not a trace"]) {
      if (detectTraceFormat(input) === null) continue;

      const result = parseTrace(input);
      expect(
        result.ok || result.error.code !== "UNRECOGNIZED_FORMAT",
        `labelled but refused: ${JSON.stringify(input)}`,
      ).toBe(true);
    }
  });
});
