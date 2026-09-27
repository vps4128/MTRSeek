"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveTrace } from "@/lib/analysis/storage";
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
 */
export function MtrInput() {
  const t = useTranslations("analyzer");
  const [value, setValue] = useState("");
  const [error, setError] = useState<ParseErrorCode | null>(null);
  const format = detectTraceFormat(value);

  function handleAnalyze() {
    const result = parseTrace(value);

    if (!result.ok) {
      setError(result.error.code);
      return;
    }

    setError(null);
    saveTrace(result.trace);
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
            setValue(event.target.value);
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
            <Button onClick={handleAnalyze} disabled={value.trim().length === 0}>
              {t("analyze")}
            </Button>
            {format ? (
              <span className="rounded-pill bg-surface-card px-sm py-xxs type-caption text-ink">
                {t("detectedFormat", { format })}
              </span>
            ) : null}
          </div>

          <Button variant="secondary" onClick={() => setValue(EXAMPLE_MTR_OUTPUT)}>
            {t("loadExample")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
