import { useTranslations } from "next-intl";

/**
 * AS Path — a compact line, not a panel.
 *
 * An AS path is one short piece of information: the sequence of autonomous
 * systems a packet crosses. Given a card of its own it would take up more of
 * the page than the whole hop table it summarises, so it gets a heading and a
 * sentence, and no box.
 *
 * What it holds is an AS *path* — the route's own sequence of autonomous
 * systems as BGP announces it — and that is not what Phase 3 added. GeoLite2
 * answers "which AS is this address announced from", one address at a time,
 * which is what the hop table now shows; it says nothing about the path between
 * them, and a sequence assembled from the hops is not the same object. §30
 * draws the boundary at BGP APIs, route detection and prefix data, none of
 * which this phase touches.
 *
 * So the section says what it is waiting for rather than showing a row of
 * plausible AS numbers. `AS4134 → AS4809 → AS23764` is exactly what a real
 * trace to China would show, which is what makes inventing it the single most
 * convincing piece of fiction this app could produce.
 */
export function AsPath() {
  const t = useTranslations("analysis.asPath");

  return (
    <section aria-labelledby="as-path-heading">
      <h2 id="as-path-heading" className="type-title-sm text-ink">
        {t("title")}
      </h2>

      <p className="mt-sm measure-body type-body-sm text-muted-foreground">
        {t("empty")}
      </p>
    </section>
  );
}
