import { Waypoints } from "lucide-react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui/icon";
import { buildAsPath, type AsPathSegment } from "@/lib/analysis/as-path";
import type { Hop } from "@/lib/analysis/types";

/**
 * AS Path — a compact line, not a panel.
 *
 * The sequence of autonomous systems the trace crossed, which is one short
 * piece of information: given a card of its own it would take up more of the
 * page than the whole hop table it summarises, so it gets a heading, the
 * sentence that says where the numbers came from, and no box.
 *
 * It follows the hop table rather than preceding it, which is the order its own
 * subject implies: the table is the trace, and this line is one reading of it.
 * The numbers are folded from the hops by `buildAsPath` and nothing else — the
 * same enriched hops the table above renders, so a row and a segment can never
 * disagree. What that produces is an observation of this trace rather than a
 * BGP AS path, which is what the sentence above the line is there to say: the
 * section shows what the trace reached, not what the routing table announces,
 * and the two are different objects.
 *
 * A segment is drawn as the number over the operator over the hop range it
 * covers, joined by arrows. Where two segments are not adjacent in the hop
 * numbering the separator is a dash instead, so a hop that resolved to nothing
 * is visible in the line rather than being papered over by the join — the one
 * thing the reader must not be allowed to infer is a continuity the trace did
 * not show.
 */
export function AsPath({ hops }: { hops: Hop[] }) {
  const t = useTranslations("analysis.asPath");
  const segments = buildAsPath(hops);

  return (
    <section aria-labelledby="as-path-heading">
      <h2
        id="as-path-heading"
        className="flex items-center gap-1.5 type-title-sm text-ink"
      >
        <Icon of={Waypoints} />
        {t("title")}
      </h2>

      {segments.length === 0 ? (
        <p className="mt-sm measure-body type-body-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <>
          <p className="mt-sm measure-body type-body-sm text-muted-foreground">
            {t("description")}
          </p>

          <ol className="mt-lg flex flex-wrap items-start gap-x-md gap-y-lg">
            {segments.map((segment, index) => (
              <li
                key={segment.startHop}
                className="flex items-start gap-x-md"
              >
                {index > 0 ? (
                  <span aria-hidden="true" className="type-body-sm text-muted-soft">
                    {isGap(segments[index - 1], segment) ? "—" : "→"}
                  </span>
                ) : null}

                <span className="flex flex-col">
                  <span className="type-code text-ink">AS{segment.asn}</span>

                  {segment.organization === undefined ? null : (
                    <span className="type-caption text-body">
                      {segment.organization}
                    </span>
                  )}

                  <span className="type-caption text-muted-foreground">
                    {t("hopRange", {
                      count: segment.endHop - segment.startHop + 1,
                      range:
                        segment.startHop === segment.endHop
                          ? String(segment.startHop)
                          : `${segment.startHop}–${segment.endHop}`,
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/**
 * Whether two segments came from hops that are not next to each other.
 *
 * Read from the hop indices rather than tracked separately, because that is
 * where the fact already lives: `buildAsPath` never merges across a hop that
 * resolved to nothing, so a missing hop shows up as a break in the numbering
 * and nowhere else.
 */
function isGap(
  previous: AsPathSegment | undefined,
  segment: AsPathSegment,
): boolean {
  return previous !== undefined && previous.endHop + 1 !== segment.startHop;
}
