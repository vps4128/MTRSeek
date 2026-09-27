# RouteLens

MTR / Traceroute Network Route Analyzer

Paste MTR, WinMTR, NextTrace or traceroute output to understand every hop, ASN,
ISP and network route.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The root redirects to the default locale.

## Languages

RouteLens ships in two languages, and both are real routes rather than a
client-side toggle:

| Language          | URL       |
| ----------------- | --------- |
| Chinese (default) | `/zh`     |
| English           | `/en`     |

`/` redirects to `/zh`. The language lives in the URL, so a link opens in the
language it was copied from and a reload keeps it. The switcher in the header
swaps only the locale prefix, so `/zh/analysis` becomes `/en/analysis`.

Translation strings live in `messages/zh.json` and `messages/en.json` and are
reached through `t("…")` keys; no component branches on a language variable and
nothing is stored in `localStorage`.

Two kinds of text are deliberately **not** translated:

- **Network facts.** Addresses, ASNs, latencies, loss figures and raw trace
  output are what a terminal prints, and are identical in both catalogs.
- **The brand.** The product is `RouteLens` in every language.

## Scripts

| Script              | Purpose                      |
| ------------------- | ---------------------------- |
| `npm run dev`       | Start the development server |
| `npm run build`     | Production build             |
| `npm run lint`      | ESLint                       |
| `npm run typecheck` | TypeScript, no emit          |
| `npm test`          | Vitest, once                 |

## Status

Phase 3 — parsing, the analysis page, and MaxMind GeoLite2 enrichment.

The homepage is a hero and a trace input, in both languages. The hero's button
scrolls to the input and nothing else; the input's own button is the real entry
point. It runs the paste through `parseTrace` and, if the text is a trace it
recognises, stores it and hands off to `/analysis`. If it is not, the reader
stays where they are and is told why under the field, with their text still in
it. "Load Example" fills the field with real MTR output, which the parser reads
like any other paste.

### The analysis page

One page, read top to bottom — no tabs and no view state:

```
Route Analysis      target, source, hop count, packet loss
Route Summary       target · hop count · packet loss · avg · best · worst RTT
AS Path             a compact line, empty this phase
Hop Details         the hop table
Map                 a placeholder, empty this phase
```

None of these sections is an alternative to any other, so none of them is
behind a click: a reader who wants the hop table also wants the summary above
it.

The hop table reads left to right as three questions about each hop — who it is,
where it is, what it measured:

```
Hop  IP Address  Hostname  ISP  ASN  Location  Loss  Best RTT  Avg RTT  Worst RTT
```

The first six answer the first two questions, and the middle three of those are
looked up rather than parsed. `ASN` reads `AS15169 / Google Inc.` and `Location`
reads `China · Jilin Sheng · Changchun`, narrowing to whatever the database
actually resolved — a record that stops at the country shows the country alone.
A hop with no answer in any database, or an address the internet does not route
such as `192.168.1.1`, shows an em dash in all three.

`ISP` is an **em dash in every row**, and that is the complete answer rather
than a gap. MaxMind's free databases carry no ISP field — the trait belongs to
the paid GeoIP2 ISP product — so there is nothing to read, and the one
substitution that would fill the column, copying the ASN's organization across,
would state a different fact under the ISP's name. An AS is an allocation; an
ISP is a service sold over it. Nothing is ever inferred from the address: a
range that looks like China Telecom is a guess wearing a fact's clothes.

`Location` says where an address is *registered*, which is why it is not called
anything more precise.

Past ten hops the table scrolls rather than growing, with its header stuck to
the top of the scroll box so a row is always read against its column names.
Ten hops or fewer produce no scrollbar at all: the cap is a maximum, not a
height. Nowhere is a hop dropped, hidden or paged away.

### Parsers

Four formats, one shape. Each parser is a pure function from text to
`ParsedTrace`; `parseTrace` detects the format and dispatches, and never returns
a partial result — a paste becomes a trace with hops in it, or it becomes an
error the caller has to show.

