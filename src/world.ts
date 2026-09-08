/**
 * The world: one infinite canvas, laid out once, in arbitrary world units.
 *
 * React-free and Remotion-free — `capture/lib/load-core.mjs` bundles this with
 * esbuild and runs it in Node, so the gates measure the real geometry.
 *
 * ── The gauge ──────────────────────────────────────────────────────────────
 *
 * One world unit is one screen pixel at camera scale 1.0. The gauge is set by
 * the hero rendering: it is placed at its own native pixel size (1536 x 1024),
 * so "scale 1.0" means "the rendering at 1:1". That makes every raster upscale
 * number in this file readable at a glance instead of needing a conversion.
 *
 * ── The geography ──────────────────────────────────────────────────────────
 *
 * The film pulls away from the origin, so the world is laid out radially:
 * later beats live further out, and nothing ever appears from nowhere. Every
 * object below exists at every frame of the film; the camera simply has not
 * arrived yet.
 *
 *   y ~=     0   the SHOWCASE cluster — render-family-house-interior beside
 *                plan-family-house, its own drawing. What the product makes.
 *                Directly underneath the rendering, at the origin, the
 *                sentence that produced all of it.
 *   y ~=  2400   the review pin — the near edge of the session cluster
 *   y ~=  4300   the SESSION cluster — the real filmed run: plan-hero and the
 *                product recordings. How you work with it.
 *   y ~= 12600   the plan wall — 60 rasters, the furthest-out beat
 *
 * ── Two clusters, and why the pin is not on the showcase drawing ───────────
 *
 * The review pin is the product's own sentence, read off c06-review-pins.mp4
 * at t=20.0s: "PROGRAM — The 110m2 plan provides no bathroom, laundry, or
 * dedicated storage." That is true of the session's own 4-room, 108.00 m2 plan
 * and FALSE of plan-family-house (which has a Bath and a Laundry) and of
 * plan-hero (which has a Bathroom). Hanging it on the showcase drawing would
 * print a visible falsehood at the exact moment the voiceover makes the film's
 * honesty claim, so the pin lives in the session cluster with the drawing it
 * was actually written about.
 *
 * The move pays for itself. `note` becomes the near edge of the session
 * cluster rather than a detour on the showcase sheet, so stations
 * facts -> note -> lineage -> wall are one continuous outward move with no
 * turn in it. And `LINEAGE.fixedDrawing` puts plan-hero — the same session
 * later, with the Bathroom and the Hall the c06 state lacks — directly BELOW
 * the pin, so the pull-back reveals the named defect fixed. No copy points at
 * it, and none should.
 *
 * The sentence sits AT the origin, underneath the rendering, from frame 0.
 * That is the whole trick of station 7: the camera does not cut back to a
 * title card, it flies home and finds the brief that was there the entire
 * time. The rendering fades out during `wall`, when the origin is thousands of
 * units off-frame and nobody can see the fade happen.
 *
 * The push-in at station 7 travels UP through the wall, so the tiles rush past
 * the camera on the way home. That is deliberate, and it is why the wall is
 * directly below the origin rather than off to one side.
 */

import ledger from "./data/assets.json";

/**
 * Things the world could not derive and had to assume.
 *
 * `timeline.ts` folds these into its own `warnings`, so a wall the ledger
 * could not describe fails `verify-timeline --strict` exactly like a missing
 * voice take. Nothing here is ever silently defaulted.
 */
const worldWarningList: string[] = [];
export const worldWarnings: readonly string[] = worldWarningList;

/* ── rects ────────────────────────────────────────────────────────────────── */

/**
 * A world rectangle, CENTRE-based.
 *
 * Centre-based rather than top-left because everything this film does to a
 * rect is done about its centre: fitting it to a viewport, drifting it,
 * zooming it. `chan-meng-promo-video`'s Rect is top-left; this one is not. Do
 * not copy arithmetic between the two.
 */
export type WorldRect = { cx: number; cy: number; w: number; h: number };

export const rect = (cx: number, cy: number, w: number, h: number): WorldRect => ({
  cx,
  cy,
  w,
  h,
});

export const leftOf = (r: WorldRect) => r.cx - r.w / 2;
export const rightOf = (r: WorldRect) => r.cx + r.w / 2;
export const topOf = (r: WorldRect) => r.cy - r.h / 2;
export const bottomOf = (r: WorldRect) => r.cy + r.h / 2;

