import { useMemo } from "react";
import { interpolate, staticFile } from "remotion";

import { RADIUS, STROKE } from "../tokens";
import type { WorldObjectComponent } from "./primitives";
import { InlineSvgLayer, useInlineSvg } from "./svg";

/**
 * The film's centrepiece: the showcase drawing, on its own sheet, building
 * itself out of its CAD layers.
 *
 * ── Which file, and why the annotated one ──────────────────────────────────
 *
 * Three copies of this drawing are staged. `plan-family-house.svg` and
 * `plan-family-house-annotated.svg` are byte-for-byte the same geometry — 489
 * elements each, same nine rooms, same 121.5 m² — and differ only in that the
 * annotated one carries `data-arch-id` and `data-arch-kind` on all 143 of its
 * addressable pieces. Those attributes ARE the stagger, so this is the file
 * the film animates. `verify-numbers.mjs` records all three as one drawing, so
 * either satisfies law 2; only one of them can be choreographed.
 *
 * ── The layers arrive during `pair`, not during `drawing` ──────────────────
 *
 * The sheet's own station is `drawing`, which is why `localFrame` is zero at
 * the moment the camera settles on it. But the drawing has to EXIST one beat
 * earlier: at `pair` the camera pulls back to reveal it beside the rendering
 * while the voiceover says "It came out of the drawing underneath", and a
 * blank sheet under that line would be a lie about the order things happen in.
 *
 * So the body layers run at NEGATIVE local frames — the schedule below starts
 * at -360, which is the first frame of `pair`, while the sheet is still off
 * the edge of the frame and the camera has not begun to travel. The drawing is
 * complete, and the sheet's own marks (north arrow, scale bar, title block)
 * have landed, by the time `drawing` starts. What `drawing` then gets is the
 * push-in and the dimension strings, which are `DimStrings`' job and not this
 * component's — this one holds `A-ANNO-DIMS` hidden throughout.
 *
 * ── Arrival order is the drawing's own draw order ──────────────────────────
 *
 * FLOR → FURN → WALL → DOOR → GLAZ → ANNO-TEXT, then the anonymous sheet
 * groups. That is the order the file paints in, so a layer never arrives on
 * top of something it should be underneath. Furniture before walls looks
 * wrong described in words and correct on screen: the walls' poché paints over
 * the furniture's edges, which is how the drawing was authored.
 */

/** The drawing this sheet is. Its two siblings are the same geometry. */
const PLAN = "plans/plan-family-house-annotated.svg";

/**
 * How much of the sheet is margin, in world units.
 *
 * Small on purpose. The drawing is nearly square (viewBox 17539 x 16149, 1.09)
 * and the sheet is A-series (2400 x 1700, 1.41), so the fit is bound by HEIGHT
 * and every world unit given away here is taken straight off the size of the
 * dimension numerals — which are 252 units of a 16149-unit viewBox, and are
 * the smallest thing the film asks anyone to read.
 */
const SHEET_PAD = 40;

/**
 * How a layer arrives, in frames relative to the sheet's own station settling.
 *
 * `fade` is opacity. `wipe` is a clip that travels down the layer, for the
 * fill-based poché. `draw` runs `stroke-dashoffset` back to zero so a stroke
 * writes itself on, while filled shapes inside it fade — a door leaf is a
 * white polygon with a stroked edge and needs both.
 */
type Arrival = "fade" | "wipe" | "draw";
type Cue = { layer: string; at: number; len: number; how: Arrival };

const SCHEDULE: readonly Cue[] = [
  { layer: "A-FLOR", at: -320, len: 60, how: "fade" },
  { layer: "A-FURN", at: -296, len: 70, how: "fade" },
  { layer: "A-WALL", at: -272, len: 74, how: "wipe" },
  { layer: "A-DOOR", at: -240, len: 66, how: "draw" },
  { layer: "A-GLAZ", at: -218, len: 66, how: "draw" },
  { layer: "A-ANNO-TEXT", at: -140, len: 60, how: "fade" },
];

/** The anonymous groups — north arrow, scale bar, title block — land last. */
const SHEET_MARKS = { at: -86, len: 54 } as const;

