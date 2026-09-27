import { createSessionStore } from "@/lib/session-store";

/**
 * The last subnet this tab asked about.
 *
 * ## Why only the input is kept
 *
 * The analysis page keeps the pasted text *and* the trace it parsed into,
 * because parsing a trace is work and the two have to agree about which paste
 * they came from. Here the whole answer is a pure function of the string —
 * `parseCidr` is a handful of bitwise operations — so storing the answer as
 * well would store a second copy of something that can be recomputed for
 * nothing, and a copy can go stale in a way a recomputation cannot. The field's
 * contents are the state; the card is a rendering of them.
 *
 * ## What is remembered
 *
 * Only a string that parsed. A half-typed `192.168.1.0/2` is a valid `/2` and
 * so is remembered on the way to `/24`; a `192.168.1.0` with no prefix is not,
 * so leaving the page mid-word and coming back restores the last subnetwork
 * that was actually a subnetwork rather than a fragment. That is the same call
 * `lib/enrichment/storage.ts` makes for the IP page, and for the same reason:
 * a field restored from something that never resolved would put a question on
 * the page that has no answer beside it.
 *
 * ## Why it is a `sessionStore` and not component state
 *
 * Because the point of it is the visit *after* this one. The reader steps over
 * to the analysis page and back, and the calculator is where they left it.
 */
const store = createSessionStore<string>({
  key: "routelens:subnet:v1",
  isValid: (value): value is string => typeof value === "string",
});

export function saveInput(input: string): void {
  store.save(input);
}

export function subscribeToInput(listener: () => void): () => void {
  return store.subscribe(listener);
}

export function getInputSnapshot(): string | null {
  return store.getSnapshot();
}

export function getInputServerSnapshot(): undefined {
  return store.getServerSnapshot();
}