/** Grow a rect by a margin on every side. */
export const padRect = (r: WorldRect, px: number, py = px): WorldRect =>
  rect(r.cx, r.cy, r.w + px * 2, r.h + py * 2);

export const unionRect = (a: WorldRect, b: WorldRect): WorldRect => {
  const l = Math.min(leftOf(a), leftOf(b));
  const r = Math.max(rightOf(a), rightOf(b));
  const t = Math.min(topOf(a), topOf(b));
  const bo = Math.max(bottomOf(a), bottomOf(b));
  return rect((l + r) / 2, (t + bo) / 2, r - l, bo - t);
};

export const rectsOverlap = (a: WorldRect, b: WorldRect): boolean =>
  leftOf(a) < rightOf(b) &&
  rightOf(a) > leftOf(b) &&
  topOf(a) < bottomOf(b) &&
  bottomOf(a) > topOf(b);

/* ── the raster bound ─────────────────────────────────────────────────────── */

/**
 * The hard ceiling on how far a raster may be blown up.
 *
 * 1.5x is where a photoreal rendering starts to look resampled rather than
 * photographed on a 1080-short-edge delivery. It is not a taste call a
 * component gets to argue with: the camera framing for `interior` is DERIVED
 * from this bound (see `heroFullBleed` in `layout-core.ts`), and
 * `verify-timeline.mjs` walks every keyframe in every format and fails if a
 * registered raster crosses it.
 */
export const MAX_RASTER_UPSCALE = 1.5;

/**
 * How wide an object may be on screen while its opacity is changing.
 *
 * Two objects have to fade — the rendering has to leave the origin so the
 * sentence underneath it can be found, and the wordmark has to arrive. Every
 * other object in this world is present from frame 0 to frame last, because a
 * film whose whole idea is one continuous move should not be dissolving things
 * in and out behind your back.
 *
 * The tall formats are what make this a number rather than a principle. At
 * 1080x1920 the widest shot holds the ENTIRE world above the wall, so "it
 * happens off-frame" is a 16:9-only argument and checking it that way passes a
 * gate on the master while the vertical cut dissolves in plain sight. So the
 * test is size instead of visibility: 160px is 8% of the 1920 master's width
 * and 15% of the 1080 cut's, which is a thumbnail during a pull-back that is
 * still accelerating outward. `verify-timeline.mjs` walks every frame of every
 * fade window in every format against it.
 */
export const FADE_INVISIBLE_PX = 160;

/**
 * Native pixel sizes. Measured, not guessed.
 *
 * These are the numbers the asset ledger reports.`verify-timeline.mjs`
 * cross-checks them against `src/data/assets.json` once that file exists, so a
 * re-export at a different size cannot silently loosen the bound above.
 */
export const NATIVE_RASTER = {
  /** Every rendering in the film. `maxUpscale.perRaster`, role "render". */
  rendering: { w: 1536, h: 1024 },
  /**
   * The 60 plan rasters on the wall. UNIFORM WIDTH, RAGGED HEIGHT — the
   * ledger's `wall.sizeClasses` runs 1086 to 2172 tall on the same 1536 width,
   * because a taller plan is a taller drawing. Only the width matters to the
   * upscale bound, and it is why the wall is laid out on fixed COLUMNS rather
   * than on a grid of equal cells.
   */
  wallTile: { w: 1536, h: 1086 },
  /**
   * The product screen recordings — the ledger's role "clip". Wider than a
   * rendering, which is the sort of thing a hand-written "the biggest asset is
   * 1536px" comment gets wrong.
   *
   * This is the NARROWEST staged clip, not the widest, and that is the whole
   * point of the number: the bound has to hold for whichever clip a component
   * actually reaches for, so it is computed against the one that runs out of
   * pixels first. The ledger stages two families (1786x944 and 1828x1016) and
   * `verify-timeline.mjs` reconciles this against the minimum per role.
   */
  screenCapture: { w: 1786, h: 944 },
  /** The captured review-note card — the ledger's role "still". */
  pinCard: { w: 1828, h: 1016 },
} as const;

export type RasterKind = keyof typeof NATIVE_RASTER;

/** How far a raster of `nativeW` pixels is blown up shown `worldW` wide at `scale`. */
export const rasterUpscale = (worldW: number, scale: number, nativeW: number): number =>
  (worldW * scale) / nativeW;

