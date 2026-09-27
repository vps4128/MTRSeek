import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getTraceServerSnapshot,
  getTraceSnapshot,
  saveTrace,
  subscribeToTrace,
} from "@/lib/analysis/storage";
import type { ParsedTrace } from "@/lib/analysis/types";

/**
 * The read side of the hand-off.
 *
 * `getTraceSnapshot` is the only stateful code on the UI path — it memoises so
 * `useSyncExternalStore` does not re-render forever — so the cache is what
 * these tests are really about: it has to return the same object for the same
 * stored text, and it has to notice when the text changes.
 */

const KEY = "routelens:analysis:v1";

const TRACE: ParsedTrace = {
  source: "mtr",
  target: { host: "example.com" },
  hops: [{ index: 1, ip: "192.168.1.1", loss: 0, avg: 1.1 }],
};

const OTHER: ParsedTrace = { ...TRACE, hops: [{ index: 1 }, { index: 2 }] };

/**
 * A trace only one test writes.
 *
 * The store's cache is module state, so a test that saves a fixture another
 * test has already saved is asking for a silent write — the same text twice is
 * deliberately not a notification. A fixture nobody else touches is one the
 * cache cannot already hold, which is what makes the notification tests below
 * say the same thing whatever order they run in.
 */
const THIRD: ParsedTrace = { ...TRACE, hops: [{ index: 1 }, { index: 2 }, { index: 3 }] };

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

describe("the analysis hand-off", () => {
  it("finds nothing before anything is submitted", () => {
    expect(getTraceSnapshot()).toBeNull();
  });

  it("reads back what `saveTrace` wrote", () => {
    saveTrace(TRACE);
    expect(getTraceSnapshot()).toEqual(TRACE);
  });

  it("returns the same object for unchanged text", () => {
    // Identity, not equality: `useSyncExternalStore` compares snapshots with
    // `Object.is`, so a fresh parse on every call is an infinite render loop.
    saveTrace(TRACE);
    expect(getTraceSnapshot()).toBe(getTraceSnapshot());
  });

  it("notices a second submission", () => {
    saveTrace(TRACE);
    const first = getTraceSnapshot();

    saveTrace(OTHER);
    const second = getTraceSnapshot();

    expect(second).not.toBe(first);
    expect(second).toEqual(OTHER);
  });

  it("does not hand back data it cannot vouch for", () => {
    storage.entries.set(KEY, "not json");
    expect(getTraceSnapshot()).toBeNull();

    storage.entries.set(KEY, JSON.stringify({ source: "mtr" }));
    expect(getTraceSnapshot()).toBeNull();
  });

  it("treats unreachable storage as no trace, never as an error", () => {
    const blocked = fakeStorage({ throws: true });
    Object.defineProperty(globalThis, "window", {
      value: { sessionStorage: blocked },
      configurable: true,
      writable: true,
    });

    expect(() => saveTrace(TRACE)).not.toThrow();
    expect(getTraceSnapshot()).toBeNull();
  });

  it("renders nothing on the server, which is what makes hydration agree", () => {
    saveTrace(TRACE);
    expect(getTraceServerSnapshot()).toBeUndefined();
  });

  it("stops telling a subscriber once it has unsubscribed", () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToTrace(() => seen.push(1));

    saveTrace(THIRD);
    expect(seen).toHaveLength(1);

    unsubscribe();
    saveTrace(TRACE);
    expect(seen).toHaveLength(1);
  });

  it("says nothing when the same trace is saved twice", () => {
    // The paste band stores on every successful submit, and a second submit of
    // the same text has to cost nothing: the notification is what redraws the
    // page, and redrawing it to the same pixels is the one thing the memoised
    // snapshot exists to avoid.
    saveTrace(TRACE);

    const seen: number[] = [];
    const unsubscribe = subscribeToTrace(() => seen.push(1));

    saveTrace(TRACE);
    expect(seen).toHaveLength(0);

    saveTrace(OTHER);
    expect(seen).toHaveLength(1);

    unsubscribe();
  });
});
