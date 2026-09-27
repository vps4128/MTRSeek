"use client";

import { ClipboardPaste, Play } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import {
  getSubmissionServerSnapshot,
  getSubmissionSnapshot,
  saveSubmission,
  subscribeToSubmission,
  type Submission,
} from "@/lib/analysis/storage";
import type { ParseErrorCode } from "@/lib/analysis/types";
import { detectTraceFormat } from "@/lib/mtr/format";
import { EXAMPLE_MTR_OUTPUT } from "@/lib/mock/trace";
import { parseTrace } from "@/lib/parsers";

/**
 * The band a trace is pasted into, and the app's only way in.
 *
 * ## Why it is on the analysis page rather than the homepage
 *
 * It used to be the homepage's second band, with the hero's button scrolling
 * down to it and the analysis page a separate destination that showed whatever
 * had been pasted last. That put the two halves of one interaction on two
 * pages: you pasted here and read there, and the only way to paste again was to
 * go back. Both are now here — the band, and the results directly below it — so
 * the homepage hands the reader over with a link and this page is the whole
 * tool.
 *
 * ## Submitting does not navigate
 *
 * It parses, stores, and stops. The storage layer tells the analysis view below
 * that there is a new trace, and the view redraws around it; the URL does not
 * change and nothing remounts. A paste that does not parse never reaches
 * storage at all — the error is answered here, under the textarea, with the
 * text still in it, so a failed attempt costs a correction rather than the
 * whole paste.
 *
 * ## Why it scrolls
 *
 * The band is roughly 550px of padding, heading and textarea, and the results
 * are below it — on a laptop, below the fold. A successful submit that left the
 * reader staring at the box they just submitted would look like nothing
 * happened. `scrollIntoView` moves them to the first line of the answer, and
 * the motion is whatever `scroll-behavior` the layout already sets, which is
 * `auto` for readers who have asked for reduced motion. `scroll-mt-16` on the
 * target keeps the sticky header off the top of it.
 *
 * ## Why the box refills itself
 *
 * Stepping over to the lookup page and back used to cost the reader their
 * paste: the results returned, because they were stored, and the text that
 * produced them did not. The two are now stored together, so both come back and
 * the reader can trim a line and submit again without pasting again.
 *
 * The value shown is `draft ?? remembered ?? ""`, and the three states are the
 * reason for that order. `draft` is `null` until the reader types, which is
 * what lets the remembered paste show through on arrival; the moment they type
 * it wins, and it keeps winning — including when what they typed is the empty
 * string. Clearing the box has to stay cleared, which is why the fallback is
 * written with `??` and not `||`.
 *
 * Reading the store through `useSyncExternalStore` rather than seeding state in
 * an effect is what keeps hydration honest. The server renders the third state
 * — nothing remembered — because that is the only one it can know, and the
 * client's first pass is handed the same answer; the remembered paste arrives
 * on the render after that. A `useState` initialiser reading storage directly
 * would disagree with the server for one frame instead, and React would throw
 * the server's markup away and re-render the whole page.
 */
export function MtrInput() {
  const t = useTranslations("analyzer");
  const [error, setError] = useState<ParseErrorCode | null>(null);

  const submission = useSyncExternalStore<Submission | null | undefined>(
    subscribeToSubmission,
    getSubmissionSnapshot,
    getSubmissionServerSnapshot,
  );

  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? submission?.text ?? "";

  const format = detectTraceFormat(value);

  function handleAnalyze() {
    const result = parseTrace(value);

    if (!result.ok) {
      setError(result.error.code);
      return;
    }

    setError(null);
    saveSubmission({ text: value, trace: result.trace });
    document.getElementById("mtr-result")?.scrollIntoView();
  }

  return (
    /* `id` is the empty panel's target, and the target of its own error and
       reset flows; `scroll-mt-16` clears the 64px sticky header so the heading
       is not left underneath it. */
    <section id="mtr-input" className="scroll-mt-16 bg-surface-soft py-section">
      <Container>
        <h2 className="type-display-sm text-ink sm:type-display-md">
          {t("title")}
        </h2>
        <p className="mt-md measure-body type-body-md text-body">
          {t("description")}
        </p>

        <Textarea
          value={value}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          aria-label={t("inputLabel")}
          aria-invalid={error !== null}
          aria-describedby={error === null ? undefined : "mtr-input-error"}
          spellCheck={false}
          placeholder={t("placeholder")}
          className="mt-xl h-[240px] field-sizing-fixed resize-y type-code p-lg"
        />

        {error === null ? null : (
          <p
            id="mtr-input-error"
            role="alert"
            className="mt-sm type-body-sm text-error"
          >
            {t(`errors.${error}`)}
          </p>
        )}

        <div className="mt-lg flex flex-wrap items-center justify-between gap-md">
          <div className="flex flex-wrap items-center gap-md">
            {/* A play mark, not the arrow the hero's button carries: this one
                runs the parse and the page stays where it is. */}
            <Button onClick={handleAnalyze} disabled={value.trim().length === 0}>
              <Icon of={Play} />
              {t("analyze")}
            </Button>
            {format ? (
              <span className="rounded-pill bg-surface-card px-sm py-xxs type-caption text-ink">
                {t("detectedFormat", { format })}
              </span>
            ) : null}
          </div>

          <Button variant="secondary" onClick={() => setDraft(EXAMPLE_MTR_OUTPUT)}>
            <Icon of={ClipboardPaste} />
            {t("loadExample")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
