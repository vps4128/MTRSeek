"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { saveTrace } from "@/lib/analysis/storage";
import type { ParseErrorCode } from "@/lib/analysis/types";
import { detectTraceFormat } from "@/lib/mtr/format";
import { EXAMPLE_MTR_OUTPUT } from "@/lib/mock/trace";
import { parseTrace } from "@/lib/parsers";

/**
 * The homepage's primary action band, and the app's real entry point into the
 * analyser.
 *
 * Submit runs the paste through `parseTrace` and only then decides where the
 * reader goes. A paste that parses is stored and handed to `/analysis`; a paste
 * that does not is answered here, under the textarea, with the text still in
 * it — so a failed attempt costs a correction rather than the whole paste, and
 * nobody is sent to an analysis page that has nothing to analyse.
 */
export function MtrInput() {
  const t = useTranslations("analyzer");
  const router = useRouter();
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
    router.push("/analysis");
  }

  return (
    /* `id` is the hero button's scroll target; `scroll-mt-16` clears the 64px
       sticky header so the heading is not left underneath it. */
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
