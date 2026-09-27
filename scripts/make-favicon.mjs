#!/usr/bin/env node
/**
 * Builds the tab icon from a `lucide-react` glyph.
 *
 * ```
 * node scripts/make-favicon.mjs
 * ```
 *
 * Writes two files, both into `app/`:
 *
 * - `app/icon.svg` — the readable one. A coral tile with the mark on it, at
 *   64×64, which is what a browser picks when it wants a vector or a large
 *   raster.
 * - `app/favicon.ico` — the same drawing at 16, 32 and 48, packed into one ICO.
 *
 * Both are committed. This script exists so that the mark can be changed
 * without redrawing it, and so that the file it produces has a reason written
 * down rather than being an opaque blob in the tree — not so that it can be
 * run as part of a build. Nothing runs it automatically, and the two outputs
 * are the source of truth for everything downstream.
 *
 * ## Why the mark is rendered rather than pasted
 *
 * The whole point of taking the glyph from `lucide-react` is that this app has
 * one icon set, and copying an SVG out of it would start a second one: a path
 * string in this file would be a copy that no longer moves when the package is
 * upgraded, and nobody would know which of the two was right. So the glyph is
 * imported and rendered by the same library the rest of the app uses, and what
 * lands in the file is a *rendering* of it — reproducible by re-running this,
 * rather than a duplicate of it.
 *
 * Lucide's components are `forwardRef` objects, not functions, so they cannot
 * be called for their markup. `renderToStaticMarkup` is how you get an SVG
 * string out of one without a DOM.
 *
 * ## Why the geometry is what it is
 *
 * Lucide draws on a 24-unit grid with a 2-unit stroke, which is sized for icons
 * sitting at 16px and up *in a page*. A favicon is asked for at 16px while
 * being drawn inside a 64-unit tile, so everything here is a quarter of its
 * nominal size: a 2-unit stroke would arrive as half a pixel and a r=3 circle
 * as a one-and-a-half-pixel dot, and the two would be indistinguishable mush in
 * a tab strip.
 *
 * So the glyph is scaled up and stroked up until the numbers work at 16px:
 *
 * - Glyph box 56 of 64, nearly edge to edge. This one was measured rather than
 *   derived, and the first attempt at 44 is the reason. The ink of this glyph
 *   does not fill its own 24-unit box — the endpoint circles sit 2 units in
 *   from the vertical edges — so a 44-unit box spends 31% of the width on
 *   margin and another quarter of what remains on the glyph's own slack,
 *   leaving the drawn weight at about half the tile. At that size the three
 *   horizontal runs of the curve land roughly 1.4px apart, which is under the
 *   width at which antialiased strokes stay separate: they merged into one
 *   white mass and both endpoint circles filled in. At 56 the ink is about two
 *   thirds of the tile and the runs separate. Not higher, because at 60 the
 *   mark's extremes reach the tile's corner radius and the rounding starts to
 *   clip them.
 * - Stroke 2.6, which is 2.6 × (56/24) ÷ 4 ≈ 1.5px at 16px. Heavier than
 *   lucide's 2, because a stroke that reads as fine at 16px in a page reads as
 *   absent in a tab; lighter than 3, because the arcs in this glyph have a
 *   3.5-unit bend radius and a stroke approaching that closes them into a blob.
 *
 * The arithmetic above tells you which way to move a number, not where to stop
 * — the 16px raster is the only thing that settles it. If the glyph is ever
 * swapped, re-run this and look at `app/favicon.ico` in a tab at 100%. A mark
 * that has to be studied is a mark that has failed at the one size it is almost
 * always seen at.
 *
 * ## Why the colours are the system's
 *
 * `--primary` coral under `--color-on-primary` white is DESIGN.md's
 * `button-primary` — a documented treatment of the palette, not a new pairing
 * invented for the tab. It is also the one pairing here that stays legible in
 * both a light and a dark browser chrome, which a cream-on-cream mark would
 * not. The values are repeated as literals because this script runs outside the
 * stylesheet's cascade and cannot read a CSS custom property; they are the two
 * lines in `app/globals.css` to keep in step with it.
 *
 * The mark itself is deliberately not DESIGN.md's spike glyph. That is a logo
 * asset, and a favicon built from it would be the one place this project copied
 * a brand mark into its own output. A glyph from the icon set the app already
 * uses says the same thing — this is the route tool — in the system's own
 * vocabulary.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Route } from "lucide-react";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "app", "icon.svg");
const TARGET = join(ROOT, "app", "favicon.ico");

/** The glyph. `Route` is the mark the header already uses for this tool. */
const MARK_COMPONENT = Route;

