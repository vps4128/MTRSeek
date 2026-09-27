# RouteLens

MTR / Traceroute Network Route Analyzer

Paste MTR, WinMTR, NextTrace or traceroute output to understand every hop, ASN
and network route.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The root redirects to the default locale.

## Language

RouteLens is Chinese. The language is still a route segment rather than a
client-side setting, so a page has one URL and survives a reload without
anything being stored on the client:

| Language | URL   |
| -------- | ----- |
| Chinese  | `/zh` |

`/` redirects to `/zh`. There is no language switcher, because a control
offering one choice is not a control.

Translation strings live in `messages/zh.json` and are reached through `t("…")`
keys; no component branches on a language variable and nothing is stored in
`localStorage`.

Two kinds of text are deliberately **not** translated:

- **Network facts.** Addresses, ASNs, latencies, loss figures and raw trace
  output are what a terminal prints.
- **The brand.** The product is `RouteLens`.

A third kind of text is neither translated nor fixed: a place name out of a
GeoIP database. The database carries its own name for a place in every language
it was compiled with, and the page asks for the Chinese one — `zh-CN` is
MaxMind's key, and there is no plain `zh` among the eight locales they compile.
Nothing is translated on the way: a place the database carries no Chinese name
for falls back to its English one, which is the single key the format
guarantees, and a place it does not name at all shows an em dash rather than a
name this app assembled. That fallback is why `en` survives in the enrichment
layer after the English pages went — it is not a language this app is offered
in, it is the one entry every MMDB build is guaranteed to have. An ASN's
organization is never translated at all, because the database holds one spelling
of it and no second one to choose between.

## Scripts

| Script              | Purpose                      |
| ------------------- | ---------------------------- |
| `npm run dev`       | Start the development server |
| `npm run build`     | Production build             |
| `npm run lint`      | ESLint                       |
| `npm run typecheck` | TypeScript, no emit          |
| `npm test`          | Vitest, once                 |

## Status

Phase 4 — parsing, the analysis page, MaxMind GeoLite2 enrichment, and the IP
lookup.

