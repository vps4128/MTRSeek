import { CircleSlash, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";

import { Icon } from "@/components/ui/icon";
import { EMPTY_VALUE } from "@/lib/analysis/format";
import type { SubnetErrorCode, SubnetFacts, SubnetResult as Result } from "@/lib/subnet/cidr";

/**
 * The id of the error block, so the field in the other column can point at it.
 *
 * Exported because the two live in different files and `aria-describedby` names
 * an element by id: a second copy of the string in the calculator would be a
 * silent failure the day one of them changed.
 */
export const SUBNET_PROBLEM_ID = "subnet-problem";

/**
 * The answer, on the dark card the rest of this app prints output on.
 *
 * ## What it can be showing
 *
 * Three things, and the shape of the card is the same for all of them: a prompt
 * that echoes what was typed, and under it either the eight labelled rows, a
 * sentence saying what to type, or the reason what was typed cannot be read as
 * a CIDR. One surface holds all three without changing shape, which is what
 * keeps the card's top edge still while the reader types and only its bottom
 * edge moves.
 *
 * ## Why it is drawn as a terminal window
 *
 * The same reason `components/ip/lookup-result.tsx` is: these are values a
 * command would have printed, `components/analysis/hop-details.tsx` draws the
 * hops of a trace on exactly these tokens, and DESIGN.md's `code-window-card`
 * is the system's own component for showing real output rather than an
 * illustration of it.
 *
 * ## Why the eight rows have no icons
 *
 * The heading and the label do; the rows do not, and neither do the nine
 * columns of the hop table. These rows are eight short values of three kinds —
 * addresses, masks and one count — under labels that already name them. A glyph
 * on each would be a second column saying what the first one says, which is the
 * argument `hop-details.tsx` makes at length for its own columns. The one place
 * this app does put a glyph on every row is the IP lookup's three, and the
 * reason given there is that those three are three different *kinds* of fact
 * with nothing else on the card to say so. Eight rows that are mostly the same
 * kind are the other case.
 *
 * ## Why every value is monospace
 *
 * `type-code` throughout, on the labels as well as the values. The card is one
 * column of tabular data and the labels are as short as the values; setting the
 * labels in body type would make each row two weights of text where the hop
 * table has one. `lookup-result.tsx` makes the same call, and its labels are
 * also `type-code`.
 *
 * ## Why a broadcast address can be an em dash
 *
 * A `/31` and a `/32` have no broadcast address — a `/31` is a point-to-point
 * link whose two addresses are both usable hosts, per RFC 3021. The row stays,
 * because the card's eight rows do not change between prefixes, and it shows
 * the em dash this app uses everywhere for a fact that does not exist rather
 * than the top of the range pretending to be a broadcast address. See
 * `lib/subnet/cidr.ts`.
 */

/**
 * The card, in two pieces.
 *
 * `CARD` is the frame, `OUTPUT` the recessed area the answer is printed in —
 * the same pair, and the same reasoning, as `lookup-result.tsx`. `CARD` carries
 * no vertical offset of its own: the page's grid starts both columns on one
 * line, and a margin here would be that decision made twice.
 */
const CARD =
  "w-full min-w-0 max-w-[520px] rounded-lg bg-surface-dark p-lg lg:justify-self-end";

const OUTPUT = "mt-md rounded-md bg-surface-dark-soft p-md";

/**
 * The failures that have something to say.
 *
 * A `Record` over the codes that can reach this component rather than a switch,
 * so a code added to `SubnetErrorCode` without a message here fails to compile
 * instead of falling through to a blank card.
 *
 * `EMPTY_INPUT` is deliberately not a member. An empty field is not a mistake
 * the reader made — it is the state before they have made one — so it draws the
 * idle prompt below rather than an error, and a message telling somebody their
 * empty box is not a CIDR would be the card complaining about nothing. The code
 * still exists in the module, which is what lets this component tell the two
 * apart by asking rather than by testing the string itself.
 */
const PROBLEMS: Record<
  Exclude<SubnetErrorCode, "EMPTY_INPUT">,
  { key: "badAddress" | "badPrefix"; icon: LucideIcon }
> = {
  BAD_ADDRESS: { key: "badAddress", icon: CircleSlash },
  BAD_PREFIX: { key: "badPrefix", icon: TriangleAlert },
};

export function SubnetResult({ query, result }: { query: string; result: Result }) {
  const t = useTranslations("subnet");

  return (
    /* Named for assistive technology rather than by a visible heading: the card
       is a prompt and a list of values, and a title would be a ninth thing to
       read past — but a region that arrives in the tab order unnamed is worse.
       The name is the same in every state, so a reader who is told their input
       is wrong hears the same landmark they heard before. */
    <section aria-label={t("resultTitle")} className={CARD}>
      {/* `break-all`, not `break-words`: a 15-character CIDR and an IPv6-shaped
          typo have no break opportunity that is guaranteed to fall where the
          card ends. Trimmed, because what was asked is the trimmed string. */}
      <p className="min-w-0 break-all type-code text-on-dark-soft">
        <span className="text-muted-soft">$</span> {query.trim()}
      </p>

      {result.ok ? (
        <Facts facts={result.facts} />
      ) : result.code === "EMPTY_INPUT" ? (
        <p className={`${OUTPUT} type-body-sm text-on-dark-soft`}>{t("idle")}</p>
      ) : (
        <Problem code={result.code} />
      )}
    </section>
  );
}

/** The eight rows. */
function Facts({ facts }: { facts: SubnetFacts }) {
  const t = useTranslations("subnet.rows");

  const rows: { label: string; value: string }[] = [
    { label: t("address"), value: facts.address },
    { label: t("mask"), value: facts.mask },
    { label: t("cidr"), value: facts.cidr },
    { label: t("network"), value: facts.network },
    { label: t("broadcast"), value: facts.broadcast ?? EMPTY_VALUE },
    { label: t("range"), value: `${facts.first} – ${facts.last}` },
    { label: t("hosts"), value: String(facts.hosts) },
    { label: t("wildcard"), value: facts.wildcard },
  ];

  return (
    /* A `dl` rather than eight paragraphs: these are label-and-value pairs and
       the element says so, so a screen reader reads a label as the term for the
       value beside it. `grid-cols-[auto_1fr]` puts the values in one column
       without a width measured off the longest label, which is what lets the
       Chinese and Latin labels change length without the column being retuned.
       Same construction as `lookup-result.tsx`, for the same reasons. */
    <dl
      className={`${OUTPUT} grid grid-cols-[auto_1fr] gap-x-sm gap-y-xs type-code sm:gap-x-md`}
    >
      {rows.map((row) => (
        /* A fragment, not the `<div>` wrapper HTML also permits here: a wrapper
           with `display: contents` is dropped from the accessibility tree by
           older Safari, which takes the `dt`/`dd` pairing this element exists
           for along with it. */
        <Fragment key={row.label}>
          <dt className="text-muted-soft">{row.label}</dt>
          <dd className="break-all text-on-dark">{row.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** Why the eight rows cannot be drawn. */
function Problem({ code }: { code: Exclude<SubnetErrorCode, "EMPTY_INPUT"> }) {
  const t = useTranslations("subnet");
  const { key, icon } = PROBLEMS[code];

  return (
    <div id={SUBNET_PROBLEM_ID} className={OUTPUT}>
      {/* Body type, not `type-code`: the rows are data, this is a sentence about
          the input, and setting it in the mono face would make a diagnosis look
          like output. The same distinction `lookup-result.tsx` draws. */}
      <h2 className="flex items-center gap-1.5 type-title-sm text-on-dark">
        <Icon of={icon} />
        {t(`problems.${key}`)}
      </h2>
      <p className="mt-xs type-body-sm text-on-dark-soft">
        {t(`problems.${key}Description`)}
      </p>
    </div>
  );
}
