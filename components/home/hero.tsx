import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/container";
import { MtrPreview } from "@/components/mtr/mtr-preview";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";

/**
 * DESIGN.md → Components · `hero-band`: canvas, 96px vertical padding, and a
 * 6/6 split at desktop — display headline, sub-headline and CTA on the left,
 * the product artifact on the right. Collapses to a single column on mobile,
 * headline and CTA first.
 */
export async function Hero() {
  const t = await getTranslations("home");

  return (
    <section className="bg-canvas py-section">
      <Container>
        {/* Explicit `grid-cols-1` matters: without it the implicit column is
            min-content sized, so the trace card's intrinsic width drags the
            whole grid — headline included — past the mobile viewport. */}
        <div className="grid grid-cols-1 items-center gap-xxl lg:grid-cols-2">
          <div>
            <p className="type-caption-uppercase text-muted-foreground">
              {t("eyebrow")}
            </p>

            {/* The line break lives in the message, not in the markup: where a
                headline breaks is a property of the language, and a hard <br/>
                tuned for one locale would cut the other in the wrong place.
                `whitespace-pre-line` renders the newline the English string
                carries and leaves the single-line Chinese string alone.

                DESIGN.md assigns `display-xl` (64px) to the homepage h1, but at
                64px the English first line measures ~685px and a 6/6 column in
                a 1200px container is at most 576px. The headline therefore uses
                the largest step that holds at every width: 48px from 1280px up,
                36px below that. See the note in the README. */}
            <h1 className="mt-md whitespace-pre-line type-display-hero text-ink sm:type-display-md xl:type-display-lg">
              {t("title")}
            </h1>

            <p className="mt-lg measure-body-tight type-body-md text-body">
              {t("description")}
            </p>

            {/* The hero's job is to hand the reader to the input, not to run
                anything. The input is the first thing on the analysis page, so
                this is a link to that page rather than the in-page anchor it
                used to be — nothing is submitted here, and the analysis page's
                own button is still the one that starts an analysis. `Link`
                rather than `next/link`, so the locale prefix comes along. */}
            <div className="mt-xl">
              <Button asChild>
                <Link href="/analysis">
                  {t("analyze")}
                  {/* The one arrow on the site, and only here: this button is
                      the only control that leaves the page it is on. The
                      analysis page's own button runs something and stays put,
                      which is why it carries a play mark and not this one. */}
                  <Icon of={ArrowRight} />
                </Link>
              </Button>
            </div>
          </div>

          <MtrPreview />
        </div>
      </Container>
    </section>
  );
}