/** The layer `DimStrings` owns. This component never shows it. */
export const DIM_LAYER = "A-ANNO-DIMS";

/** 0..1 across a cue, clamped at both ends. */
export const cueProgress = (localFrame: number, at: number, len: number): number =>
  interpolate(localFrame, [at, at + len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/**
 * The CSS for one arriving layer.
 *
 * `:not([stroke-dasharray])` is load-bearing and not defensive: the drawing
 * already dashes its own door swings and openings (`stroke-dasharray="80.64
 * 60.48"`), and a CSS `stroke-dasharray` beats a presentation attribute — so
 * a blanket draw-on rule would quietly turn every dashed swing solid and
 * redraw the product's output. Elements that carry their own dash pattern fade
 * instead.
 */
export const arrivalCss = (layer: string, p: number, how: Arrival): string => {
  if (how === "fade") return `[data-layer="${layer}"] { opacity: ${p}; }`;
  if (how === "wipe") {
    return `[data-layer="${layer}"] { opacity: ${p > 0 ? 1 : 0}; clip-path: inset(0 0 ${((1 - p) * 100).toFixed(3)}% 0); }`;
  }
  return [
    `[data-layer="${layer}"] { opacity: ${p > 0 ? 1 : 0}; }`,
    // The parser normalised every un-dashed stroke to `pathLength="1"`, so one
    // offset draws every element on at the same rate whatever its length.
    `[data-layer="${layer}"] *:not([stroke-dasharray]) { stroke-dasharray: 1; stroke-dashoffset: ${(1 - p).toFixed(4)}; }`,
    `[data-layer="${layer}"] [stroke-dasharray] { opacity: ${p}; }`,
    `[data-layer="${layer}"] * { fill-opacity: ${p}; }`,
  ].join("\n");
};

export const PlanSheet: WorldObjectComponent = ({ width, height, localFrame, palette }) => {
  const doc = useInlineSvg(staticFile(PLAN));

  const paperIn = interpolate(localFrame, [-360, -318], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const css = useMemo(() => {
    if (!doc) return "";
    const rules = SCHEDULE.filter((c) => doc.layers.includes(c.layer)).map((c) =>
      arrivalCss(c.layer, cueProgress(localFrame, c.at, c.len), c.how)
    );

    // Anonymous groups: the north arrow, the scale bar and the title block.
    // They are the sheet's own marks rather than the building's, so they
    // arrive together, last, once the drawing is finished.
    const marks = cueProgress(localFrame, SHEET_MARKS.at, SHEET_MARKS.len);
    for (const layer of doc.layers) {
      if (layer.startsWith("A-")) continue;
      rules.push(`[data-layer="${layer}"] { opacity: ${marks}; }`);
    }

    // `dimStrings` is a separate world object drawn on top of this one at the
    // same rect. Hiding the layer here rather than deleting it keeps the two
    // components reading the same file.
    rules.push(`[data-layer="${DIM_LAYER}"] { display: none; }`);
    return rules.join("\n");
  }, [doc, localFrame]);

  return (
    <div style={{ position: "relative", width, height }}>
      {/* The paper. Its colour is the DRAWING's own background fill, lifted
          out of the file by the parser — not a colour this film chose, which
          is the only honest way to paint a ground for someone else's artwork.
          The hairline is ours, and is what separates a white sheet from a
          graphite ground at the wide end of the film. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: doc?.paper ?? palette.card,
          border: `${STROKE.hair}px solid ${palette.line}`,
          borderRadius: RADIUS.card,
          opacity: paperIn,
          transform: `translateY(${(1 - paperIn) * 26}px)`,
        }}
      />
      {doc ? (
        <div
          style={{
            position: "absolute",
            inset: SHEET_PAD,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: paperIn,
          }}
        >
          <InlineSvgLayer
            doc={doc}
            width={width - SHEET_PAD * 2}
            height={height - SHEET_PAD * 2}
            scope="planSheet"
            css={css}
          />
        </div>
      ) : null}
    </div>
  );
};
