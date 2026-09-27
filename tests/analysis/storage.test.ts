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

  it("subscribes without needing to be unsubscribed", () => {
    const unsubscribe = subscribeToTrace();
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});