/**
 * Returns a one-line complaint, or null if the raster is within budget.
 *
 * Returns rather than throws: the gate collects every violation across four
 * formats and nine stations and prints them together. A throw would report the
 * first one and hide the other eight.
 */
export const assertRasterScale = (
  label: string,
  worldW: number,
  scale: number,
  kind: RasterKind
): string | null => {
  const nativeW = NATIVE_RASTER[kind].w;
  const up = rasterUpscale(worldW, scale, nativeW);
  if (up <= MAX_RASTER_UPSCALE + 1e-6) return null;
  return `${label}: ${kind} shown ${(worldW * scale).toFixed(0)}px wide from ${nativeW}px native = ${up.toFixed(3)}x upscale (max ${MAX_RASTER_UPSCALE})`;
};

/* ── the objects ──────────────────────────────────────────────────────────── */

export type WorldObjectId =
  | "briefLine"
  | "renderCard"
  | "planSheet"
  | "dimStrings"
  | "reviewPin"
  | "lineageTrail"
  | "planWall"
  | "endCard"
  | "cardInterior"
  | "cardPair"
  | "cardDrawing"
  | "cardFacts"
  | "cardLineage";

/**
 * The 60-plan wall: fixed columns, ragged tiles, packed from the ledger.
 *
 * The tiles share a width (1536 native, `wall.uniformWidth: true`) and nothing
 * else — `wall.heightRange` is [1086, 2172] across six size classes, because a
 * taller plan is a taller drawing. So this is MASONRY ON A FIXED COLUMN WIDTH,
 * never a fixed tile height: a uniform grid would have to letterbox or crop
 * most of the set, and cropping a plan raster is precisely what law 2 exists
 * to prevent.
 *
 * Only the column count and the gutters are chosen here. Everything else —
 * every tile's size and position, and the grid's own height — is computed from
 * `src/data/assets.json` at module scope, so a re-sync of the eval library
 * moves the camera framing with it instead of leaving the widest shot with two
 * empty columns.
 */
export const WALL = {
  /**
   * Ten columns. Packs to a 1.77 aspect, which is 16:9 to two decimals — the
   * landscape master frames it with almost nothing wasted, and it stays square
   * enough not to shrink to a letterbox in the 9:16 cut. Eleven columns reads
   * 1.95 and suits only landscape; eight reads 1.11 and suits only vertical.
   */
  cols: 10,
  colW: 1600,
  gap: 200,
} as const;