The homepage is a hero and a trace input. The hero's button
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
AS Path             the observed ASN sequence, one segment per AS
Hop Details         the hop table
```

None of these sections is an alternative to any other, so none of them is
behind a click: a reader who wants the hop table also wants the summary above
it.

The hop table reads left to right as three questions about each hop — who it is,
where it is, what it measured:

```
Hop  IP Address  Hostname  ASN  Location  Loss  Best RTT  Avg RTT  Worst RTT
```

The first five answer the first two questions, and two of those five are looked
up rather than parsed. `ASN` reads `AS15169 / Google Inc.` and `Location` reads
`中国 · 吉林 · 长春`, narrowing to whatever the database actually resolved — a
record that stops at the country shows the country alone, and one MaxMind
carries no Chinese name for shows the English one it does carry. The
organization is never translated, because the database has one spelling of it. A
hop with no answer in any database, or an address the internet does not route
such as `192.168.1.1`, shows an em dash.

`ASN` is the one column whose values wrap. Organization names run to forty
characters — `CHINA UNICOM China169 Backbone`, `Alibaba (US) Technology Co.,
Ltd.` — and on a single line that column alone was wider than the rest of the
table put together, which is what pushed the whole table into horizontal scroll
on a desktop. Its values fold at the width `--hop-asn-column-max-width` sets.
Every other column keeps to one line, because a wrapped IP address or a split
RTT is worse to read than a scroll.

There is no `ISP` column. MaxMind's free databases carry no ISP field — the
trait belongs to the paid GeoIP2 ISP product — so the column would have drawn an
em dash in every row it ever had, which is the same answer as leaving it out
repeated once per hop. Nor is it filled by the substitution that suggests
itself, copying the ASN's organization across: an AS is an allocation and an ISP
is a service sold over it, and nothing is ever inferred from the address, so a
range that looks like China Telecom is a guess wearing a fact's clothes.

`Location` says where an address is *registered*, which is why it is not called
anything more precise.

Past ten hops the table scrolls rather than growing, with its header stuck to
the top of the scroll box so a row is always read against its column names.
Ten hops or fewer produce no scrollbar at all: the cap is a maximum, not a
height. A trace whose organization names are long enough to wrap shows fewer
than ten rows before the scrollbar appears, and the scrollbar it shows is the
same one an eleventh hop would have produced. Nowhere is a hop dropped, hidden
or paged away.

### AS Path

The line under the summary is the sequence of autonomous systems the trace was
observed to cross, folded out of the same enriched hops the table below renders,
so a row and a segment cannot disagree about what a hop belongs to.

Consecutive hops in one AS become a single segment carrying the number, the
operator's name and the hop range it covers. A return to an AS the trace had
already left starts a new segment rather than being folded into the first —
that return is the most interesting thing the sequence has to say, and merging
it away would report a path that never happened. A hop that resolved to nothing
ends the run and starts nothing, and the separator between the segments either
side of it is a dash rather than an arrow: the gap is drawn rather than closed
by assuming the silent hop belonged to either neighbour.

The current AS Path represents the observed ASN sequence derived from trace
hops. **It is not a BGP AS Path.** Nothing here queries a routing-information
service, and a path assembled from the hops that answered is a weaker object
than the one BGP announces — a router that stays silent contributes nothing,
and the sequence says where the trace was seen, not what the routing table
carries.

### IP lookup

`/[locale]/ip` is the app's second page, linked from the header, and it asks one
question: what does the local MaxMind data say about this address? It takes IPv4
and IPv6 and answers with three lines — the address, the operator that holds it,
and the place the database put it in, joined and narrowed by the same
`formatLocation` the hop table prints a location with:

```
8.8.8.8
Google LLC
地址：美国 · 加利福尼亚州 · 山景城
```

The answer sits in the column beside the form rather than under it, so using the
field does not push it down the page. Below `md` there is one column and it
follows the form.

Nothing new was added underneath it. The page calls the same enrichment the
analysis page does — the same two MMDB files, the same provider, the same
`localizeCountry`/`localizeName` pair choosing the place names — and no
third-party IP service is reached directly or indirectly. A `?q=` address is
looked up on the server before the page is sent, which is what makes a result a
URL: `/zh/ip?q=8.8.8.8` can be bookmarked and shared, and the browser's back
button steps through previous lookups.

The lookup can come back empty in four ways, and they get four different
answers because they have four different fixes:

| What was typed | What the page says |
| --- | --- |
| `8.8.8.8.8` | not an address, with an example of one |
| `192.168.1.1` | a valid address no GeoIP database covers — private, loopback and link-local ranges are in none of them |
| `8.8.8.8`, unallocated | valid, but in neither database |
| anything, no databases installed | the lookup never ran, and which variable is unset |

The last one is why the lookup runs on the server rather than in a `fetch` to
`/api/enrich`: a client would receive a `503` and an empty `200` as the same
thing and could only render one message for both.

The result says under the address that it is an approximate GeoIP location
rather than a device's position. There is no map, and no basemap service is
contacted.

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
| `lib/enrichment/names.ts`  | Picks which of the database's names a given page shows             |
| `lib/enrichment/merge.ts`  | Folds an answer into a hop, touching nothing that was measured     |
| `lib/enrichment/lookup.ts` | One address, and the reason when there is nothing to show          |
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

The name a place is shown under is decided in the same place and once:
`applyEnrichment` takes the locale and resolves each of the three names through
`localizeName`, so the hop table and the IP lookup read the same string off the
same answer rather than each choosing from the lookup map and being free to
disagree. The provider deliberately does not choose — it hands on every language
the database answered in, which is why the API response carries a name per
language and no preference between them.

The names that are not the database's are the countries in `localizeCountry`'s
short table: Hong Kong, Macau and Taiwan read `中国香港`, `中国澳门` and
`中国台湾`. A territory's own name and the way a reader says where it is are two
different things, and this is the only place the app says the second. The table
is keyed on the ISO code rather than on the name, because the name is the thing
it exists to replace, and it is applied to the country and to nothing else — a
region or a city that happens to share the name is a different field. Three
entries, and an entry is not a policy: every other country is left exactly as
the database spells it.

### What is never filled in

A hop carries an `asn` and a `location` and no third looked-up field. There is
no provider name on it, so the substitution that would have filled one — the
ASN's organization, which reads like an ISP name for the large carriers — is not
something the code refuses; it is something the shape cannot express.

Prefix and route classification are absent outright — there is no field for
either. `lib/route-detection/types.ts` defines the shape a classification would
take, and there is deliberately no rule table and no function — a stub that
returned "CN2" for `59.43.x.x` would be a guess wearing the clothes of a
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
  keeps the same display-serif / body-sans split Latin text gets instead of
  falling into a browser default.
- **Script-aware tracking and measures.** DESIGN.md's negative display tracking
  is a Latin device that makes full-width Han characters collide, and its `ch`
  measures are roughly half as wide in Chinese as intended. Both are adjusted
  under `:lang(zh)` only.
