"use client";

import { Network } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

import { SubnetResult, SUBNET_PROBLEM_ID } from "@/components/subnet/subnet-result";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { parseCidr } from "@/lib/subnet/cidr";
import {
  getInputServerSnapshot,
  getInputSnapshot,
  saveInput,
  subscribeToInput,
} from "@/lib/subnet/storage";

/**
 * The subnet calculator: a field, and the answer beside it.
 *
 * ## Why there is no button
 *
 * Both other tools have one, and neither is a precedent for this one. The
 * analysis page's button parses a paste and the IP page's submits a form that
 * navigates, so in both cases there is work between the input and the answer.
 * Here the answer is a pure function of the string — the arithmetic in
 * `lib/subnet/cidr.ts` is a handful of bitwise operations — so a button would
 * be a step with nothing in it, and pressing it could not change what the card
 * already shows. The card follows the field as it is typed.
 *
 * What that costs is the moment a reader gets to declare themselves finished,
 * which is why the card does not accuse them of anything while they are still
 * typing: a half-written `192.168.1.0` draws the idle prompt, not an error.
 * Only a string that is meant to be a CIDR and is not gets a message.
 *
 * ## Why it is a client component
 *
 * The calculation runs in the browser, which is what the tool was specified to
 * do and is the only place it can run without a round trip. It is also where
 * the remembered input has to be read from — `sessionStorage` does not exist on
 * the server — and the pattern is the one the analysis page uses: the server
 * renders the empty prompt, because that is the only thing it can honestly
 * render, and the remembered value follows on the client. The page therefore
 * shows the idle card for one frame on a return visit, which is the same trade
 * `AnalysisView` and `LookupResult` both make and for the same reason.
 *
 * ## Why the draft is a separate piece of state
 *
 * `draft ?? remembered ?? ""`, exactly as the analysis page's textarea resolves
 * its own value, and for the same reason: the stored string seeds the field and
 * then gets out of the way. Without the draft, typing the first character would
 * leave the field fighting the store — a controlled input whose value comes
 * from storage has to write to storage on every keystroke to accept one.
 *
 * The three states of the store survive that `??` chain, which is what makes it
 * correct rather than lucky: `undefined` is "not read yet" and `null` is "read,
 * nothing there", and an empty field is the right render for both.
 */
export function SubnetCalculator() {
  const t = useTranslations("subnet");

  const remembered = useSyncExternalStore(
    subscribeToInput,
    getInputSnapshot,
    getInputServerSnapshot,
  );

  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? remembered ?? "";

  // The empty string is answered with its own code rather than being tested for
  // here, so the field and the card cannot disagree about what counts as empty.
  const result = parseCidr(value);
  const parsed = result.ok;
  const problem = !result.ok && result.code !== "EMPTY_INPUT";

  // Only a string that parsed is remembered; see the storage module for why.
  useEffect(() => {
    if (parsed) saveInput(value);
  }, [parsed, value]);

  return (
    /* The question on the left, the answer on the right, started rather than
       centred — the arrangement the IP page uses and argues for. This card is a
       different height at every prefix, and centring each of those against a
       column whose height never changes would move the card's top edge as the
       reader types. */
    <div className="grid grid-cols-1 items-start gap-xxl lg:grid-cols-2">
      <div>
        <h1 className="type-display-hero text-ink sm:type-display-md xl:type-display-lg">
          {t("title")}
        </h1>
        <p className="mt-lg measure-body-tight type-body-md text-body">
          {t("description")}
        </p>

        <div className="mt-xl">
          {/* The icon goes on the label rather than inside the field.
              `text-input` is a fixed 40px box with 10×14 padding in DESIGN.md,
              and a glyph placed within it would mean this page reaching into a
              component whose geometry it does not own. The nav entry for this
              tool carries the same glyph, which is what the IP page does too. */}
          <label
            htmlFor="subnet-input"
            className="flex items-center gap-1.5 type-body-sm font-medium text-ink"
          >
            <Icon of={Network} />
            {t("label")}
          </label>

          {/* An arbitrary width rather than `max-w-md`: this project's `@theme`
              redefines the `--spacing-*` scale, so the named `max-w-*` sizes
              resolve against it and `max-w-md` is 16px, not Tailwind's 28rem.
              No maximum at all below `sm`, where the field simply fills the
              column. */}
          <Input
            id="subnet-input"
            name="cidr"
            value={value}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("placeholder")}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={problem}
            /* Pointed at the message the card draws, which is in the other
               column: `aria-describedby` names an element, not a neighbour, so
               the field is still described by its own error. */
            aria-describedby={problem ? SUBNET_PROBLEM_ID : undefined}
            className="mt-xs sm:max-w-[24rem]"
          />
        </div>
      </div>

      <SubnetResult query={value} result={result} />
    </div>
  );
}
