import { describe, expect, it } from "vitest";

import {
  EMPTY_VALUE,
  formatAsn,
  formatAsnNumber,
  formatCount,
  formatLocation,
  formatLoss,
  formatRtt,
  SOURCE_LABELS,
} from "@/lib/analysis/format";
import { parseTrace } from "@/lib/parsers";
import type { Hop, ParsedTrace } from "@/lib/analysis/types";

/**
 * Nothing may reach the DOM as `undefined`, `null` or `NaN`.
 *
 * These three formatters are the only route a measurement takes from a
 * `ParsedTrace` to the screen — the overview's rows and every cell of the hop
 * table go through one of them. So they are where that promise is kept, and
 * this is where it is checked: over every field of every hop shape, including
 * the one that answered nothing at all.
 */

const EMPTY_HOP: Hop = { index: 7 };

const FULL_HOP: Hop = {
  index: 1,
  ip: "93.184.216.34",
  hostname: "example.com",
  asn: { number: 4134, organization: "China Telecom" },
  location: { country: "中国", region: "广东", city: "广州" },
  loss: 0,
  last: 1.345,
  avg: 1.234,
  best: 1.123,
  worst: 1.456,
  stddev: 0.1,
};

const FORBIDDEN = ["undefined", "null", "NaN"];

function expectClean(value: string) {
  expect(value.length).toBeGreaterThan(0);
  for (const word of FORBIDDEN) {
    expect(value, `"${value}" contains ${word}`).not.toContain(word);
  }
}