/** The tile, in its own units. 64 divides evenly by every size written below. */
const TILE = 64;
const TILE_RADIUS = 14;
const GLYPH_BOX = 56;
const STROKE = 2.6;

/** `--primary` and `--color-on-primary` from `app/globals.css`. */
const TILE_COLOR = "#cc785c";
const MARK_COLOR = "#ffffff";

/**
 * The sizes packed into the ICO, smallest first.
 *
 * Browsers pick from these rather than rescaling one: 16 is the tab strip, 32
 * the taskbar and the bookmark bar at 2×, 48 the desktop shortcut. All three
 * come out of the same SVG, so they cannot drift apart.
 */
const SIZES = [16, 32, 48];

/**
 * The glyph as a string, without the box lucide wraps it in.
 *
 * The rendered `<svg>` carries the `width`/`height`/`viewBox` and the
 * `stroke="currentColor"` its children inherit. None of those is wanted here —
 * this file draws its own box at its own scale in a fixed colour — so the
 * wrapper is dropped and only the shapes are kept. They are bare `<circle>` and
 * `<path>` elements, which is why the group below has to restate the
 * presentation attributes the wrapper was carrying.
 */
function glyphShapes() {
  const rendered = renderToStaticMarkup(
    createElement(MARK_COMPONENT, { size: 24, strokeWidth: STROKE }),
  );

  return rendered.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>$/, "");
}

function composeSvg() {
  const scale = GLYPH_BOX / 24;
  const offset = (TILE - GLYPH_BOX) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}" width="${TILE}" height="${TILE}">
  <rect width="${TILE}" height="${TILE}" rx="${TILE_RADIUS}" fill="${TILE_COLOR}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${MARK_COLOR}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${glyphShapes()}</g>
</svg>
`;
}

/**
 * One raster, via `sips`.
 *
 * There is no image library in this project's dependencies and no SVG
 * rasteriser on a stock macOS other than this one, which is why the one tool
 * that is always present is the one used. `sips` rasterises at the SVG's
 * intrinsic 64 and resamples down, so the small sizes are antialiased from a
 * larger drawing rather than drawn at their own size by a renderer with no
 * hinting.
 */
function rasterize(size) {
  const scratch = mkdtempSync(join(tmpdir(), "favicon-"));
  const out = join(scratch, `${size}.png`);

  try {
    execFileSync(
      "sips",
      [
        "-s", "format", "png",
        "--resampleHeightWidth", String(size), String(size),
        SOURCE,
        "--out", out,
      ],
      { stdio: "ignore" },
    );

    return readFileSync(out);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * The PNGs, in an ICO container.
 *
 * An ICO is a directory followed by the images it names: a 6-byte header, one
 * 16-byte entry per image, then the payloads. Each payload here is a whole PNG
 * — the format allows that, and every browser that has been asked for a favicon
 * in the last twenty years reads it — which is what lets the same bytes that
 * `sips` produced be embedded without a second encoder.
 *
 * A dimension of 256 is written as 0, because the field is one byte. None of
 * the sizes below is 256, so the branch is only here to keep the write honest
 * if one is added.
 */
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon, 2 = cursor
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  const payloads = [];
  let offset = 6 + 16 * images.length;

  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    const dimension = size >= 256 ? 0 : size;

    entry.writeUInt8(dimension, 0); // width
    entry.writeUInt8(dimension, 1); // height
    entry.writeUInt8(0, 2); // palette size, 0 for truecolour
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);

    entries.push(entry);
    payloads.push(data);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...payloads]);
}

writeFileSync(SOURCE, composeSvg());

const images = SIZES.map((size) => ({ size, data: rasterize(size) }));
writeFileSync(TARGET, packIco(images));

console.log(`wrote ${SOURCE}`);
console.log(
  `wrote ${TARGET} — ${SIZES.join("/")} — ${images.reduce((n, { data }) => n + data.length, 0)} bytes of PNG`,
);
