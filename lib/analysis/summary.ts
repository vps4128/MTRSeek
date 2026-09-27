import type { Hop, ParsedTrace } from "./types";

/**
 * The Route Summary: four numbers, each one read off a single hop.
 *
 * ## Which hop the numbers come from
 *
 * A trace is a sequence of measurements taken at different distances from the
 * reader, so "the average RTT" is only meaningful once you say *of what*. The
 * first hop is a router in the same building and the last is the destination;
 * averaging them together would produce a figure that describes neither. So
 * every figure here comes from the destination end of the route — the last hop
 * that actually carries the measurement — which is the hop the trace was run to
 * measure in the first place.
 *
 * Loss needs one more word of care. Intermediate routers routinely drop probe
 * packets that they would happily forward, so a mid-route hop can show loss
 * that says nothing about the connection. The destination's own loss is the one
 * that is end-to-end. Taking the last hop that carries a loss figure gets that
 * right whenever the destination answered, and degrades to the nearest hop that
 * did when it did not.
 *
 * ## Absence is not zero
 *
 * Every field is optional and stays optional. A hop that never answered has no
 * RTT, so the summary has no average RTT — and the UI shows an em dash rather
 * than a `0 ms` that would be a measurement nobody took.
 */
export type RouteSummary = {
  /** How many hops the route has, answered or not. */
  hopCount: number;

  packetLoss?: number;

  avg?: number;

  best?: number;

  worst?: number;
};

/** The last hop satisfying `has`, or `undefined` when none does. */
function lastHopWith(
  hops: Hop[],
  has: (hop: Hop) => boolean,
): Hop | undefined {
  for (let index = hops.length - 1; index >= 0; index -= 1) {
    const hop = hops[index];
    if (hop !== undefined && has(hop)) return hop;
  }
  return undefined;
}

function carriesRtt(hop: Hop): boolean {
  return (
    hop.avg !== undefined ||
    hop.best !== undefined ||
    hop.worst !== undefined ||
    hop.last !== undefined
  );
}

export function summarize(trace: ParsedTrace): RouteSummary {
  const measured = lastHopWith(trace.hops, carriesRtt);
  const loss = lastHopWith(trace.hops, (hop) => hop.loss !== undefined);

  return {
    hopCount: trace.hops.length,
    packetLoss: loss?.loss,
    // Read straight across, with no stand-in: a hop that reported only `last`
    // has no average, and showing its last probe under an "Average RTT" label
    // would be a different measurement wearing the wrong name.
    avg: measured?.avg,
    best: measured?.best,
    worst: measured?.worst,
  };
}
