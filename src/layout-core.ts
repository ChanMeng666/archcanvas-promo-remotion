/**
 * One edit, four deliverables — the pure half.
 *
 * React-free and Remotion-free so `capture/lib/load-core.mjs` can bundle it
 * with esbuild and check the real per-format numbers in Node. The thin
 * `useLayout()` hook that feeds it `useVideoConfig()` lives in `layout.ts`;
 * components import from there and never touch this file directly.
 *
 * **Scenes never read `useVideoConfig().width`.** They read `useLayout()`.
 */

import {
  MAX_RASTER_UPSCALE,
  NATIVE_RASTER,
  STATION_FRAMES,
  rasterUpscale,
  type Fit,
  type WorldRect,
} from "./world";

export type Format = "vertical" | "portrait" | "square" | "landscape";

/** Where the camera has put the world: a world-space centre and a scale. */
export type Framing = { cx: number; cy: number; scale: number };

/**
 * Formats that get a full-bleed hero.
 *
 * Landscape only, and the reason is measured rather than chosen: the hero is a
 * 1536px-wide rendering, and covering each frame costs
 *
 *   landscape 1920x1080  1.250x   ✓ invisible on a photoreal image
 *   portrait  1080x1350  1.318x   ✓ within budget
 *   square    1080x1080  1.055x   ✓ within budget
 *   vertical  1080x1920  1.875x   ✗ over MAX_RASTER_UPSCALE (1.5)
 *
 * Vertical is ruled out by the bound. Portrait and square are inside it and
 * are cards by editorial choice: in a tall frame the rendering reads better
 * with ground above and below, and the film loses nothing, because the very
 * next beat's job is to reveal that it was a card all along.
 *
 * Add "portrait" / "square" here to flip that call — the bound below still
 * has the last word, so nothing can go over budget by editing this line.
 */
const HERO_FULL_BLEED_FORMATS: readonly Format[] = ["landscape"];

/**
 * Margin the camera keeps outside a `contain` framing, in screen px.
 *
 * Small, and nothing like the safe area: this is a canvas film, so the ground
 * is meant to bleed. Text safe areas are `safe` below and belong to <Stage>.
 */
const CAM_PAD: Record<Format, { x: number; y: number }> = {
  landscape: { x: 40, y: 40 },
  square: { x: 36, y: 36 },
  portrait: { x: 36, y: 36 },
  vertical: { x: 40, y: 40 },
};

/**
 * Text safe areas. Reels and TikTok cover the top and bottom of a 9:16 frame
 * with their own UI, so vertical gives up far more than landscape does.
 */
const SAFE: Record<Format, { top: number; bottom: number; side: number }> = {
  vertical: { top: 250, bottom: 390, side: 92 },
  portrait: { top: 120, bottom: 168, side: 84 },
  square: { top: 88, bottom: 96, side: 80 },
  landscape: { top: 80, bottom: 88, side: 128 },
};

/**
 * Type scale per format. The short edge is 1080 in all four, so this barely
 * moves; landscape steps up because it is read across a room.
 */
const TYPE_SCALE: Record<Format, number> = {
  vertical: 1,
  portrait: 0.98,
  square: 0.95,
  landscape: 1.05,
};

export type Layout = {
  width: number;
  height: number;
  format: Format;
  safe: { top: number; bottom: number; side: number };
  camPad: { x: number; y: number };
  scale: number;
  maxContent: number;
  isWide: boolean;
  gridColumns: number;
  /** px helper: size a value against the type scale. */
  t: (px: number) => number;
  /** True when station `interior` covers the frame instead of sitting as a card. */
  heroFullBleed: boolean;
  /** What covering the frame with the hero rendering would actually cost. */
  heroCoverUpscale: number;
  /** Fit a world rect into this viewport. The camera's only geometry call. */
  viewportFit: (rect: WorldRect, fit: Fit) => Framing;
};

export const formatOf = (width: number, height: number): Format => {
  const ar = width / height;
  return ar >= 1.3 ? "landscape" : ar >= 0.95 ? "square" : ar >= 0.7 ? "portrait" : "vertical";
};

