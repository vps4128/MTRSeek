"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import {
  getLastLookupServerSnapshot,
  getLastLookupSnapshot,
  subscribeToLastLookup,
} from "@/lib/enrichment/storage";
import type { IpEnrichment } from "@/lib/enrichment/types";

/**
 * The address field, which remembers what was last asked of it.
 *
 * ## The problem it solves
 *
 * The question this page answers lives in the URL, and the answer is stored in
 * `sessionStorage` — see `LookupResult`, which reads it. So a reader who looks
 * up `1.1.1.1`, steps over to the analysis page and comes back to a bare
 * `/zh/ip` finds the answer still on the card and an empty box above it. The
 * card says what was asked; the form, which is where the asking happens, says
 * nothing, and the reader has to retype an address the page already knows.
 *
 * ## Why it is separate from the page
 *
 * The page is a server component, and the whole point of it is that it stays
 * one: the form is a plain GET, the lookup runs before the HTML is sent, and
 * submitting needs no JavaScript. Only the field has to run in the browser, so
 * only the field is a client component — the form around it, the heading, the
 * card beside it and the submit all stay on the server. With scripting off
 * nothing here runs and the page is exactly what it was before.
 *
 * ## Why it writes to the DOM instead of holding state
 *
 * The field is uncontrolled: `defaultValue` is the address in the URL, and the
 * browser owns the value from then on. Making it controlled to hold the
 * remembered address would mean the server rendering `value=""` and the client
 * immediately rendering something else, which React answers by throwing the
 * server's markup away and re-rendering — a hydration mismatch caused by the
 * one feature that exists to avoid a flash of the wrong content.
 *
 * So the remembered address is written into the element after hydration
 * instead, and only when the box is still empty: `undefined` from the store is
 * "storage has not been read yet", and after the read the write happens once.
 * `input.value !== ""` is the guard that makes the URL win — a reader on
 * `/zh/ip?q=8.8.8.8` already has that address in the box, and so does one who
 * typed a new address in the moment before hydration finished.
 *
 * ## What it will not fill in
 *
 * Only an address that was looked up successfully. A failed lookup stores
 * nothing (see the storage module for why), so coming back from one leaves the
 * box empty — which is the honest state: the address on the card beside it is
 * the last one that had an answer, and a box asking about `192.168.1.1` next to
 * a card answering for `8.8.8.8` would read as a page that had lost track.
 */
export function QueryField({ query }: { query: string }) {
  const t = useTranslations("ip");

  const remembered = useSyncExternalStore<IpEnrichment | null | undefined>(
    subscribeToLastLookup,
    getLastLookupSnapshot,
    getLastLookupServerSnapshot,
  );

  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    if (input === null || input.value !== "") return;

    const lastAsked = remembered?.ip;
    if (lastAsked !== undefined) input.value = lastAsked;
  }, [remembered]);

  return (
    <Input
      ref={ref}
      id="ip-query"
      name="q"
      defaultValue={query}
      placeholder={t("placeholder")}
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      /* An arbitrary width rather than `max-w-md`: this project's `@theme`
         redefines the `--spacing-*` scale, so the named `max-w-*` sizes resolve
         against it and `max-w-md` is 16px, not Tailwind's 28rem. Wide enough for
         the longest IPv6 address and its placeholder, and capped so that a
         field whose content is an address does not run the full width of its
         column. Below `sm` it takes the column's own width, which on a phone is
         narrower than the cap anyway. */
      className="mt-xs sm:max-w-[24rem]"
    />
  );
}
