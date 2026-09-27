"use client";

import { useEffect, useMemo, useState } from "react";

import type { Hop } from "@/lib/analysis/types";
import { fetchEnrichment } from "@/lib/enrichment/client";
import type { IpEnrichment } from "@/lib/enrichment/types";

/**
 * The looked-up attribution for a trace's hops, once the server has answered.
 *
 * Returns an empty map on the first render and on every render until the
 * request comes back, so the page draws immediately with em dashes and fills
 * them in when there is something to fill. Nothing here blocks a render: the
 * trace is complete without enrichment, and a version of this page that waited
 * for a lookup before showing a measurement would be holding a fact hostage to
 * a guess.
 *
 * ## The request is keyed on the addresses, not on the array
 *
 * `hops` is a fresh array every render, so depending on it would re-fire the
 * effect on every render and loop. What the effect actually cares about is the
 * set of addresses, so that is what it depends on — a string built once per
 * distinct set, which is also a value `useEffect` can compare.
 *
 * `key.split(",")` recovers the addresses from it. That is safe because the
 * join is unambiguous: an IPv4 or IPv6 address never contains a comma, so the
 * split returns exactly what went in.
 *
 * ## Both the answer and the question are remembered
 *
 * The state holds the key it was fetched for, and the hook returns the map only
 * while that key still matches. Without it, a second trace would render its
 * first frame with the first trace's attribution — AS4134 against an address
 * that was never looked up. Checking at read time rather than clearing in the
 * effect also keeps the effect free of a synchronous `setState`, which would
 * trigger a second render pass for a value that was already correct.
 *
 * ## Cancellation
 *
 * A trace that changes while its request is in flight would otherwise have the
 * older answer land second and win. The `active` flag drops it. There is no
 * `AbortController`: the request is a few hundred bytes to the app's own API
 * route, and the flag is enough to keep a stale answer off the screen.
 */
export function useEnrichment(
  hops: readonly Hop[] | undefined,
): Map<string, IpEnrichment> {
  const [answer, setAnswer] = useState<{
    key: string;
    value: Map<string, IpEnrichment>;
  }>({ key: "", value: new Map() });

  const key = useMemo(
    () =>
      (hops ?? [])
        .map((hop) => hop.ip)
        .filter((ip): ip is string => ip !== undefined)
        .join(","),
    [hops],
  );

  useEffect(() => {
    if (key === "") return;

    let active = true;
    void fetchEnrichment(key.split(",")).then((value) => {
      if (active) setAnswer({ key, value });
    });

    return () => {
      active = false;
    };
  }, [key]);

  return answer.key === key ? answer.value : EMPTY;
}

/**
 * One shared instance, so the returned map is referentially stable while a
 * request is in flight — a fresh `new Map()` per call would give every render a
 * new value and defeat any memoisation downstream.
 */
const EMPTY: Map<string, IpEnrichment> = new Map();
