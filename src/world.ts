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
 *   y ~=     0   the origin cluster — the rendering, its drawing, the pin,
 *                and, directly underneath the rendering, the sentence that
 *                produced all of it
 *   y ~=  4200   the lineage trail — earlier versions of a second drawing
 *   y ~= 12200   the plan wall — 60 rasters, the furthest-out beat
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
   * The product screen recordings on the lineage trail — the ledger's role
   * "clip", eight of them. Wider than a rendering, which is exactly the sort
   * of thing a hand-written "the biggest asset is 1536px" comment gets wrong;
   * `verify-timeline.mjs` reconciles these three against the ledger by role.
   */
  screenCapture: { w: 1786, h: 944 },
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
  | "endCard";

/**
 * The 60-plan wall: fixed columns, ragged tiles.
 *
 * The tiles share a width (1536 native) and nothing else — the ledger's
 * `wall.sizeClasses` spans 1086 to 2172 tall — so this is a masonry column
 * layout, not a grid. `PlanWall` packs the tiles into `cols` columns of
 * `colW`, balancing the column heights; these constants are what it packs
 * into, and what the camera framing below is sized from.
 */
export const WALL = {
  cols: 10,
  colW: 1600,
  gap: 200,
  tiles: 60,
} as const;

export const WALL_GRID_W = WALL.cols * WALL.colW + (WALL.cols - 1) * WALL.gap;

/**
 * Nominal packed height: the ledger's 60 tiles sum to ~84,025 native px of
 * height, which over 10 columns at colW/1536 = 1.042 is ~8,752 world units,
 * plus five inter-tile gaps. Rounded, because a balanced masonry pack lands
 * near its mean rather than on it. `verify-timeline.mjs` recomputes this from
 * `src/data/assets.json` and fails if a re-sync moves it more than 20%, which
 * is the drift that leaves the widest shot with two empty columns.
 */
export const WALL_GRID_H = 9800;

/**
 * The lineage trail: earlier versions of a second drawing, and the product
 * screen recordings, as world-space cards.
 *
 * Card sizes live here rather than in `LineageTrail` because the camera's
 * upscale gate has to know how wide one recording is displayed — the clips are
 * 1786 x 944 and are the widest rasters in the film.
 */
export const LINEAGE = {
  /** One product screen recording. 1786:944 native, kept exact. */
  captureW: 1500,
  captureH: 793,
  /** One earlier version of the second drawing. SVG — no resolution ceiling. */
  versionW: 1100,
  versionH: 780,
  gap: 120,
} as const;

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
  /** Why it is where it is. */
  note: string;
};

/**
 * Painter's order: earlier entries render behind later ones.
 *
 * `briefLine` is first because it lives underneath `renderCard` at the origin
 * for the whole first act. Reorder these and station 7 stops working.
 */
export const WORLD_OBJECTS: readonly WorldObject[] = [
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
    rect: rect(0, 0, 1536, 1024),
    station: "interior",
    raster: "rendering",
    rasterWorldW: 1536,
    fadeOutAt: "wall",
    fadeInAt: null,
    note: "The photoreal interior, placed at native pixel size so scale 1.0 means 1:1.",
  },
  {
    id: "planSheet",
    rect: rect(2388, 0, 2400, 1700),
    station: "drawing",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: "wall",
    fadeInAt: null,
    note: "Its OWN drawing: a sheet at roughly A-series proportion, beside the rendering.",
  },
  {
    id: "dimStrings",
    rect: rect(2388, 0, 2400, 1700),
    station: "drawing",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: "wall",
    fadeInAt: null,
    note: "Dimension strings and the CAD layer order, registered to the sheet — same rect, drawn on top.",
  },
  {
    id: "reviewPin",
    rect: rect(2600, 520, 700, 340),
    station: "note",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: "wall",
    fadeInAt: null,
    note: "A real review pin sitting ON the sheet. The camera crosses it and does not stop.",
  },
  {
    id: "lineageTrail",
    rect: rect(1400, 4200, 6000, 2600),
    station: "lineage",
    raster: "screenCapture",
    rasterWorldW: LINEAGE.captureW,
    fadeOutAt: "wall",
    fadeInAt: null,
    note: "Earlier versions of a SECOND drawing plus product screen recordings, as world-space cards.",
  },
  {
    id: "planWall",
    rect: rect(1400, 12200, WALL_GRID_W, WALL_GRID_H),
    station: "wall",
    raster: "wallTile",
    rasterWorldW: WALL.colW,
    fadeOutAt: null,
    fadeInAt: null,
    note: "60 plan rasters. Directly below the origin so station 7's push-in flies up THROUGH it.",
  },
  {
    id: "endCard",
    rect: rect(0, 820, 1500, 620),
    station: "mark",
    raster: null,
    rasterWorldW: null,
    fadeOutAt: null,
    fadeInAt: "sentence",
    note: "Wordmark and terms, just below the sentence. Fades up during `sentence`, while still off the bottom of frame.",
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
    rect: rect(1410, 0, 4820, 2020),
    fit: "contain",
    drift: { dx: 70, dy: 0, dStops: -0.03 },
    note: "The pull-back that reveals the rendering was a card, with its own drawing beside it.",
  },
  drawing: {
    rect: rect(2388, 0, 2760, 1800),
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
    rect: rect(1850, 430, 1400, 1000),
    fit: "contain",
    drift: { dx: 1250, dy: 0, dStops: 0 },
    note: "A pure pan, zero zoom: the pin enters from the right, crosses, and is still leaving when the station ends. The camera does not stop.",
  },
  lineage: {
    rect: rect(1400, 4200, 6400, 3000),
    fit: "contain",
    drift: { dx: 260, dy: 0, dStops: -0.08 },
    note: "Pull back and down onto the second drawing's earlier versions.",
  },
  wall: {
    rect: rect(1400, 12200, 18600, 10400),
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
