import { useTranslations } from "next-intl";

/**
 * Map — a placeholder, and only a placeholder.
 *
 * There are coordinates now — the GeoIP lookup returns a latitude, a longitude
 * and an accuracy radius for every hop it can place — and there is still no map,
 * which is the deliberate part. §19 keeps this phase from adding a mapping SDK,
 * so the panel names what it is waiting for instead of drawing something.
 *
 * A world map with a route sketched across it would be the wrong thing to draw
 * even with a library to hand. The points are approximate and the radius that
 * says how approximate is a number nothing on a map can show; a line joining
 * two of them would read as a path a packet took, which is a claim the data
 * does not make.
 *
 * The panel is drawn rather than left blank so the page reads as finished
 * rather than broken.
 */
export function MapPlaceholder() {
  const t = useTranslations("analysis.map");

  return (
    <section aria-labelledby="map-heading">
      <h2 id="map-heading" className="type-title-sm text-ink">
        {t("title")}
      </h2>

      <div className="mt-lg rounded-lg border border-hairline p-xl">
        <p className="type-body-sm text-muted-foreground">{t("empty")}</p>
      </div>
    </section>
  );
}
