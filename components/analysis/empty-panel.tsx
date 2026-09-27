import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * `/analysis` with nothing to analyse.
 *
 * A first visit, a refresh after the tab was closed, a `sessionStorage` that
 * refused to store — all land here, and all get the same answer: say there is
 * nothing, and point at the way to make something. It is deliberately not a
 * demo trace or a sample report. A fabricated result on this page would be
 * indistinguishable from a real one, which would make every real one worthless.
 *
 * The button goes to the paste band above, which is the thing the reader has to
 * use. A plain fragment rather than a `Link`: the band is on this page, so
 * there is no route to change and nothing to re-render — and a router
 * navigation to an anchor on the page you are already reading would reload the
 * trace out from under the panel. The band carries `scroll-mt-16`, so the
 * sticky header does not cover its heading when the jump lands.
 */
export function EmptyPanel() {
  const t = useTranslations("analysis.empty");

  return (
    <div className="rounded-lg border border-hairline p-xl">
      <h1 className="type-title-lg text-ink">{t("title")}</h1>
      <p className="mt-sm measure-body type-body-sm text-body">
        {t("description")}
      </p>

      <div className="mt-lg">
        <Button asChild variant="secondary">
          <a href="#mtr-input">{t("back")}</a>
        </Button>
      </div>
    </div>
  );
}