describe("measurement formatting", () => {
  it("renders an unanswered hop as the empty marker, never as a zero", () => {
    // 0% loss and no loss measurement are different facts about a route.
    expect(formatLoss(EMPTY_HOP.loss)).toBe(EMPTY_VALUE);
    expect(formatRtt(EMPTY_HOP.avg)).toBe(EMPTY_VALUE);
    expect(formatLoss(0)).toBe("0%");
    expect(formatRtt(0)).toBe("0.0 ms");
  });

  it("gives every RTT the same precision, so the column scans", () => {
    expect(formatRtt(1.345)).toBe("1.3 ms");
    expect(formatRtt(40)).toBe("40.0 ms");
    expect(formatRtt(0)).toBe("0.0 ms");
  });

  it("drops the redundant decimal on loss", () => {
    expect(formatLoss(10)).toBe("10%");
    expect(formatLoss(0.5)).toBe("0.5%");
  });

  it("keeps only the location parts the lookup returned", () => {
    // GeoIP answers vary in depth: some resolve a city, some stop at the
    // country. A missing part drops out rather than leaving a dangling
    // separator or an empty tail.
    expect(
      formatLocation({ country: "中国", region: "广东", city: "广州" }),
    ).toBe("中国 · 广东 · 广州");
    expect(formatLocation({ country: "美国", region: "加利福尼亚" })).toBe(
      "美国 · 加利福尼亚",
    );
    expect(formatLocation({ country: "美国" })).toBe("美国");
    expect(formatLocation({ city: "洛杉矶" })).toBe("洛杉矶");
    expect(formatLocation({ country: "", region: "广东" })).toBe("广东");

    // No lookup has run: this is the case every hop is in today.
    expect(formatLocation(undefined)).toBe(EMPTY_VALUE);
    expect(formatLocation({})).toBe(EMPTY_VALUE);
  });

  it("joins only the ASN halves the lookup returned", () => {
    // The number and the operator are separate facts from separate places in
    // the record, so either can arrive without the other.
    expect(formatAsn({ number: 4134, organization: "China Telecom" })).toBe(
      "AS4134 / China Telecom",
    );
    expect(formatAsn({ number: 13335 })).toBe("AS13335");
    expect(formatAsn({ organization: "Cloudflare, Inc." })).toBe(
      "Cloudflare, Inc.",
    );

    // `AS0` is a number the database may legitimately hold, and it must render
    // rather than be mistaken for absence.
    expect(formatAsn({ number: 0 })).toBe("AS0");

    // No lookup has answered for this hop.
    expect(formatAsn(undefined)).toBe(EMPTY_VALUE);
    expect(formatAsn({})).toBe(EMPTY_VALUE);
  });

  it("formats the ASN number on its own", () => {
    // The IP lookup page gives the number and the operator a row each, so the
    // prefix has to be spellable without the name beside it — and it has to be
    // the same spelling the hop table shows, which is what the comparison below
    // is for.
    expect(formatAsnNumber({ number: 4134, organization: "China Telecom" })).toBe(
      "AS4134",
    );
    expect(formatAsnNumber({ number: 13335 })).toBe("AS13335");
    expect(formatAsnNumber({ number: 0 })).toBe("AS0");
    expect(formatAsnNumber({ organization: "Cloudflare, Inc." })).toBe(
      EMPTY_VALUE,
    );
    expect(formatAsnNumber(undefined)).toBe(EMPTY_VALUE);

    const both = { number: 4134, organization: "China Telecom" };
    expect(formatAsn(both).split(" / ")[0]).toBe(formatAsnNumber(both));
  });

  it("formats the hop count", () => {
    expect(formatCount(9)).toBe("9");
    expect(formatCount(0)).toBe("0");
    expect(formatCount(undefined)).toBe(EMPTY_VALUE);
  });

  it("names every source with the tool's own spelling", () => {
    expect(Object.values(SOURCE_LABELS)).toEqual([
      "MTR",
      "WinMTR",
      "NextTrace",
      "traceroute",
    ]);
  });

  it("survives every combination of present and absent fields", () => {
    // Every subset of the ten optional fields, which is 1024 hop shapes.
    const fields = [
      "ip",
      "hostname",
      "asn",
      "location",
      "loss",
      "last",
      "avg",
      "best",
      "worst",
      "stddev",
    ] as const;

    for (let mask = 0; mask < 1 << fields.length; mask += 1) {
      const hop: Hop = { index: mask + 1 };
      fields.forEach((field, bit) => {
        if ((mask & (1 << bit)) !== 0) {
          Object.assign(hop, { [field]: FULL_HOP[field] });
        }
      });

      for (const value of [
        hop.ip ?? EMPTY_VALUE,
        hop.hostname ?? EMPTY_VALUE,
        formatAsn(hop.asn),
        formatLocation(hop.location),
        formatLoss(hop.loss),
        formatRtt(hop.last),
        formatRtt(hop.avg),
        formatRtt(hop.best),
        formatRtt(hop.worst),
        formatRtt(hop.stddev),
      ]) {
        expectClean(value);
      }
    }
  });
});

describe("a trace that survives sessionStorage", () => {
  const EXAMPLES = [
    "Start: 2026-09-26T21:04:11+0800\nHOST: macbook                                    Loss%   Snt   Last   Avg  Best  Wrst StDev\n  1.|-- _gateway                                  0.0%    10    0.9   1.1   0.7   1.6   0.3",
    "|                                      WinMTR statistics                                   |\n|                       Host              -   %  | Sent | Recv | Best | Avrg | Wrst | Last |\n|                            10.0.0.1 -    0 |   10 |   10 |    1 |    2 |    5 |    1 |",
    "NextTrace v1.3.0\n 1  192.168.1.1  1.23ms\n 2  ???  0.00ms\n",
    "traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets\n 1  192.168.1.1  1.123 ms\n 2  * * *\n",
  ];

  it("reads back byte-identical to what it wrote", () => {
    // JSON drops `undefined`-valued keys, so a hop that carried one would come
    // back a different shape than it went in — and a `hop.avg === undefined`
    // check that passed before a reload could behave differently after one.
    for (const input of EXAMPLES) {
      const result = parseTrace(input);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      const stored: ParsedTrace = JSON.parse(JSON.stringify(result.trace));
      expect(stored).toEqual(result.trace);
    }
  });
});