| Format       | How it is read                                                    |
| ------------ | ----------------------------------------------------------------- |
| MTR          | Columns located from the header, then sliced — so `???`, a missing `Snt` or a hostname with spaces cannot shift a value into the wrong field |
| WinMTR       | `\|`-delimited rows, rejected unless all seven cells are present   |
| NextTrace    | Line by line: each line is asked separately for a hop number and for RTTs, and a line that answers neither is skipped |
| `traceroute` | The numbered rows, with the destination read from the tool's own header |

`lib/parsers/values.ts` holds the readers they share — `???`/`*`/`-` all mean
"no answer" and become an absent field, never a zero.

### Enrichment

ASN and geography come from two local MaxMind GeoLite2 databases, read through
`maxmind`. Nothing is downloaded at runtime and no address leaves the machine —
the lookup is a file read.

| Layer                      | What it does                                                       |
| -------------------------- | ------------------------------------------------------------------ |
| `lib/enrichment/ip.ts`     | Decides which addresses are worth asking about                     |
| `lib/enrichment/service.ts`| Deduplicates, filters, calls the provider, preserves order         |
| `lib/enrichment/maxmind/`  | Reads the two MMDB files; caches the readers across hot reloads    |
| `lib/enrichment/merge.ts`  | Folds an answer into a hop, touching nothing that was measured     |
| `app/api/enrich/route.ts`  | `POST { "ips": [...] }` → `{ "data": [...] }`                       |

Set `MAXMIND_ASN_DB_PATH` and `MAXMIND_CITY_DB_PATH` to the two `.mmdb` files —
see `.env.example`, which documents where to get them and how often to replace
them. The files are tens of megabytes, licensed to whoever downloaded them and
republished weekly, so they are deployment data: `.gitignore` excludes both
`data/geoip/` and `*.mmdb`.

Three properties are deliberate and worth knowing before changing any of it:

- **A missing database is not a broken app.** The route answers `503` saying
  which database is absent, and the analysis page renders exactly as it does
  otherwise — em dashes in three columns, every measurement intact.
- **`/api/enrich` accepts exactly one request shape.** An unexpected field is a
  rejection rather than something ignored, so `url`, `endpoint`, `callback` and
  `proxy` are refused by the same check that refuses a typo, and there is no
  code path that reads one.
- **Enrichment is a render-time overlay.** It is never written back to
  `sessionStorage`, so what is stored stays a record of what was measured and a
  database updated tomorrow changes tomorrow's page.

### What is never filled in

`Hop.isp` is absent on every hop this repository produces, because the free
databases have no such field. Nothing infers it from the address or from the
ASN's organization, and the hop table shows an em dash.

Prefix and route classification are absent outright — there is no field for
either. The AS Path section says what it is waiting for rather than showing a
row of plausible AS numbers, and the Map placeholder does the same for the
coordinates the lookup *does* return (§19 keeps this phase from adding a
mapping SDK). `lib/route-detection/types.ts` defines the shape a classification
would take, and there is deliberately no rule table and no function — a stub
that returned "CN2" for `59.43.x.x` would be a guess wearing the clothes of a
measurement.

### Storage

A parsed trace waits in `sessionStorage` between the homepage and `/analysis`,
not in the URL: a trace is kilobytes of text, and a query string holding it is
an unshareable link that breaks in a chat client. A reload after the tab is
closed finds nothing and gets an explicit empty state — never a sample report,
which would be indistinguishable from a real one.

## Design

`DESIGN.md` is the design specification and the single source of truth for this
project. Its tokens are defined once in `app/globals.css` — colours, spacing,
radius, container width and the typographic scale — and every component reads
from those tokens rather than inlining values.

Two additions in `globals.css` extend the system to Chinese; neither changes
anything DESIGN.md specifies for Latin text:

- **CJK font fallbacks.** None of DESIGN.md's three faces carries a Chinese
  glyph. The stacks are completed with the serif and sans the platforms ship
  (Songti SC / PingFang SC, SimSun / Microsoft YaHei, Noto CJK), so Chinese
  keeps the same display-serif / body-sans split as English instead of falling
  into a browser default.
- **Script-aware tracking and measures.** DESIGN.md's negative display tracking
  is a Latin device that makes full-width Han characters collide, and its `ch`
  measures are roughly half as wide in Chinese as intended. Both are adjusted
  under `:lang(zh)` only.
