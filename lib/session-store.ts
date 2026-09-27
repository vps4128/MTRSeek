/**
 * A JSON value kept in `sessionStorage`, readable from a component.
 *
 * ## Why a component cannot just call `sessionStorage.getItem`
 *
 * `sessionStorage` does not exist on the server, so reading it during a render
 * would put a value in the client's first pass and nothing in the server's, and
 * React answers that with a hydration mismatch. `useSyncExternalStore` is the
 * way out, and it asks for four things: a subscribe, a snapshot, a server
 * snapshot, and something to write with. This is those four, once, for every
 * value the app keeps in a tab.
 *
 * ## The three states, and why they are not two
 *
 * `undefined` is "not read yet" — what the server renders and what the client's
 * hydration pass agrees with, before the real read happens. `null` is "read,
 * and there was nothing there": a fresh tab, a cleared store, a storage that
 * refused the write. Anything else is the value. Collapsing the first two would
 * mean the server had to guess which one to render, and a page that renders
 * "there is nothing" for its first frame is a page that lies about a value it
 * has not looked at yet.
 *
 * ## Every access is wrapped
 *
 * `sessionStorage` is not guaranteed to exist: it throws outright in some
 * privacy modes, and `window` is absent during prerendering. A failure here is
 * a missing value, never a broken page — so a blocked read is `null` (which the
 * caller already handles) and a blocked write is a no-op that leaves the
 * previous value where it was.
 *
 * ## The snapshot is memoised on the raw string
 *
 * `useSyncExternalStore` compares snapshots with `Object.is`, so returning a
 * freshly parsed object on every call is an infinite render loop. The cache is
 * keyed on the raw text rather than on a version counter, which means it cannot
 * go stale: any write changes the string, and a changed string is a miss. That
 * also makes a write from anywhere — including another module, or the same one
 * twice — visible without anybody having to remember to invalidate anything.
 *
 * ## `save` notifies
 *
 * A write from this tab is the one case a `storage` event will not report, and
 * it is the case that matters: the page that writes a value is usually the page
 * that has to redraw around it. Subscribers are told, and a write that produces
 * the same text as last time tells nobody, because a render pass that draws the
 * same pixels is a render pass wasted.
 */

/** The four functions a `useSyncExternalStore` consumer needs, plus the writer. */
export type SessionStore<T> = {
  /** Replaces the stored value. Silent when storage refuses the write. */
  save(value: T): void;

  /** For `useSyncExternalStore`. Returns its own unsubscribe. */
  subscribe(listener: () => void): () => void;

  /** The stored value, or `null` when there is none or it cannot be vouched for. */
  getSnapshot(): T | null;

  /** What the server renders, and what the client's first pass agrees with. */
  getServerSnapshot(): undefined;
};

export function createSessionStore<T>({
  key,
  isValid,
}: {
  key: string;
  isValid: (value: unknown) => value is T;
}): SessionStore<T> {
  const listeners = new Set<() => void>();

  let cachedRaw: string | null = null;
  let cachedValue: T | null = null;
  let cached = false;

  function readRaw(): string | null {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * Checks the shape before trusting it.
   *
   * What comes back was written by an earlier version of this app — or by
   * something else entirely, since the key is guessable. A malformed value has
   * to read as "nothing stored", not as a page that renders `undefined` down
   * its length.
   */
  function toValue(raw: string | null): T | null {
    if (raw === null) return null;

    try {
      const parsed: unknown = JSON.parse(raw);
      return isValid(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return {
    save(value) {
      let raw: string;
      try {
        raw = JSON.stringify(value);
        window.sessionStorage.setItem(key, raw);
      } catch {
        return;
      }

      if (cached && raw === cachedRaw) return;

      cachedRaw = raw;
      cachedValue = value;
      cached = true;

      for (const listener of listeners) listener();
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      const raw = readRaw();

      if (!cached || raw !== cachedRaw) {
        cachedRaw = raw;
        cachedValue = toValue(raw);
        cached = true;
      }

      return cachedValue;
    },

    getServerSnapshot() {
      return undefined;
    },
  };
}
