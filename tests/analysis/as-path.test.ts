import { describe, expect, it } from "vitest";

import { buildAsPath } from "@/lib/analysis/as-path";
import type { Hop, HopAsn } from "@/lib/analysis/types";

/**
 * Folding hops into the observed AS path.
 *
 * The rule this file exists to hold is narrower than "remove duplicate ASNs".
 * Consecutive hops in the same AS are one segment; anything else is left alone.
 * A return to an AS the trace had already crossed is a real event and must
 * survive, and a hop that resolved to nothing must not be stepped over — the
 * failure mode of a careless implementation is not a crash, it is a path that
 * reads as continuous when the trace never showed it was.
 *
 * ## What is not tested here, and why
 *
 * Nothing checks a BGP path, because nothing produces one. There is no lookup,
 * no database and no network call in this module; the input is hops and the
 * output is segments, which is what makes the assertions below possible
 * without a fixture.
 */

/** A hop with an AS, or with nothing at all — the two shapes that matter here. */
function hop(index: number, asn?: HopAsn, ip?: string): Hop {
  return {
    index,
    ...(asn === undefined ? {} : { asn }),
    ...(ip === undefined ? {} : { ip }),
  };
}

const CHINA_TELECOM: HopAsn = { number: 4809, organization: "China Telecom" };
const CHINANET: HopAsn = { number: 4134, organization: "Chinanet" };
const CNC: HopAsn = { number: 23764, organization: "China Unicom" };

describe("the observed AS path", () => {
  it("folds consecutive hops of one AS into a segment with its hop range", () => {
    const segments = buildAsPath([
      hop(1, CHINA_TELECOM),
      hop(2, CHINA_TELECOM),
      hop(3, CHINANET),
      hop(4, CHINANET),
      hop(5, CNC),
    ]);

    expect(segments).toEqual([
      { asn: 4809, organization: "China Telecom", startHop: 1, endHop: 2 },
      { asn: 4134, organization: "Chinanet", startHop: 3, endHop: 4 },
      { asn: 23764, organization: "China Unicom", startHop: 5, endHop: 5 },
    ]);
  });

  it("keeps a return to an AS the trace had already crossed", () => {
    // The whole value of the sequence is here. `AS4809 → AS4134 → AS4809` is
    // three segments: the trace left 4809 and came back, and a deduplicating
    // pass would report a two-AS path that never happened.
    const segments = buildAsPath([
      hop(1, CHINA_TELECOM),
      hop(2, CHINA_TELECOM),
      hop(3, CHINANET),
      hop(4, CHINA_TELECOM),
    ]);

    expect(segments.map((segment) => segment.asn)).toEqual([4809, 4134, 4809]);
    expect(segments[2]).toEqual({
      asn: 4809,
      organization: "China Telecom",
      startHop: 4,
      endHop: 4,
    });
  });

  it("never merges across a hop that resolved to nothing", () => {
    // Hop 2 is a `???` timeout, or an address no database has a record for, or
    // one of the private addresses the lookup refuses. Whichever it is, whether
    // the trace stayed inside 4809 across it is not known — so the two known
    // runs stay two segments, and the break in the hop numbering is what says
    // so to whatever draws them.
    const segments = buildAsPath([
      hop(1, CHINA_TELECOM),
      hop(2),
      hop(3, CHINANET),
    ]);

    expect(segments).toEqual([
      { asn: 4809, organization: "China Telecom", startHop: 1, endHop: 1 },
      { asn: 4134, organization: "Chinanet", startHop: 3, endHop: 3 },
    ]);
  });

  it("does not bridge a gap even when the same AS sits on both sides", () => {
    // The case that separates "merge consecutive" from "merge equal": the same
    // number appears twice with an unresolved hop between them, and the two
    // runs must stay apart.
    const segments = buildAsPath([
      hop(1, CHINA_TELECOM),
      hop(2),
      hop(3, CHINA_TELECOM),
    ]);

    expect(segments).toHaveLength(2);
    expect(segments[0]?.endHop).toBe(1);
    expect(segments[1]?.startHop).toBe(3);
    // The ranges themselves carry the gap, which is what the section draws.
    expect(segments[0]!.endHop + 1).not.toBe(segments[1]!.startHop);
  });

  it("returns nothing when no hop resolved to an AS", () => {
    // §8: no filler. This is an ordinary state — a private-address trace, or a
    // deployment with no database — and it produces an empty section rather
    // than a placeholder, an `AS0`, or the word "Unknown".
    expect(buildAsPath([hop(1), hop(2), hop(3)])).toEqual([]);
    expect(buildAsPath([])).toEqual([]);
  });

  it("starts nothing for a record that has an organization and no number", () => {
    // `HopAsn` carries two optional halves, and a record can hold the name
    // without the number. There is no identity to merge on and no number to
    // print, so the hop is a gap like any other.
    expect(buildAsPath([hop(1, { organization: "China Telecom" })])).toEqual(
      [],
    );
  });

  it("reads IPv6 hops exactly as it reads IPv4 ones", () => {
    // Nothing here parses or inspects an address; the AS comes off the hop. The
    // test is here so that stays true if the module ever grows a reason to look.
    const segments = buildAsPath([
      hop(1, CHINA_TELECOM, "240e:1:2::1"),
      hop(2, CHINA_TELECOM, "240e:1:2::2"),
      hop(3, CHINANET, "2001:db8::1"),
    ]);

    expect(segments).toEqual([
      { asn: 4809, organization: "China Telecom", startHop: 1, endHop: 2 },
      { asn: 4134, organization: "Chinanet", startHop: 3, endHop: 3 },
    ]);
  });

  it("identifies a segment by its number, not by its organization", () => {
    // Two records for one allocation can spell the name differently or omit it,
    // and a name is not what an AS is. Merging is by number, the first name
    // seen is the one kept, and an unnamed neighbour leaves it in place.
    const named = buildAsPath([hop(1, CHINA_TELECOM), hop(2, { number: 4809 })]);

    expect(named).toHaveLength(1);
    expect(named[0]?.organization).toBe("China Telecom");

    const renamed = buildAsPath([
      hop(1, { number: 4809, organization: "China Telecom" }),
      hop(2, { number: 4809, organization: "CHINANET-BACKBONE" }),
    ]);

    expect(renamed).toHaveLength(1);
    expect(renamed[0]?.organization).toBe("China Telecom");

    // The other direction: one name, two numbers, two segments.
    const shared = buildAsPath([
      hop(1, { number: 13335, organization: "Cloudflare, Inc." }),
      hop(2, { number: 15169, organization: "Cloudflare, Inc." }),
    ]);

    expect(shared.map((segment) => segment.asn)).toEqual([13335, 15169]);
  });

  it("handles a single hop and a hop with no organization", () => {
    expect(buildAsPath([hop(1, CHINA_TELECOM)])).toEqual([
      { asn: 4809, organization: "China Telecom", startHop: 1, endHop: 1 },
    ]);
    expect(buildAsPath([hop(1, { number: 35908 })])).toEqual([
      { asn: 35908, organization: undefined, startHop: 1, endHop: 1 },
    ]);
  });

  it("treats AS0 as a number, not as an absence", () => {
    // The database may legitimately hold 0, and `0` is not `undefined` — the
    // distinction the hop table already relies on for loss and RTT.
    expect(buildAsPath([hop(1, { number: 0 })])).toEqual([
      { asn: 0, organization: undefined, startHop: 1, endHop: 1 },
    ]);
  });
});
