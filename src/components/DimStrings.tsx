import { useMemo } from "react";
import { interpolate, staticFile } from "remotion";

import type { WorldObjectComponent } from "./primitives";
import { InlineSvgLayer, useInlineSvg } from "./svg";

/**
 * The dimension strings, drawing themselves onto the sheet.
 *
 * This is the beat where the film earns "dimensioned to the millimetre", and
 * the numbers are the smallest thing it asks anyone to read — 252 units of a
 * 16,149-unit viewBox, which comes out at roughly 25 world units on the sheet
 * and 14 screen pixels on the 1920-wide master at station `drawing`'s framing.
 * That is legible, and only just; it is the reason the sheet's margin is 40
 * world units and not 200, and it is why the strings finish arriving late in
 * the station, at the top of the push-in rather than the bottom of it.
 *
 * ── Why this is a separate world object from `PlanSheet` ───────────────────
 *
 * `world.ts` gives `dimStrings` the SAME rect as `planSheet` and lists it
 * immediately after — same box, drawn on top. Both components therefore fit
 * the same viewBox into the same box with the same margin, so the two halves
 * of one drawing land in perfect register without either of them knowing a
 * transform. `PlanSheet` holds `A-ANNO-DIMS` at `display: none` for exactly
 * the same reason: the layer is drawn once, here, and never twice.
 *
 * ── 276 lines and 56 numerals, on two clocks ──────────────────────────────
 *
 * The lines go first and the numerals follow. The parser normalised every
 * un-dashed stroke to `pathLength="1"`, so a 302-unit witness tick and a
 * 12,400-unit baseline draw on at the same rate — without it the ticks all
 * pop inside the first two per cent and only the long runs appear to animate.
 * The numerals then fade up in eight interleaved bands rather than together,
 * because 56 numbers appearing on one frame reads as a switch being thrown.
 */

/** The same file `PlanSheet` inlines. The loader caches the parse. */
const PLAN = "plans/plan-family-house-annotated.svg";

/** Must match `PlanSheet`'s, or the two halves of the drawing lose register. */
const SHEET_PAD = 40;

const LAYER = "A-ANNO-DIMS";

/** Frames, relative to the sheet's station settling. Lines, then numerals. */
const LINES = { at: 6, len: 168 } as const;
const NUMERALS = { at: 74, len: 96 } as const;
/** How many interleaved bands the numerals arrive in. */
const BANDS = 8;
/** Frames between one band and the next. */
const BAND_STEP = 7;

export const DimStrings: WorldObjectComponent = ({ width, height, localFrame }) => {
  const doc = useInlineSvg(staticFile(PLAN));

  const css = useMemo(() => {
    if (!doc || !doc.layers.includes(LAYER)) return "";

    const lines = interpolate(localFrame, [LINES.at, LINES.at + LINES.len], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    const rules = [
      // Everything that is not the dimension layer belongs to `planSheet`.
      `[data-layer] { display: none; }`,
      `[data-layer="${LAYER}"] { display: block; opacity: 1; }`,
      `[data-layer="${LAYER}"] line { stroke-dasharray: 1; stroke-dashoffset: ${(1 - lines).toFixed(4)}; }`,
      // The numerals are typeset, not stroked, so they cannot be drawn on.
      // They are also the payload: the lines are scaffolding for these.
      `[data-layer="${LAYER}"] text { opacity: 0; }`,
    ];

    for (let band = 0; band < BANDS; band += 1) {
      const at = NUMERALS.at + band * BAND_STEP;
      const p = interpolate(localFrame, [at, at + NUMERALS.len], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      rules.push(
        `[data-layer="${LAYER}"] text:nth-of-type(${BANDS}n + ${band + 1}) { opacity: ${p.toFixed(4)}; }`
      );
    }

    return rules.join("\n");
  }, [doc, localFrame]);

  if (!doc) return null;

  return (
    <div style={{ position: "relative", width, height }}>
      <div
        style={{
          position: "absolute",
          inset: SHEET_PAD,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <InlineSvgLayer
          doc={doc}
          width={width - SHEET_PAD * 2}
          height={height - SHEET_PAD * 2}
          scope="dimStrings"
          css={css}
        />
      </div>
    </div>
  );
};
