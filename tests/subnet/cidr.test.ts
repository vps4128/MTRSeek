import { describe, expect, it } from "vitest";

import { parseCidr } from "@/lib/subnet/cidr";
import type { SubnetFacts } from "@/lib/subnet/cidr";

/**
 * The facts of a parse that had to succeed.
 *
 * Throwing here rather than asserting `ok` in every test keeps the tests about
 * the arithmetic: a case that stops parsing fails loudly with the code that came
 * back instead of on an unrelated `undefined`.
 */
function facts(input: string): SubnetFacts {
  const result = parseCidr(input);
  if (!result.ok) {
    throw new Error(`expected ${JSON.stringify(input)} to parse, got ${result.code}`);
  }
  return result.facts;
}

/** The error code of a parse that had to fail. */
function codeOf(input: string): string {
  const result = parseCidr(input);
  if (result.ok) throw new Error(`expected ${JSON.stringify(input)} to fail`);
  return result.code;
}

describe("parseCidr", () => {
  describe("the ordinary case", () => {
    it("reads a /24 into all eight facts", () => {
      const f = facts("192.168.1.0/24");

      expect(f.address).toBe("192.168.1.0");
      expect(f.prefix).toBe(24);
      expect(f.cidr).toBe("192.168.1.0/24");
      expect(f.mask).toBe("255.255.255.0");
      expect(f.wildcard).toBe("0.0.0.255");
      expect(f.network).toBe("192.168.1.0");
      expect(f.broadcast).toBe("192.168.1.255");
      expect(f.first).toBe("192.168.1.1");
      expect(f.last).toBe("192.168.1.254");
      expect(f.hosts).toBe(254);
    });

    it("keeps the typed address while reporting the network it falls in", () => {
      // The two rows are separate on the page for this reason: a reader who
      // typed a host address is shown the address they typed *and* the network
      // it belongs to, not one silently rewritten into the other.
      const f = facts("192.168.1.5/24");

      expect(f.address).toBe("192.168.1.5");
      expect(f.network).toBe("192.168.1.0");
      expect(f.cidr).toBe("192.168.1.0/24");
      expect(f.broadcast).toBe("192.168.1.255");
    });
  });

  describe("prefixes that split an octet", () => {
    it("halves a /25 at the halfway point", () => {
      const f = facts("192.168.1.0/25");

      expect(f.mask).toBe("255.255.255.128");
      expect(f.network).toBe("192.168.1.0");
      expect(f.broadcast).toBe("192.168.1.127");
      expect(f.first).toBe("192.168.1.1");
      expect(f.last).toBe("192.168.1.126");
      expect(f.hosts).toBe(126);
    });

    it("puts a host in the upper half of a /25 in the upper subnet", () => {
      const f = facts("192.168.1.200/25");

      expect(f.network).toBe("192.168.1.128");
      expect(f.broadcast).toBe("192.168.1.255");
      expect(f.first).toBe("192.168.1.129");
      expect(f.last).toBe("192.168.1.254");
    });

    it("reads a /30 as two usable addresses", () => {
      const f = facts("10.0.0.0/30");

      expect(f.mask).toBe("255.255.255.252");
      expect(f.first).toBe("10.0.0.1");
      expect(f.last).toBe("10.0.0.2");
      expect(f.hosts).toBe(2);
    });

    it("crosses an octet boundary", () => {
      const f = facts("172.16.0.0/12");

      expect(f.mask).toBe("255.240.0.0");
      expect(f.broadcast).toBe("172.31.255.255");
      expect(f.last).toBe("172.31.255.254");
    });
  });

  describe("the two prefixes with no broadcast address", () => {
    // RFC 3021: a /31 is a point-to-point link with two usable addresses and
    // no network or broadcast address at all. The arithmetic that subtracts
    // those two from every other prefix reports 0 here, which is wrong.
    it("gives a /31 both of its addresses and no broadcast", () => {
      const f = facts("10.0.0.0/31");

      expect(f.hosts).toBe(2);
      expect(f.first).toBe("10.0.0.0");
      expect(f.last).toBe("10.0.0.1");
      expect(f.broadcast).toBeUndefined();
    });

    it("gives a /32 the one address it has and no broadcast", () => {
      const f = facts("10.0.0.7/32");

      expect(f.network).toBe("10.0.0.7");
      expect(f.hosts).toBe(1);
      expect(f.first).toBe("10.0.0.7");
      expect(f.last).toBe("10.0.0.7");
      expect(f.broadcast).toBeUndefined();
    });
  });

  describe("the ends of the range", () => {
    it("reads a /0 as the whole address space", () => {
      const f = facts("0.0.0.0/0");

      expect(f.mask).toBe("0.0.0.0");
      expect(f.wildcard).toBe("255.255.255.255");
      expect(f.broadcast).toBe("255.255.255.255");
      expect(f.first).toBe("0.0.0.1");
      expect(f.last).toBe("255.255.255.254");
      expect(f.hosts).toBe(4294967294);
    });

    it("reads a /8 and a /16 mask", () => {
      expect(facts("10.0.0.0/8").mask).toBe("255.0.0.0");
      expect(facts("172.16.0.0/16").mask).toBe("255.255.0.0");
    });

    it("counts 2^(32-prefix) - 2 hosts wherever that fits", () => {
      for (const [prefix, hosts] of [
        [1, 2147483646],
        [16, 65534],
        [20, 4094],
        [29, 6],
        [30, 2],
      ] as const) {
        expect(facts(`10.0.0.0/${prefix}`).hosts).toBe(hosts);
      }
    });

    it("keeps the wildcard the exact complement of the mask", () => {
      for (let prefix = 0; prefix <= 32; prefix++) {
        const f = facts(`10.20.30.40/${prefix}`);
        const sum =
          f.mask.split(".").reduce((n, o) => n * 256 + Number(o), 0) +
          f.wildcard.split(".").reduce((n, o) => n * 256 + Number(o), 0);

        expect(sum).toBe(4294967295);
      }
    });
  });

  describe("what it accepts", () => {
    it("tolerates surrounding and inner whitespace", () => {
      expect(facts("  192.168.1.0/24  ").cidr).toBe("192.168.1.0/24");
      expect(facts("192.168.1.0 / 24").cidr).toBe("192.168.1.0/24");
    });

    it("accepts every octet at its limits", () => {
      expect(facts("0.0.0.0/32").network).toBe("0.0.0.0");
      expect(facts("255.255.255.255/32").network).toBe("255.255.255.255");
    });

    it("reads the broadcast of the widest subnet that still has one", () => {
      // 255.255.255.255 as a host address in a /1 site.
      expect(facts("255.255.255.255/1").network).toBe("128.0.0.0");
    });
  });

  describe("what it rejects", () => {
    it("reports empty input separately from malformed input", () => {
      expect(codeOf("")).toBe("EMPTY_INPUT");
      expect(codeOf("   ")).toBe("EMPTY_INPUT");
    });

    it("rejects an address with no prefix rather than assuming one", () => {
      // Guessing /32 here would answer a question the reader did not ask; the
      // message tells them the `/24` shape instead.
      expect(codeOf("192.168.1.0")).toBe("BAD_PREFIX");
      expect(codeOf("192.168.1.0/")).toBe("BAD_PREFIX");
    });

    it("rejects a prefix outside 0-32", () => {
      expect(codeOf("192.168.1.0/33")).toBe("BAD_PREFIX");
      expect(codeOf("192.168.1.0/-1")).toBe("BAD_PREFIX");
      expect(codeOf("192.168.1.0/24.5")).toBe("BAD_PREFIX");
      expect(codeOf("192.168.1.0/abc")).toBe("BAD_PREFIX");
    });

    it("rejects an octet outside 0-255", () => {
      expect(codeOf("256.1.1.1/24")).toBe("BAD_ADDRESS");
      expect(codeOf("192.168.1.999/24")).toBe("BAD_ADDRESS");
    });

    it("rejects an address that is not four octets", () => {
      expect(codeOf("192.168.1/24")).toBe("BAD_ADDRESS");
      expect(codeOf("192.168.1.1.1/24")).toBe("BAD_ADDRESS");
      expect(codeOf("a.b.c.d/24")).toBe("BAD_ADDRESS");
      expect(codeOf("192.168.1./24")).toBe("BAD_ADDRESS");
      expect(codeOf("::1/24")).toBe("BAD_ADDRESS");
    });

    it("rejects a leading zero rather than guessing at octal", () => {
      // `010` is 8 to a parser that reads octal and 10 to one that does not,
      // and the two answers are a different network. Neither is assumed.
      expect(codeOf("010.0.0.1/8")).toBe("BAD_ADDRESS");
      expect(codeOf("192.168.001.1/24")).toBe("BAD_ADDRESS");
    });

    it("rejects more than one slash", () => {
      expect(codeOf("192.168.1.0/24/24")).toBe("BAD_PREFIX");
    });
  });
});
