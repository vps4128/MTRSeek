import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getSubmissionServerSnapshot,
  getSubmissionSnapshot,
  saveSubmission,
  subscribeToSubmission,
  type Submission,
} from "@/lib/analysis/storage";
import type { ParsedTrace } from "@/lib/analysis/types";

/**
 * The read side of the hand-off.
 *
 * `getSubmissionSnapshot` is the only stateful code on the UI path — it
 * memoises so `useSyncExternalStore` does not re-render forever — so the cache
 * is what these tests are really about: it has to return the same object for
 * the same stored text, and it has to notice when the text changes.
 *
 * A submission is a paste and the trace it parsed into. Most of what is here
 * exercises the trace half, because that is the half with a shape to check; the
 * text half is a string, and the test that matters for it is the one saying the
 * two travel together or not at all.
 */

const KEY = "routelens:analysis:v1";

const TRACE: ParsedTrace = {
  source: "mtr",
  target: { host: "example.com" },
  hops: [{ index: 1, ip: "192.168.1.1", loss: 0, avg: 1.1 }],
};

const PASTE: Submission = { text: "mtr -rw example.com\n", trace: TRACE };

const OTHER: Submission = {
  text: "traceroute example.org\n",
  trace: { ...TRACE, hops: [{ index: 1 }, { index: 2 }] },
};

/**
 * A submission only one test writes.
 *
 * The store's cache is module state, so a test that saves a fixture another
 * test has already saved is asking for a silent write — the same text twice is
 * deliberately not a notification. A fixture nobody else touches is one the
 * cache cannot already hold, which is what makes the notification tests below
 * say the same thing whatever order they run in.
 */
const THIRD: Submission = {
  text: "traceroute example.net\n",
  trace: { ...TRACE, hops: [{ index: 1 }, { index: 2 }, { index: 3 }] },
};

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
    expect(getSubmissionSnapshot()).toBeNull();
  });

  it("reads back what `saveSubmission` wrote, text and trace together", () => {
    saveSubmission(PASTE);
    expect(getSubmissionSnapshot()).toEqual(PASTE);
  });

  it("returns the same object for unchanged text", () => {
    // Identity, not equality: `useSyncExternalStore` compares snapshots with
    // `Object.is`, so a fresh parse on every call is an infinite render loop.
    saveSubmission(PASTE);
    expect(getSubmissionSnapshot()).toBe(getSubmissionSnapshot());
  });

  it("notices a second submission", () => {
    saveSubmission(PASTE);
    const first = getSubmissionSnapshot();

    saveSubmission(OTHER);
    const second = getSubmissionSnapshot();

    expect(second).not.toBe(first);
    expect(second).toEqual(OTHER);
  });

  it("does not hand back data it cannot vouch for", () => {
    storage.entries.set(KEY, "not json");
    expect(getSubmissionSnapshot()).toBeNull();

    storage.entries.set(KEY, JSON.stringify({ source: "mtr" }));
    expect(getSubmissionSnapshot()).toBeNull();
  });

  it("rejects half a submission rather than rendering one", () => {
    // Both of these are what a partially-written record would look like. The
    // text without its trace would put a full textarea above an empty results
    // panel — a state the page has no message for — and the trace without its
    // text would empty a box the reader had just filled.
    storage.entries.set(KEY, JSON.stringify({ text: "mtr -rw example.com" }));
    expect(getSubmissionSnapshot()).toBeNull();

    storage.entries.set(KEY, JSON.stringify({ trace: TRACE }));
    expect(getSubmissionSnapshot()).toBeNull();
  });

  it("treats unreachable storage as no submission, never as an error", () => {
    const blocked = fakeStorage({ throws: true });
    Object.defineProperty(globalThis, "window", {
      value: { sessionStorage: blocked },
      configurable: true,
      writable: true,
    });

    expect(() => saveSubmission(PASTE)).not.toThrow();
    expect(getSubmissionSnapshot()).toBeNull();
  });

  it("renders nothing on the server, which is what makes hydration agree", () => {
    saveSubmission(PASTE);
    expect(getSubmissionServerSnapshot()).toBeUndefined();
  });

  it("stops telling a subscriber once it has unsubscribed", () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToSubmission(() => seen.push(1));

    saveSubmission(THIRD);
    expect(seen).toHaveLength(1);

    unsubscribe();
    saveSubmission(PASTE);
    expect(seen).toHaveLength(1);
  });

  it("says nothing when the same submission is saved twice", () => {
    // The paste band stores on every successful submit, and a second submit of
    // the same text has to cost nothing: the notification is what redraws the
    // page, and redrawing it to the same pixels is the one thing the memoised
    // snapshot exists to avoid.
    saveSubmission(PASTE);

    const seen: number[] = [];
    const unsubscribe = subscribeToSubmission(() => seen.push(1));

    saveSubmission(PASTE);
    expect(seen).toHaveLength(0);

    saveSubmission(OTHER);
    expect(seen).toHaveLength(1);

    unsubscribe();
  });
});
