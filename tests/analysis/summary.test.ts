import { describe, expect, it } from "vitest";

import { summarize } from "@/lib/analysis/summary";
import type { Hop, ParsedTrace } from "@/lib/analysis/types";

function trace(hops: Hop[]): ParsedTrace {
  return { source: "mtr", target: {}, hops };
}

describe("summarize", () => {
  it("counts every hop, answered or not", () => {
    const summary = summarize(
      trace([{ index: 1, ip: "10.0.0.1" }, { index: 2 }, { index: 3 }]),
    );

    expect(summary.hopCount).toBe(3);
  });

  it("reads the RTT figures off the destination hop, not an average of the route", () => {
    const summary = summarize(
      trace([
        { index: 1, ip: "10.0.0.1", last: 1, avg: 1, best: 1, worst: 1 },
        { index: 2, ip: "10.0.0.2", last: 8, avg: 9, best: 7, worst: 12 },
      ]),
    );

    // The first hop's 1ms describes a router in the same building; folding it
    // in would report a route that is faster than its own destination.
    expect(summary.avg).toBe(9);
    expect(summary.best).toBe(7);
    expect(summary.worst).toBe(12);
  });

  it("skips a destination that did not answer and uses the nearest hop that did", () => {
    const summary = summarize(
      trace([
        { index: 1, ip: "10.0.0.1", avg: 1 },
        { index: 2, ip: "10.0.0.2", avg: 9 },
        { index: 3 },
      ]),
    );

    expect(summary.avg).toBe(9);
  });

  it("takes loss from the destination hop, where loss is end-to-end", () => {
    const summary = summarize(
      trace([
        // A mid-route router dropping probes it would happily forward: this is
        // the number that would be misread as connection loss.
        { index: 1, ip: "10.0.0.1", loss: 30, avg: 1 },
        { index: 2, ip: "93.184.216.34", loss: 0, avg: 9 },
      ]),
    );

    expect(summary.packetLoss).toBe(0);
  });

  it("keeps 0% loss distinct from no measurement", () => {
    expect(summarize(trace([{ index: 1, ip: "10.0.0.1", loss: 0 }])).packetLoss).toBe(0);
    expect(
      summarize(trace([{ index: 1, ip: "10.0.0.1" }])).packetLoss,
    ).toBeUndefined();
  });

  it("reports no RTT at all when the route was never measured", () => {
    const summary = summarize(trace([{ index: 1 }, { index: 2 }]));

    expect(summary.avg).toBeUndefined();
    expect(summary.best).toBeUndefined();
    expect(summary.worst).toBeUndefined();
  });

  it("does not stand in `last` for a missing average", () => {
    const summary = summarize(trace([{ index: 1, ip: "10.0.0.1", last: 4.2 }]));

    expect(summary.avg).toBeUndefined();
  });

  it("handles an empty route", () => {
    expect(summarize(trace([]))).toEqual({
      hopCount: 0,
      packetLoss: undefined,
      avg: undefined,
      best: undefined,
      worst: undefined,
    });
  });
});
