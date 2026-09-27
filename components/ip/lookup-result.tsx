"use client";

import {
  Building2,
  CircleSlash,
  Globe,
  Info,
  MapPin,
  SearchX,
  ServerCrash,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui/icon";
import { EMPTY_VALUE, formatLocation } from "@/lib/analysis/format";
import type { IpLookupOutcome } from "@/lib/enrichment/lookup";
import { localizeCountry, localizeName } from "@/lib/enrichment/names";
import {
  getLastLookupServerSnapshot,
  getLastLookupSnapshot,
  saveLastLookup,
  subscribeToLastLookup,
} from "@/lib/enrichment/storage";
import type { IpEnrichment } from "@/lib/enrichment/types";
import type { Locale } from "@/i18n/routing";

/**
 * The answer, in the column beside the form.
 *
 * ## What it can be showing
 *
 * Three things, and `resolve` below is the whole of how they are chosen: the
 * answer to the address in the URL, the answer to the last address this tab
 * asked about, or the reason the address in the URL has none. The second exists
 * because the question lives in the URL — which is what makes a result a link
 * somebody can send — and a page whose entire content comes from its query
 * string has nothing to show once the query string is gone. Stepping over to
 * the analysis page and back is the ordinary case of that, and it should not
 * cost the reader their answer.
 *
 * The memory is written by the first case and read by the second, so a lookup
 * that succeeded is what the next visit starts from, and a lookup that came
 * back with a reason never displaces a real answer.
 *
 * ## Why it is a client component
 *
 * For that second case: the remembered answer lives in `sessionStorage`, which
 * the server cannot read, so the card has to be drawable in the browser. It is
 * still rendered on the server for the first two cases — a client component is
 * server-rendered like any other — so `/zh/ip?q=1.1.1.1` arrives as HTML with
 * the answer already in it, and the effect that remembers it runs after
 * hydration.
 *
 * The cost is one frame of the empty prompt on a return visit: the server
 * renders "nothing remembered yet", because that is the only thing it can
 * honestly render, and the real answer follows on the client. That is the same
 * trade `AnalysisView` makes, and the same reason — an empty card is a
 * statement about a value nobody has read yet, and the alternative is a page
 * that lies for its first frame.
 *
 * ## Why it is drawn as a terminal window
 *
 * Three of the things this card can say are strings a terminal would have
 * printed: an address, an operator, a place. The other two are a prompt with
 * nothing after it and a sentence about why there is nothing after it. One
 * surface holds all five without changing shape between them, which is what
 * keeps the answer's top edge still while its contents change underneath.
 *
 * It is also the surface this app already uses for real output.
 * `components/analysis/hop-details.tsx` draws the hops of an uploaded trace on
 * exactly these tokens, and DESIGN.md's `code-window-card` is the system's own
 * component for showing real output rather than an illustration of it. A dark
 * card here reads as the same application; the cream panel with a hairline
 * border that this used to be read as a form control that happened to have text
 * in it.
 *
 * ## The one piece of the mock it does not copy
 *
 * `components/mtr/mtr-preview.tsx` — the homepage's card — puts a teal dot at
 * the right-hand end of its prompt line. That dot is chrome for a card
 * pretending to be a live session, and it is deliberately not here. Always
 * teal, it would sit beside a message saying the databases are missing; made to
 * change colour, it would need a text equivalent that the card's own text
 * already gives. Real output in this app never had one.
 *
 * ## Why the header echoes an address
 *
 * The line above the output names the address the card is about — what a shell
 * prints back. The answer's own `ip` when there is an answer, and otherwise
 * what the reader typed, trimmed. It is not the answer itself: the answer is
 * the `IP：` row below it, and in the two states with no answer at all the echo
 * is the only thing on the card that says what was asked.
 *
 * Nothing is invented for it. A card with no address in the URL and nothing
 * remembered shows a bare `$` and stops. A line reading `whois 1.1.1.1` would
 * name a command this page never runs — the lookup reads two files off the
 * server's disk — and would be the card lying about how its answer was reached.
 *
 * ## Why every line is labelled
 *
 * The card stacks three facts that are all short strings of digits and Latin
 * letters — `8.8.8.8`, `Google LLC`, `美国 · 加利福尼亚`. Unlabelled, the only
 * thing distinguishing them is their order, which a reader has to have been
 * told. `IP：`, `Org：` and `地址：` say what each line is, and they are what
 * gives the em dash a meaning when one of them is missing: `Org：—` reads as a
 * fact the database did not answer, where a bare `—` would read as a rendering
 * fault. The labels come from the message catalogue like every other string
 * here, so the punctuation that joins a label to its value is the translator's
 * to set, not this file's.
 *
 * ## Why the address narrows instead of padding itself out
 *
 * A found answer shows the address as far as the database resolved it: a record
 * that stops at the country shows the country alone, and one that resolved
 * nothing shows the em dash every other absent field in this app gets. That is
 * `formatLocation` — the same function the hop table prints a location with —
 * so a row and a lookup cannot spell the same place two ways.
 *
 * The location is chosen here rather than in the database layer, because this
 * is the only place that knows which language the reader is reading in.
 * `localizeCountry` is shared with the hop table, so the two cannot disagree
 * about the same address; `localizeName` covers the region and the city, which
 * no such table applies to. Both run on the client as well as the server, which
 * is what lets a remembered answer be re-localized rather than stored as one
 * language's strings.
 */

/**
 * The card, in three pieces.
 *
 * `CARD` is the frame, `OUTPUT` the recessed area the answer is printed in,
 * `STRIP` the status line under it. Constants rather than the same lists
 * repeated in every branch, because the branches differ only in what is inside
 * them and a class that drifted between them would show up as a box that jumped
 * a few pixels between a hit and a miss.
 *
 * `CARD` carries no vertical offset and no alignment of its own. The page's
 * grid starts both columns on one line deliberately — see the note there — and
 * a margin here would be that decision made twice, in a place where the other
 * column cannot see it.
 */
const CARD =
  "w-full min-w-0 max-w-[520px] rounded-lg bg-surface-dark p-lg lg:justify-self-end";

const OUTPUT = "mt-md rounded-md bg-surface-dark-soft p-md";

const STRIP =
  "mt-md rounded-md bg-surface-dark-elevated px-md py-sm type-caption text-on-dark-soft";

/**
 * What the card is showing.
 *
 * A value rather than a chain of conditions inside the markup, because the same
 * decision has two readers — the header line, which needs the address, and the
 * body, which needs the whole of it — and two copies of a three-way choice is
 * two places for it to drift apart.
 */
type Shown =
  | { kind: "answer"; enrichment: IpEnrichment }
  | {
      kind: "notice";
      status: Exclude<IpLookupOutcome["status"], "empty" | "found">;
      detail?: string;
    }
  /** Before anything has been asked, here or in this tab. */
  | { kind: "idle" };

/**
 * The failures that have something to say, keyed by outcome status.
 *
 * A `Record` over the union's non-answer statuses rather than a switch, so the
 * mapping is exhaustive by construction: a status added to `IpLookupOutcome`
 * without a message here fails to compile, rather than falling through to a
 * blank card.
 *
 * The glyph is part of an entry rather than a second lookup, so a status cannot
 * gain a message and keep someone else's mark — the two are added together or
 * not at all. Each says what went wrong rather than how bad it is: a slash
 * through a circle for text that was not an address, a shield for one that is
 * not routable, a struck-out magnifier for an address no database answered for,
 * and a broken server for the databases themselves being unreachable. That last
 * one is the only failure that is the site's fault rather than the input's, and
 * it is the only one whose glyph is a machine.
 */
const NOTICE: Record<
  Exclude<IpLookupOutcome["status"], "empty" | "found">,
  { key: "invalid" | "notPublic" | "noRecord" | "unavailable"; icon: LucideIcon }
> = {
  invalid: { key: "invalid", icon: CircleSlash },
  "not-public": { key: "notPublic", icon: ShieldAlert },
  "no-record": { key: "noRecord", icon: SearchX },
  unavailable: { key: "unavailable", icon: ServerCrash },
};

/**
 * Which of the three the reader gets.
 *
 * The URL wins whenever it asks anything, including when what it asks has no
 * answer: a reader who has just been told `192.168.1.1` is not routable should
 * not be shown the last address that worked instead. The memory is the fallback
 * for the one case the URL cannot cover — a page with no question on it at all.
 */
function resolve(
  outcome: IpLookupOutcome,
  remembered: IpEnrichment | null,
): Shown {
  if (outcome.status === "found") {
    return { kind: "answer", enrichment: outcome.enrichment };
  }

  if (outcome.status !== "empty") {
    return {
      kind: "notice",
      status: outcome.status,
      detail: outcome.status === "unavailable" ? outcome.detail : undefined,
    };
  }

  return remembered === null
    ? { kind: "idle" }
    : { kind: "answer", enrichment: remembered };
}

export function LookupResult({
  locale,
  outcome,
  query,
}: {
  locale: Locale;
  outcome: IpLookupOutcome;
  query: string;
}) {
  const t = useTranslations("ip");

  const remembered = useSyncExternalStore(
    subscribeToLastLookup,
    getLastLookupSnapshot,
    getLastLookupServerSnapshot,
  );

  const shown = resolve(outcome, remembered ?? null);

  // A lookup that answered is what the next visit to this page starts from.
  // Nothing is remembered for the other four outcomes: see the storage module.
  const answer = shown.kind === "answer" ? shown.enrichment : null;
  useEffect(() => {
    if (answer !== null) saveLastLookup(answer);
  }, [answer]);

  return (
    /* Named for assistive technology rather than by a visible heading: the card
       is a prompt and three short lines, and a title would be a fifth thing to
       read past — but a region that arrives in the tab order unnamed is worse.
       The name is the same in every state, including the one before anything
       has been asked, so a reader who submits twice hears the same landmark
       twice rather than a region that appears and disappears. */
    <section aria-label={t("resultTitle")} className={CARD}>
      {/* `break-all`, not `break-words`: a 39-character IPv6 address has no
          break opportunity except its colons, and none of them is guaranteed to
          fall where the card ends. `break-all` wraps it wherever it has to
          rather than letting it widen the card. Trimmed because the address
          that was looked up is the trimmed one — a trailing space would
          otherwise be echoed back as a fact about the input. */}
      <p className="min-w-0 break-all type-code text-on-dark-soft">
        <span className="text-muted-soft">$</span>{" "}
        {shown.kind === "answer" ? shown.enrichment.ip : query.trim()}
      </p>

      {shown.kind === "answer" ? (
        <Answer locale={locale} enrichment={shown.enrichment} />
      ) : shown.kind === "notice" ? (
        <Notice status={shown.status} detail={shown.detail} />
      ) : null}
    </section>
  );
}

/** Three label-and-value rows, and the caveat that belongs under them. */
function Answer({
  locale,
  enrichment,
}: {
  locale: Locale;
  enrichment: IpEnrichment;
}) {
  const t = useTranslations("ip");
  const geo = enrichment.geo;

  const address = formatLocation({
    country: localizeCountry(geo?.country, geo?.countryCode, locale),
    region: localizeName(geo?.region, locale),
    city: localizeName(geo?.city, locale),
  });

  return (
    <>
      {/* A `dl` rather than three paragraphs: these are three label-and-value
          pairs, and the element says so — a screen reader reads `IP：` as the
          term for the address that follows it rather than as text that happens
          to precede it. `grid-cols-[auto_1fr]` is what puts the values in one
          column: the first track sizes to the widest label, so `IP：`, `Org：`
          and `地址：` line up without a width measured off any one of them, and
          the Chinese and Latin labels can change length without the column
          needing to be re-tuned. */}
      <dl className="mt-md grid grid-cols-[auto_1fr] gap-x-sm gap-y-xs rounded-md bg-surface-dark-soft p-md type-code sm:gap-x-md">
        {/* Three icons here, where the trace page's summary has none. These
            three rows are three different kinds of fact — an address, an
            operator, a place — and the glyph is the only thing on the card
            that says so before the label is read. The muted `dt` colour is
            inherited, so the icons sit at the weight of the labels they
            belong to rather than at the weight of the values. */}
        <dt className="flex items-center gap-1.5 text-muted-soft">
          <Icon of={Globe} />
          {t("ipLabel")}
        </dt>
        <dd className="break-all text-on-dark">{enrichment.ip}</dd>

        <dt className="flex items-center gap-1.5 text-muted-soft">
          <Icon of={Building2} />
          {t("orgLabel")}
        </dt>
        <dd className="break-words text-on-dark">
          {/* Never translated: the database holds one spelling of an operator's
              name and this app has no second one to offer. */}
          {enrichment.asn?.organization ?? EMPTY_VALUE}
        </dd>

        <dt className="flex items-center gap-1.5 text-muted-soft">
          <Icon of={MapPin} />
          {t("addressLabel")}
        </dt>
        <dd className="break-words text-on-dark">{address}</dd>
      </dl>

      {/* Only beside a location, because that is what it is about. An address
          with no GeoIP record answered nothing about where it is, and there is
          no approximation to caveat. */}
      {geo === undefined ? null : (
        <p className={`${STRIP} flex items-start gap-1.5`}>
          {/* `items-start`, not `items-center`: the sentence wraps to two lines
              on a phone and an icon centred against a wrapped paragraph floats
              between them. Aligned to the first line it reads as the start of
              the sentence, which is what it is. */}
          <Icon of={Info} className="mt-0.5" />
          {t("approximate")}
        </p>
      )}
    </>
  );
}

/** Why there is no answer, on the same card the answer would have been on. */
function Notice({
  status,
  detail,
}: {
  status: Exclude<IpLookupOutcome["status"], "empty" | "found">;
  detail?: string;
}) {
  const t = useTranslations("ip");
  const { key, icon } = NOTICE[status];

  return (
    <div className={OUTPUT}>
      {/* Body type, not `type-code`. The answers on this card are data; this is
          a sentence about the data, and setting it in the mono face would make
          a diagnosis look like output. */}
      <h2 className="flex items-center gap-1.5 type-title-sm text-on-dark">
        <Icon of={icon} />
        {t(`notices.${key}`)}
      </h2>
      <p className="mt-xs type-body-sm text-on-dark-soft">
        {t(`notices.${key}Description`)}
      </p>

      {/* The server's own diagnosis — which variable is unset, which file it
          could not read. Shown rather than swallowed, because the one reader
          who can act on it is the one who deployed this, and a message that
          said only "it did not work" would leave them with nothing to check.
          Absent when the lookup threw, in which case the reason is in the
          server log and there is no line to print here. Back in `type-code`,
          because this one *is* output. */}
      {detail === undefined ? null : (
        <p className="mt-sm break-words type-code text-muted-soft">{detail}</p>
      )}
    </div>
  );
}
