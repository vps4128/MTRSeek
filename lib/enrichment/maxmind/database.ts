import { open, type Reader, type Response } from "maxmind";

/**
 * Opening an MMDB file, once.
 *
 * A reader holds the whole database in memory and is the expensive part of a
 * lookup: opening one costs a file read of several megabytes, and the lookup
 * itself is then a walk down a tree. So a reader is opened on first use and
 * shared by every request that follows.
 *
 * ## Why the cache is on `globalThis`
 *
 * A module-level `const` would be the obvious place to keep it, and in
 * development it is the wrong one. Next re-evaluates a module when it changes,
 * which would leave the previous reader holding its buffer with nothing
 * pointing at it, and every hot reload would add another. §15 names exactly
 * this failure. `globalThis` survives module re-evaluation, so a reload reuses
 * the reader it already has — the same technique as the Prisma client in a Next
 * app, for the same reason.
 *
 * ## Why a promise is cached rather than a reader
 *
 * Two requests that arrive before the first open finishes would otherwise both
 * open the file. Caching the in-flight promise means the second one waits on
 * the first. A failure is removed from the cache, so a database put in place
 * after the server started is picked up by the next request rather than being
 * remembered as broken forever.
 */

const CACHE_KEY = "__routelensMaxmindReaders";

function readerCache(): Map<string, Promise<unknown>> {
  const holder = globalThis as { [CACHE_KEY]?: Map<string, Promise<unknown>> };
  holder[CACHE_KEY] ??= new Map();
  return holder[CACHE_KEY];
}

/** A reader for the database at `databasePath`, opened at most once. */
export function openDatabase<T extends Response>(
  databasePath: string,
): Promise<Reader<T>> {
  const readers = readerCache();
  const cached = readers.get(databasePath);
  if (cached !== undefined) return cached as Promise<Reader<T>>;

  const pending = open<T>(databasePath).catch((error: unknown) => {
    readers.delete(databasePath);
    throw error;
  });

  readers.set(databasePath, pending);
  return pending;
}