export const deriveLayout = (width: number, height: number): Layout => {
  const format = formatOf(width, height);
  const safe = SAFE[format];
  const camPad = CAM_PAD[format];
  const scale = TYPE_SCALE[format];

  const hero = STATION_FRAMES.interior.rect;
  const heroCoverScale = Math.max(width / hero.w, height / hero.h);
  const heroCoverUpscale = rasterUpscale(hero.w, heroCoverScale, NATIVE_RASTER.rendering.w);
  const heroFullBleed =
    HERO_FULL_BLEED_FORMATS.includes(format) && heroCoverUpscale <= MAX_RASTER_UPSCALE + 1e-6;

  const viewportFit = (rect: WorldRect, fit: Fit): Framing => {
    const resolved: Exclude<Fit, "hero"> =
      fit === "hero" ? (heroFullBleed ? "cover" : "contain") : fit;

    const s =
      resolved === "cover"
        ? // Cover bleeds to the physical frame edge. Padding it would leave a
          // hairline of ground down one side, which is worse than a crop.
          Math.max(width / rect.w, height / rect.h)
        : Math.min((width - camPad.x * 2) / rect.w, (height - camPad.y * 2) / rect.h);

    return { cx: rect.cx, cy: rect.cy, scale: s };
  };

  return {
    width,
    height,
    format,
    safe,
    camPad,
    scale,
    maxContent: format === "landscape" ? 1420 : width - safe.side * 2,
    isWide: format === "landscape",
    gridColumns: format === "landscape" ? 4 : 2,
    t: (px: number) => Math.round(px * scale),
    heroFullBleed,
    heroCoverUpscale,
    viewportFit,
  };
};

/* ── the camera curve ─────────────────────────────────────────────────────── */

/**
 * The camera's position on a frame. Lives here, in the React-free half, so
 * `verify-timeline.mjs` can walk every frame of every format through the SAME
 * function the render uses — not a re-implementation of it.
 *
 * ── The two things a later reader will get wrong ───────────────────────────
 *
 * **1. Zoom interpolates on log(scale), never on scale.** A linear ramp from
 * 0.099 to 1.25 spends most of its time in the top half of that range, so on
 * screen the move rips away from the wide end and then appears to stall as it
 * arrives. It reads as a badly chosen ease, and no ease fixes it, because the
 * problem is the parameterisation and not the curve. Interpolating log(scale)
 * makes every equal slice of time an equal RATIO of zoom, which is what a
 * physical camera does and what the eye calls constant velocity.
 *
 * **2. Pan interpolates linearly in SCREEN space, not in world space.** A
 * world-space lerp of the centre covers world units at a constant rate — but a
 * world unit is worth 12x more screen pixels at this film's tight end than at
 * its wide end, so the same pan whips at one zoom and crawls at another.
 * Holding screen velocity constant means dc/du proportional to 1/s(u), and
 * with s(u) = s0·e^(k·u) that integrates to
 *
 *     f(u) = (1 - e^(-k·u)) / (1 - e^(-k))
 *
 * so the centre is lerped on f(u) rather than on u. As k approaches 0 this
 * degenerates to f(u) = u, which is why the near-zero branch below is the
 * limit rather than a special case. Same idea as van Wijk's smooth
 * zoom-and-pan, cut down to the part this film needs.
 */
export type CameraEaseName = "linear" | "inOut";

/** Identical to Remotion's `Easing.inOut(Easing.cubic)`, inlined to stay React-free. */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const cameraAt = (
  keyframes: readonly { frame: number; ease: CameraEaseName }[],
  framings: readonly Framing[],
  frame: number
): Framing => {
  if (framings.length === 0) throw new Error("cameraAt: no keyframes");
  if (framings.length === 1) return framings[0];

  let i = 0;
  while (i < keyframes.length - 2 && frame >= keyframes[i + 1].frame) i += 1;

  const a = framings[i];
  const b = framings[i + 1];
  const span = keyframes[i + 1].frame - keyframes[i].frame;

  // Two keyframes on the same frame: a station whose lead-in rounded to zero.
  // Snap rather than divide by it; timeline.ts has already warned about it.
  if (span <= 0) return b;

  const u = clamp01((frame - keyframes[i].frame) / span);
  const eased = keyframes[i + 1].ease === "inOut" ? easeInOutCubic(u) : u;

  // (1) zoom on log(scale)
  const k = Math.log(b.scale / a.scale);
  const scale = a.scale * Math.exp(k * eased);

  // (2) pan linear in screen space
  const f = Math.abs(k) < 1e-6 ? eased : (1 - Math.exp(-k * eased)) / (1 - Math.exp(-k));

  return { cx: a.cx + (b.cx - a.cx) * f, cy: a.cy + (b.cy - a.cy) * f, scale };
};

/** The four sizes this film ships. One composition, four `<Composition>`s. */
export const DELIVERABLES = [
  { id: "Zoom-Landscape-16x9", width: 1920, height: 1080 },
  { id: "Zoom-Vertical-9x16", width: 1080, height: 1920 },
  { id: "Zoom-Portrait-4x5", width: 1080, height: 1350 },
  { id: "Zoom-Square-1x1", width: 1080, height: 1080 },
] as const;
