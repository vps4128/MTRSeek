import { describe, expect, it } from "vitest";

import { EXAMPLE_MTR_OUTPUT } from "@/lib/mock/trace";
import { detectTraceSource, parseTrace } from "@/lib/parsers";

const WINMTR = `|                                      WinMTR statistics                                   |
|                       Host              -   %  | Sent | Recv | Best | Avrg | Wrst | Last |
|------------------------------------------------|------|------|------|------|------|------|
|                           192.168.1.1 -    0 |   10 |   10 |    1 |    1 |    2 |    1 |
`;

const NEXTTRACE = `NextTrace v1.3.0 2024-05-01T12:00:00Z 6c1f0d
traceroute to 1.1.1.1, 30 hops max, 32 byte packets
1   10.0.0.1  0.42ms
`;

const TRACEROUTE = `traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets
 1  192.168.1.1  1.123 ms
`;

describe("detectTraceSource", () => {
  it("identifies each format", () => {
    expect(detectTraceSource(EXAMPLE_MTR_OUTPUT)).toBe("mtr");
    expect(detectTraceSource(WINMTR)).toBe("winmtr");
    expect(detectTraceSource(NEXTTRACE)).toBe("nexttrace");
    expect(detectTraceSource(TRACEROUTE)).toBe("traceroute");
  });

  it("claims WinMTR before MTR, whose `Loss%` header NextTrace also prints", () => {
    // WinMTR output carries `%` and a pipe table; it must not be read as MTR.
    expect(detectTraceSource(WINMTR)).not.toBe("mtr");
    // NextTrace names its own format and prints a traceroute header.
    expect(detectTraceSource(NEXTTRACE)).not.toBe("traceroute");
  });

  it("recognises MTR output that has been stripped to its rows", () => {
    expect(detectTraceSource("  1.|-- 192.168.1.1  0.0%  10  1.2  1.4  1.0  2.1  0.3")).toBe("mtr");
  });

  it("recognises NextTrace output with its banner removed", () => {
    expect(detectTraceSource("1   59.43.80.1  AS4809  5.20ms")).toBe("nexttrace");
  });

  it("recognises traceroute output with its header removed", () => {
    expect(detectTraceSource(" 1  192.168.1.1  1.123 ms\n 2  10.0.0.1  3.456 ms")).toBe(
      "traceroute",
    );
  });

  it("returns null for empty input", () => {
    expect(detectTraceSource("")).toBeNull();
    expect(detectTraceSource("   \n  ")).toBeNull();
  });

  it("returns null for input that is not a trace", () => {
    expect(detectTraceSource("hello, this is not a trace")).toBeNull();
    expect(detectTraceSource('{"json": true}')).toBeNull();
  });
});

describe("parseTrace", () => {
  it("dispatches to the parser the format belongs to", () => {
    expect(parseTrace(EXAMPLE_MTR_OUTPUT)).toMatchObject({ ok: true, trace: { source: "mtr" } });
    expect(parseTrace(WINMTR)).toMatchObject({ ok: true, trace: { source: "winmtr" } });
    expect(parseTrace(NEXTTRACE)).toMatchObject({ ok: true, trace: { source: "nexttrace" } });
    expect(parseTrace(TRACEROUTE)).toMatchObject({ ok: true, trace: { source: "traceroute" } });
  });

  it("carries the parsed hops through", () => {
    const result = parseTrace(EXAMPLE_MTR_OUTPUT);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.trace.hops).toHaveLength(9);
  });

  describe("failures", () => {
    it("reports empty input", () => {
      expect(parseTrace("")).toMatchObject({ ok: false, error: { code: "EMPTY_INPUT" } });
      expect(parseTrace("  \n\t ")).toMatchObject({ ok: false, error: { code: "EMPTY_INPUT" } });
    });

    it("reports a format it could not recognise", () => {
      expect(parseTrace("hello, this is not a trace")).toMatchObject({
        ok: false,
        error: { code: "UNRECOGNIZED_FORMAT" },
      });
    });

    it("reports a recognised format that yielded no hops", () => {
      // A column header with no rows under it.
      const headerOnly =
        "HOST: server                                    Loss%   Snt   Last   Avg  Best  Wrst StDev";

      expect(parseTrace(headerOnly)).toMatchObject({ ok: false, error: { code: "NO_HOPS" } });
    });

    it("tells `could not recognise` apart from `found no hops`", () => {
      const unrecognised = parseTrace("hello, this is not a trace");
      const headerOnly = parseTrace("HOST: server   Loss%   Snt   Last   Avg  Best  Wrst StDev");

      expect(unrecognised.ok).toBe(false);
      expect(headerOnly.ok).toBe(false);
      if (!unrecognised.ok && !headerOnly.ok) {
        expect(unrecognised.error.code).not.toBe(headerOnly.error.code);
      }
    });

    it("never returns a trace alongside an error", () => {
      const result = parseTrace("hello, this is not a trace");

      expect(result).not.toHaveProperty("trace");
    });
  });
});
