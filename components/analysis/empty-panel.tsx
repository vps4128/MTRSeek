import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * `/analysis` with nothing to analyse.
 *
 * A refresh after the tab was closed, a link followed from elsewhere, a
 * `sessionStorage` that refused to store — all land here, and all get the same
 * answer: say there is nothing, and point at the way to make something. It is
 * deliberately not a demo trace or a sample report. A fabricated result on this
 * page would be indistinguishable from a real one, which would make every real
 * one worthless.
 *
 * The link goes back to the homepage's input rather than the top of the page,
 * so it lands on the thing the reader has to use.
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
          <Link href="/#mtr-input">{t("back")}</Link>
        </Button>
      </div>
    </div>
  );
}
