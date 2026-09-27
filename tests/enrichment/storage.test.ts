import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getLastLookupServerSnapshot,
  getLastLookupSnapshot,
  saveLastLookup,
  subscribeToLastLookup,
} from "@/lib/enrichment/storage";
import type { IpEnrichment } from "@/lib/enrichment/types";

/**
 * The lookup page's memory of the last answer it gave.
 *
 * The read side is the only stateful code on that page's path — it memoises so
 * `useSyncExternalStore` does not re-render forever — so the cache is what
 * these tests are really about, along with the shape check that decides whether
 * a stored string is an answer at all.
 */

const KEY = "routelens:ip:v1";

const ANSWER: IpEnrichment = {
  ip: "1.1.1.1",
  asn: { number: 13335, organization: "Cloudflare, Inc." },
  geo: { countryCode: "AU", city: { en: "Sydney" } },
};

const OTHER: IpEnrichment = { ip: "8.8.8.8" };

/**
 * An answer only one test saves.
 *
 * The store's cache is module state, so a test that saves a fixture another
 * test has already saved is asking for a silent write — the same text twice is
 * deliberately not a notification. A fixture nobody else touches is one the
 * cache cannot already hold, which is what makes the notification test below
 * say the same thing whatever order it runs in.
 */
const THIRD: IpEnrichment = { ip: "9.9.9.9" };

/** A `sessionStorage` that can also be made to throw, as real ones do. */
function fakeStorage(options: { throws?: boolean } = {}) {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key: string) => {
      if (options.throws === true) throw new Error("blocked");
      return entries.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (options.throws === true) throw new Error("blocked");
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
}

let storage: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  storage = fakeStorage();
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: storage },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("the lookup page's memory", () => {
  it("remembers nothing before anything is looked up", () => {
    expect(getLastLookupSnapshot()).toBeNull();
  });

  it("reads back what a successful lookup saved", () => {
    saveLastLookup(ANSWER);
    expect(getLastLookupSnapshot()).toEqual(ANSWER);
  });

  it("returns the same object for unchanged text", () => {
    // Identity, not equality: `useSyncExternalStore` compares snapshots with
    // `Object.is`, so a fresh parse on every call is an infinite render loop.
    saveLastLookup(ANSWER);
    expect(getLastLookupSnapshot()).toBe(getLastLookupSnapshot());
  });

  it("replaces the last answer rather than accumulating answers", () => {
    saveLastLookup(ANSWER);
    const first = getLastLookupSnapshot();

    saveLastLookup(OTHER);
    const second = getLastLookupSnapshot();

    expect(second).not.toBe(first);
    expect(second).toEqual(OTHER);
  });

  it("tells a subscriber when an answer is saved, and stops when it unsubscribes", () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToLastLookup(() => seen.push(1));

    saveLastLookup(THIRD);
    expect(seen).toHaveLength(1);

    unsubscribe();
    saveLastLookup(ANSWER);
    expect(seen).toHaveLength(1);
  });

  it("does not hand back data it cannot vouch for", () => {
    // `ip` is the one field the card reads unconditionally, so it is the one
    // the shape check insists on.
    storage.entries.set(KEY, "not json");
    expect(getLastLookupSnapshot()).toBeNull();

    storage.entries.set(KEY, JSON.stringify({ asn: { number: 13335 } }));
    expect(getLastLookupSnapshot()).toBeNull();

    storage.entries.set(KEY, JSON.stringify(ANSWER));
    expect(getLastLookupSnapshot()).toEqual(ANSWER);
  });

  it("treats unreachable storage as nothing remembered, never as an error", () => {
    const blocked = fakeStorage({ throws: true });
    Object.defineProperty(globalThis, "window", {
      value: { sessionStorage: blocked },
      configurable: true,
      writable: true,
    });

    expect(() => saveLastLookup(ANSWER)).not.toThrow();
    expect(getLastLookupSnapshot()).toBeNull();
  });

  it("renders nothing on the server, which is what makes hydration agree", () => {
    saveLastLookup(ANSWER);
    expect(getLastLookupServerSnapshot()).toBeUndefined();
  });
});