export type WallTile = {
  /** File name under `public/wall/`. */
  name: string;
  col: number;
  /** World coordinates, top-left, relative to the grid's top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Longest-processing-time packing: assign the tallest tile to the shortest
 * column, repeatedly.
 *
 * Plain greedy in ledger order leaves a 2,263-unit ragged bottom, because the
 * seventeen 2172-tall tiles come first and the short ones cannot level it
 * afterwards. LPT gets it to 1,045 across a 10,050-tall grid — a 10% ragged
 * edge, which reads as masonry rather than as a mistake — and lands exactly
 * six tiles in every column. Ties break on ledger index, so the pack is
 * deterministic and a re-run cannot reshuffle the wall.
 *
 * Tiles keep their LEDGER order within a column; only the assignment is
 * sorted. `PlanWall` renders this array and computes nothing of its own.
 */
const packWall = (): { tiles: WallTile[]; gridW: number; gridH: number } => {
  const group = ledger.wall;
  const files = (group?.files ?? []) as { name: string; width: number; height: number }[];
  const nativeW = group?.width ?? 0;
  const gridW = WALL.cols * WALL.colW + (WALL.cols - 1) * WALL.gap;

  if (files.length === 0 || !nativeW) {
    worldWarningList.push(
      "src/data/assets.json has no wall group with a uniform width — the plan wall cannot be packed and the `wall` station is framed on an empty grid. Run `npm run sync:assets`."
    );
    return { tiles: [], gridW, gridH: gridW / 1.77 };
  }
  if (group.uniformWidth !== true) {
    worldWarningList.push(
      `src/data/assets.json says the wall tiles are NOT uniform width (${JSON.stringify(group.heightRange)}) — the column layout assumes they are, so tiles will be scaled inconsistently.`
    );
  }

  const scale = WALL.colW / nativeW;
  const colBottom = new Array<number>(WALL.cols).fill(0);
  const colOf = new Array<number>(files.length).fill(0);

  const byHeight = files
    .map((t, i) => ({ i, h: t.height * scale }))
    .sort((a, b) => b.h - a.h || a.i - b.i);

  for (const t of byHeight) {
    let c = 0;
    for (let i = 1; i < WALL.cols; i += 1) if (colBottom[i] < colBottom[c]) c = i;
    colOf[t.i] = c;
    colBottom[c] += t.h + WALL.gap;
  }

  const cursor = new Array<number>(WALL.cols).fill(0);
  const tiles: WallTile[] = files.map((t, i) => {
    const col = colOf[i];
    const h = t.height * scale;
    const tile: WallTile = {
      name: t.name,
      col,
      x: col * (WALL.colW + WALL.gap),
      y: cursor[col],
      w: WALL.colW,
      h,
    };
    cursor[col] += h + WALL.gap;
    return tile;
  });

  return { tiles, gridW, gridH: Math.max(...cursor) - WALL.gap };
};

const packed = packWall();

/** Every wall tile, positioned. `PlanWall` renders this and nothing else. */
export const WALL_TILES: readonly WallTile[] = packed.tiles;
export const WALL_GRID_W = packed.gridW;
export const WALL_GRID_H = packed.gridH;

/**
 * The session cluster's body: the real filmed run, as world-space cards.
 *
 * Eight recordings are staged (c05, c06, c07, c08, c10, c11, c13, c15) — all
 * 1786 x 944, exactly 30/1 fps, and **none of them carries an audio stream**,
 * so nothing here can leak sound into the mix. c09 was never staged; do not
 * reference it. c06 belongs to the pin above, not to the trail.
 *
 * Card sizes live here rather than inside `LineageTrail` because the camera's
 * upscale bound has to know how wide one recording is displayed — the clips
 * are the widest rasters in the film.
 */
export const LINEAGE = {
  /** One product screen recording. 1786:944 native, kept exact. */
  captureW: 1500,
  captureH: 793,
  /** One earlier version of the session's drawing. SVG — no resolution ceiling. */
  versionW: 1100,
  versionH: 780,
  gap: 120,
  /**
   * plan-hero.svg's slot, in coordinates local to the trail's own box.
   *
   * This is the payoff of the two-cluster layout and it is the one thing about
   * the trail's interior that is NOT the component's to choose: plan-hero is
   * the same session later — same title block, "North-Facing Family Home", and
   * it has the Bathroom and the Hall the c06 state lacks — so it sits directly
   * BELOW the review pin. As the camera pulls back off the pin, the fixed
   * drawing enters frame under the sentence naming the defect. It lands for
   * the people who look, which is the right amount.
   *
   * Order the rest of the trail around it however reads best.
   */
  fixedDrawing: { x: 1650, y: 230, w: 1100, h: 780 },

  /**
   * Earlier states of the same drawing, stacked behind the one that survived.
   *
   * Offset up and to the left so they read as a history rather than as a row.
   * They are drawn as empty sheets, not as real earlier plans, and that is
   * deliberate: we do not have those intermediate exports, and inventing them
   * would be mocking up the one thing the film is arguing you can trust.
   */
  ghosts: [
    { x: 1500, y: 120, w: 1100, h: 780 },
    { x: 1350, y: 10, w: 1100, h: 780 },
  ],

  /**
   * The conversation, as world-space cards.
   *
   * `startFrom` is in FRAMES at 30fps and skips each cut's 3s handle plus
   * whatever lead-in the moment needs. Every clip is silent — the ledger
   * records `hasAudioStream: false` on all of them — and 30fps, matching the
   * composition, so they play without judder or resampling.
   */
  clips: [
    { file: "lineage-instruction.mp4", startFrom: 420, x: 3120, y: 60, w: 1500, h: 793 },
    { file: "lineage-morph.mp4", startFrom: 750, x: 3120, y: 1120, w: 1500, h: 793 },
    { file: "lineage-shrink.mp4", startFrom: 210, x: 240, y: 1120, w: 1500, h: 793 },
  ],

  /** The trail's own box, so a component can convert its local coordinates. */
  w: 6000,
  h: 2600,
} as const;

/**
 * The review pin's provenance.
 *
 * `note-pin-card` in the ledger is the captured card, so `reviewPin` is
 * registered as a raster and the bound is enforced against it. If ReviewPin
 * instead typesets the sentence from `src/data/script.json`, the bound simply
 * never binds.
 *
 * Either way it is the product's own words. If a CROP is taken rather than the
 * whole card, the crop is a narrower raster than the ledger row: divide the
 * "widest on-screen width" that `verify-timeline.mjs` prints for reviewPin by
 * 1.5, and the crop must keep at least that many native pixels.
 */
export const REVIEW_PIN = {
  sourceClip: "c06-review-pins",
  sourceTimecodeSec: 20.0,
} as const;

/* ── cluster anchors ──────────────────────────────────────────────────────── */

/**
 * The two clusters, named once and then referred to.
 *
 * The station framings below are DERIVED from these rather than typed beside
 * them. That is the difference between "the pin and the fixed drawing happen
 * to both be in frame" and "they cannot not be": move the pin and the
 * `lineage` framing follows it, because the framing is the union of the two.
 */

/** Showcase cluster: what the product makes. */
const SHOWCASE_RENDER = rect(0, 0, 1536, 1024);
const SHOWCASE_SHEET = rect(2388, 0, 2400, 1700);

/**
 * Session cluster: how you work with it.
 *
 * The pin is the near edge — 1,550 units below the showcase sheet's bottom,
 * which is far enough that it stays out of frame through `pair` (whose widest
 * framing reaches y 1444) and near enough that the crossing from `facts` is a
 * 2.7k-unit move rather than a journey.
 */
// 1500 x 834 is 1.799 — the captured card's own 1828:1016 aspect, so the real
// still drops in without a letterbox or a crop.
const SESSION_PIN = rect(2100, 2400, 1500, 834);
const SESSION_TRAIL = rect(2900, 4300, 6000, 2600);

/** The lowest thing above the wall. The wall's position is derived from it. */
const SESSION_BOTTOM = bottomOf(SESSION_TRAIL);

/** Ground kept around the wall inside its framing. */
export const WALL_PAD = 400;

/**
 * How far below the session cluster the wall sits.
 *
 * Not a taste number: `contain` fitting the wall leaves letterbox margin above
 * the grid, and the session trail has to clear THAT, not just the grid. 1,400
 * units covers the margin in all four formats with room to spare — and
 * `verify-timeline.mjs` asserts the real invariant directly, by checking that
 * no other object is inside the viewport on any frame of the `wall` station in
 * any format. If a re-sync makes the wall taller, WALL_CY moves with it.
 */
export const WALL_CLEARANCE = 1400;
export const WALL_CY = SESSION_BOTTOM + WALL_CLEARANCE + WALL_GRID_H / 2 + WALL_PAD;

export type WorldObject = {
  id: WorldObjectId;
  rect: WorldRect;
  /** The station this object owns; drives the `local` progress it is handed. */
  station: string;
  /** Registered raster, for the upscale gate. null = vector, or not a raster. */
  raster: RasterKind | null;
  /**
   * The world width of ONE raster inside this object — which is the object's
   * own width for a single image, and the TILE width for the wall. The gate
   * checks upscale per raster, so handing it the 17,800-unit wall grid would
   * have flagged a violation that does not exist.
   */
  rasterWorldW: number | null;
  /** Station during which it fades to 0. Chosen so the fade happens off-frame. */
  fadeOutAt: string | null;
  /** Station during which it fades up from 0. */
  fadeInAt: string | null;
  /**
   * What this object is drawn ON, when it is text.
   *
   * A card is placed in world space, so it can land on the graphite ground at
   * one station and on a white drawing sheet at the next — while its ink comes
   * from the ground ramp, which knows nothing about what happens to be
   * underneath it. The `drawing` station proved that the hard way: ink chosen
   * correctly for a dark ground rendered white-on-white over the sheet, and the
   * line simply was not there.
   *
   * The fix is to DECLARE the backing rather than infer it. A card on the sheet
   * takes the drawing's own dark ink and no plate, so it reads as an annotation
   * written on the paper — which is what the film is pretending it is. A card
   * on the ground takes the ramp's ink. A card on a photograph takes white.
   */
  surface?: "ground" | "sheet" | "photo";
  /** Why it is where it is. */
  note: string;
};

/**
 * Painter's order: earlier entries render behind later ones.
 *
 * `briefLine` is first because it lives underneath `renderCard` at the origin
 * for the whole first act. Reorder these and station 7 stops working.
 */
const BASE_OBJECTS: readonly WorldObject[] = [
  {
    id: "briefLine",
    rect: rect(0, 0, 1500, 420),
    station: "sentence",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: null,
    fadeInAt: null,
    note: "The typed brief, at the origin, under the rendering, from frame 0. It never fades in — it is revealed when the rendering above it fades out off-frame.",
  },
  {
    id: "renderCard",
    rect: SHOWCASE_RENDER,
    station: "interior",
    raster: "rendering",
    rasterWorldW: 1536,
    // The ONLY object that has to go, and it has to go because it sits on top
    // of the sentence. `wall` is the one station where it is a thumbnail in
    // every format — see FADE_INVISIBLE_PX below, which the gate enforces.
    // RenderCard must paint opaque edge to edge: briefLine is underneath it
    // for the whole first act and a transparent card would leak the ending.
    fadeOutAt: "wall",
    fadeInAt: null,
    note: "The photoreal interior, placed at native pixel size so scale 1.0 means 1:1.",
  },
  {
    id: "planSheet",
    rect: SHOWCASE_SHEET,
    station: "drawing",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: null,
    fadeInAt: null,
    note: "Its OWN drawing: a sheet at roughly A-series proportion, beside the rendering.",
  },
  {
    id: "dimStrings",
    rect: SHOWCASE_SHEET,
    station: "drawing",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: null,
    fadeInAt: null,
    note: "Dimension strings and the CAD layer order, registered to the sheet — same rect, drawn on top.",
  },
  {
    id: "reviewPin",
    rect: SESSION_PIN,
    station: "note",
    // Registered as the captured card (ledger role "still", note-pin-card),
    // which is the conservative reading: if ReviewPin typesets the sentence
    // from script.json instead, a bound it cannot breach costs nothing.
    raster: "pinCard",
    rasterWorldW: 1500,
    fadeOutAt: null,
    fadeInAt: null,
    note: "The product's own review note, from c06 at t=20.0s. The NEAR EDGE of the session cluster, not a detour on the showcase sheet: the plan it is written about is the session's, not plan-family-house's.",
  },
  {
    id: "lineageTrail",
    rect: SESSION_TRAIL,
    station: "lineage",
    raster: "screenCapture",
    rasterWorldW: LINEAGE.captureW,
    fadeOutAt: null,
    fadeInAt: null,
    note: "The session cluster: plan-hero in the slot directly under the pin, plus the c07/c08/c10/c11 recordings. Its own rect sets where LINEAGE.fixedDrawing lands.",
  },
  {
    id: "planWall",
    rect: rect(1400, WALL_CY, WALL_GRID_W, WALL_GRID_H),
    station: "wall",
    raster: "wallTile",
    rasterWorldW: WALL.colW,
    fadeOutAt: null,
    // Faded up during `lineage`, one station before it is seen.
    //
    // It used to have no bounds at all, which meant sixty tiles were mounted on
    // EVERY frame of the film -- about 200 megapixels of decode held from frame
    // 0, thousands of world units off-frame, for a beat that starts at 52.5s.
    // A still render died on a delayRender timeout because of it. The wall must
    // exist before station 7 flies the camera up through it; it does not have
    // to exist before the camera has ever looked down.
    fadeInAt: "lineage",
    note: "60 plan rasters. Directly below the origin so station 7's push-in flies up THROUGH it.",
  },
  {
    id: "endCard",
    rect: rect(0, 820, 1500, 620),
    station: "mark",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: null,
    // Up at `wall` for the same reason the rendering goes down there: at that
    // scale it is a thumbnail in all four formats. Fading it in during
    // `sentence` instead would have it materialise a foot below the sentence
    // in the 9:16 cut, where the viewport is tall enough to hold both.
    fadeInAt: "wall",
    note: "Wordmark and terms, just below the sentence. Present from the widest shot onward, so the camera settles onto something that was already there.",
  },
];


export const worldObject = (id: WorldObjectId): WorldObject => {
  const found = WORLD_OBJECTS.find((o) => o.id === id);
  if (!found) throw new Error(`No world object "${id}"`);
  return found;
};

/* ── station framing ──────────────────────────────────────────────────────── */

export type Fit = "contain" | "cover" | "hero";

/**
 * How the camera moves WHILE it is parked on a station.
 *
 * `dStops` is in zoom stops — +1 halves the framed rect, i.e. pushes in one
 * octave. Stops rather than a multiplier because the camera interpolates on
 * log(scale), and a stop is the unit that interpolation actually speaks.
 */
export type Drift = { dx: number; dy: number; dStops: number };

export type StationFrame = {
  rect: WorldRect;
  fit: Fit;
  drift: Drift;
  note: string;
};

/** Apply a drift to a rect: translate the centre, then zoom by `dStops`. */
export const driftRect = (r: WorldRect, d: Drift): WorldRect => {
  const k = Math.pow(2, -d.dStops);
  return rect(r.cx + d.dx, r.cy + d.dy, r.w * k, r.h * k);
};

/**
 * What the camera is looking at, per station.
 *
 * Two framings are the same size on purpose, and it is a rhyme rather than a
 * coincidence: `facts` is 1472 x 800, which fits the landscape camera box
 * (1840 x 1000) at exactly scale 1.25 — the magnification `interior` opens on.
 * The film returns to its opening magnification the moment it stops looking at
 * the picture and starts looking at the drawing. Change either number and the
 * rhyme dies silently, so both are spelled out here rather than derived.
 */
export const STATION_FRAMES: Record<string, StationFrame> = {
  interior: {
    rect: rect(0, 0, 1536, 1024),
    fit: "hero",
    drift: { dx: 36, dy: -18, dStops: 0.06 },
    note: "Full-bleed in landscape only; a card everywhere else — see heroFullBleed in layout-core.ts. A very slow push, 0.06 stops across the whole station.",
  },
  pair: {
    rect: padRect(unionRect(SHOWCASE_RENDER, SHOWCASE_SHEET), 250, 160),
    fit: "contain",
    drift: { dx: 70, dy: 0, dStops: -0.03 },
    note: "The pull-back that reveals the rendering was a card, with its own drawing beside it.",
  },
  drawing: {
    rect: padRect(SHOWCASE_SHEET, 180, 50),
    fit: "contain",
    drift: { dx: 0, dy: 0, dStops: 0.1 },
    note: "Push into the sheet while the CAD layers arrive and the dimension strings draw.",
  },
  facts: {
    rect: rect(1990, -330, 1472, 800),
    fit: "contain",
    drift: { dx: 0, dy: -16, dStops: 0.05 },
    note: "One room, tight. Lands at the magnification interior opened on (1.25 in landscape).",
  },
  note: {
    rect: padRect(SESSION_PIN, 100, 125),
    fit: "contain",
    drift: { dx: 260, dy: 520, dStops: -0.16 },
    note: "The crossing. The camera leaves the showcase cluster and arrives at the near edge of the session cluster, reads the pin, and keeps going — the drift is already carrying it down onto the trail when the station ends. It never stops here. `leadInSec` on this station is a 4.0s travel and is the only thing setting the crossing's speed.",
  },
  lineage: {
    rect: padRect(unionRect(SESSION_PIN, SESSION_TRAIL), 200),
    fit: "contain",
    drift: { dx: 260, dy: 0, dStops: -0.08 },
    note: "Sized to hold the review pin AND the trail at once — that co-visibility is the beat, and verify-timeline.mjs asserts it rather than trusting these numbers.",
  },
  wall: {
    rect: rect(1400, WALL_CY, WALL_GRID_W + WALL_PAD * 2, WALL_GRID_H + WALL_PAD * 2),
    fit: "contain",
    drift: { dx: 0, dy: 120, dStops: -0.1 },
    note: "The furthest-out beat. Still drifting outward when it ends, so the film never quite settles here.",
  },
  sentence: {
    rect: rect(0, 0, 1700, 620),
    fit: "contain",
    drift: { dx: 0, dy: 0, dStops: 0.03 },
    note: "Home. The push travels ~12,400 world units up through the wall; its speed is this station's `leadInSec` and nothing else.",
  },
  mark: {
    rect: rect(0, 820, 1700, 820),
    fit: "contain",
    drift: { dx: 0, dy: 0, dStops: 0 },
    note: "The same scale as `sentence`, 820 units lower: the sentence slides off the top and the wordmark settles. Zero drift — a film that has been moving for 80 seconds should come to a full stop.",
  },
};

/* ── station cards ────────────────────────────────────────────────────────── */

/**
 * Where a line of text sits, derived from its own station's framing.
 *
 * The film's words live IN the world — they scale and parallax with everything
 * else, the way an annotation on a drawing does, rather than floating in screen
 * space like a subtitle. That is the whole reason they read as part of the
 * drawing rather than as a caption over it.
 *
 * But a world-space card is easy to lose: put it at a hand-picked coordinate
 * and it is correct until somebody nudges the framing, after which it is
 * off-frame in one aspect ratio and nobody notices until a master is cut. So a
 * card is never placed absolutely. It is placed as a FRACTION OF ITS OWN
 * STATION'S FRAME, which means it cannot leave the shot: move the framing and
 * the card moves with it.
 *
 * `inset` is a fraction of the frame's short edge, so the margin looks the same
 * whether the frame is wide or tall.
 */
const cardIn = (
  stationId: string,
  where: "topLeft" | "bottomLeft" | "bottomRight",
  widthFrac: number,
  heightFrac: number,
): WorldRect => {
  const f = STATION_FRAMES[stationId];
  if (!f) throw new Error(`cardIn: no station frame "${stationId}"`);
  const { cx, cy, w, h } = f.rect;
  // 13%, not the 7.5% it started at, because a `hero`-fit station is COVERED
  // into the viewport, not contained: `interior` is 1536x1024 shown across a
  // 1920x1080 frame, so about 8% of its height is cropped off each edge before
  // anything is drawn. At 7.5% the opening card's descenders and the product's
  // AI-generated pill both sat inside that cropped band -- the pill being a
  // provenance mark the film is required to show, which makes this a
  // correctness margin rather than a taste one.
  const inset = Math.min(w, h) * 0.13;
  const cw = w * widthFrac;
  const ch = h * heightFrac;

  const left = cx - w / 2 + inset + cw / 2;
  const right = cx + w / 2 - inset - cw / 2;
  const top = cy - h / 2 + inset + ch / 2;
  const bottom = cy + h / 2 - inset - ch / 2;

  if (where === "topLeft") return rect(left, top, cw, ch);
  if (where === "bottomRight") return rect(right, bottom, cw, ch);
  return rect(left, bottom, cw, ch);
};

/**
 * The five text cards, appended AFTER the base objects.
 *
 * Two reasons they live here rather than in the array above. They are painted
 * last, so a word is never behind a drawing. And `cardIn` reads
 * `STATION_FRAMES`, which is declared below the object list — evaluating it up
 * there threw `Cannot access 'STATION_FRAMES' before initialization` at render
 * time, not at compile time, which is exactly the kind of failure this file's
 * module-scope derivations are otherwise good at avoiding.
 */
const CARD_OBJECTS: readonly WorldObject[] = [
  {
    id: "cardInterior",
    rect: cardIn("interior", "bottomLeft", 0.62, 0.1),
    station: "interior",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: "pair",
    fadeInAt: null,
    surface: "photo",
    note: "The opening line, low in the frame over the rendering. Gone by the time the camera has pulled back far enough to show the drawing.",
  },
  {
    id: "cardPair",
    rect: cardIn("pair", "bottomLeft", 0.4, 0.14),
    station: "pair",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: "drawing",
    fadeInAt: "pair",
    surface: "ground",
    note: "The grounding claim, beneath the pair it describes.",
  },
  {
    id: "cardDrawing",
    rect: cardIn("drawing", "bottomLeft", 0.52, 0.13),
    station: "drawing",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: "facts",
    fadeInAt: "drawing",
    surface: "sheet",
    note: "Sits on the sheet's own margin while the CAD layers arrive above it.",
  },
  {
    id: "cardFacts",
    rect: cardIn("facts", "topLeft", 0.46, 0.19),
    station: "facts",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: "note",
    fadeInAt: "facts",
    surface: "sheet",
    note: "Top-left here, not bottom: the facts framing is tight on a room and the dimension strings run along its lower edge.",
  },
  {
    id: "cardLineage",
    rect: cardIn("lineage", "bottomRight", 0.34, 0.12),
    station: "lineage",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: "wall",
    fadeInAt: "lineage",
    surface: "ground",
    note: "Bottom-right, opposite the pin and the fixed drawing, so it never sits over the one thing this beat is for.",
  },
];

/** Painter's order: base objects behind, words in front. */
export const WORLD_OBJECTS: readonly WorldObject[] = [...BASE_OBJECTS, ...CARD_OBJECTS];


