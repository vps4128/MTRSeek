/**
 * Static sample data for the homepage.
 *
 * Nothing here is fetched. There are no API routes, no GeoIP / BGP / ASN
 * lookups, so the homepage renders these values directly.
 *
 * ## What is translatable and what is not
 *
 * Addresses, RTTs, loss figures, hop counts and the trace output itself are
 * network facts: the same strings in every language. None of it goes through
 * the translation catalogs — it lives here as a literal, and the whole of the
 * hero's code window reads identically in both locales.
 *
 * The values are measurements only. RouteLens never states a ranking or a
 * quality judgement.
 */

/**
 * Real-shaped `mtr --report-wide` output, loaded by the "Load Example" action.
 *
 * This one is not decoration: pressing the button puts this text in the
 * textarea, and the real parser reads it exactly as it would read a paste. It
 * is therefore genuinely printed with MTR's column widths, so the example
 * exercises the header-driven path rather than a lenient fallback.
 */
export const EXAMPLE_MTR_OUTPUT = `Start: 2026-09-26T21:04:11+0800
HOST: macbook                                    Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- _gateway                                  0.0%    10    0.9   1.1   0.7   1.6   0.3
  2.|-- 100.64.0.1                                0.0%    10    4.2   4.4   3.1   6.8   1.0
  3.|-- 59.43.80.1                                0.0%    10   12.8  13.4  11.9  15.6   1.2
  4.|-- 59.43.96.1                                0.0%    10   14.1  14.6  13.2  16.9   1.1
  5.|-- 202.97.12.9                               0.0%    10   30.7  31.5  29.8  34.2   1.4
  6.|-- 203.0.113.7                              10.0%    10   38.9  39.6  37.4  44.1   2.0
  7.|-- 198.51.100.24                             0.0%    10   39.2  39.9  38.1  43.0   1.6
  8.|-- 192.0.2.61                                0.0%    10   39.4  40.1  38.6  42.7   1.5
  9.|-- example.com                               0.0%    10   39.6  40.3  38.8  42.9   1.5
`;

/**
 * Hop table rendered inside the hero's `code-window-card`.
 *
 * The hero carries a deliberately small window onto a route. It is its own
 * fixed illustration, not a rendering of `EXAMPLE_MTR_OUTPUT` and not a view of
 * anything the reader pasted: the preview says what RouteLens reads, and the
 * analysis page is where an actual trace is shown. Its first hop is the
 * gateway's address where the example prints the gateway's name, since a
 * five-line window has no room for the hostname column.
 */
export const HERO_HOPS = [
  { ttl: 1, host: "192.168.1.1", loss: "0.0%", avg: "1.4 ms" },
  { ttl: 2, host: "100.64.0.1", loss: "0.0%", avg: "4.4 ms" },
  { ttl: 3, host: "59.43.80.1", loss: "0.0%", avg: "13.4 ms" },
  { ttl: 4, host: "59.43.96.1", loss: "0.0%", avg: "14.6 ms" },
  { ttl: 5, host: "202.97.12.9", loss: "0.0%", avg: "31.5 ms" },
];

/**
 * Status-bar readout under the hero hop table. Every hop in the window is
 * lossless, so loss is stated once for the window rather than as a per-hop
 * column — which is what keeps the hero down to its handful of lines.
 *
 * This is terminal output, so it stays in its original form in both locales,
 * like the `$ mtr -rw` prompt above it. A translated status bar under an
 * English command line would be the odd one out.
 */
export const HERO_SUMMARY = {
  hops: `${HERO_HOPS.length} hops`,
  loss: "0% loss",
} as const;

/** Target string shown in the hero code window's prompt. */
export const MOCK_TARGET = "example.com";
