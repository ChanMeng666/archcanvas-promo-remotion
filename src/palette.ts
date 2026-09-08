/**
 * The interpolation between the literal stops in `tokens.ts`.
 *
 * React-free and Remotion-free on purpose: `capture/lib/load-core.mjs` bundles
 * this file with esbuild and runs it in Node so the gates test the real ramp
 * rather than a copy of it. A gate that re-implements what it checks
 * eventually disagrees with it, and then it is worse than no gate.
 *
 * The stop position is a float in [0, GROUND_STOPS.length - 1]. The timeline
 * derives it from each station's `groundStop` intent; nothing here knows what
 * a frame is.
 */

import { GROUND_STOPS, INK, LINE, SPOT, SURFACE } from "./tokens";

/* ── sRGB helpers ─────────────────────────────────────────────────────────── */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const parseHex = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const toHex = (rgb: readonly [number, number, number]) =>
  "#" +
  rgb
    .map((v) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

/**
 * Mixed in plain sRGB, deliberately.
 *
 * The five stops were authored in OKLCH and are already perceptually even, so
 * a straight-line mix between two adjacent stops has nowhere ugly to go. Doing
 * a second OKLCH round-trip here would put a computed colour space between the
 * gate's text parse of `tokens.ts` and the pixels, for no visible gain.
 */
const mixHex = (a: string, b: string, t: number): string => {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex([
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t,
  ]);
};

/* ── WCAG ─────────────────────────────────────────────────────────────────── */

const channelLuminance = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance of a #rrggbb string. */
export const relativeLuminance = (hex: string): number => {
  const [r, g, b] = parseHex(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
};

/** WCAG contrast ratio between two #rrggbb strings. */
export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
};

/* ── the ramp ─────────────────────────────────────────────────────────────── */

export const GROUND_STOP_COUNT = GROUND_STOPS.length;
export const MAX_GROUND_STOP = GROUND_STOPS.length - 1;

/** The ground colour at a continuous stop position. Clamped at both ends. */
export const groundAt = (stopPos: number): string => {
  const p = Math.max(0, Math.min(MAX_GROUND_STOP, stopPos));
  const i = Math.min(MAX_GROUND_STOP - 1, Math.floor(p));
  return mixHex(GROUND_STOPS[i], GROUND_STOPS[i + 1], p - i);
};

/**
 * Where the ink flips from the night set to the day set.
 *
 * Driven by the ground's own luminance rather than by a hand-placed stop
 * number, so moving a station's `groundStop` cannot silently strand white type
 * on a pale ground. The 0.18 threshold is where day ink first clears 4.5:1
 * (see the CONTRAST_PAIRS note in tokens.ts); the crossfade band is narrow
 * because the ramp crosses it fast and, by design, inside the one station that
 * carries no text.
 */
const INK_FLIP_LUMINANCE = 0.18;
const INK_FLIP_BAND = 0.06;

export type Palette = {
  stopPos: number;
  ground: string;
  ink: string;
  inkMuted: string;
  line: string;
  card: string;
  spot: string;
  /** 0 = fully night ink, 1 = fully day ink. Components may cross-fade on it. */
  dayness: number;
};

export const paletteAt = (stopPos: number): Palette => {
  const ground = groundAt(stopPos);
  const lum = relativeLuminance(ground);
  const dayness = clamp01((lum - (INK_FLIP_LUMINANCE - INK_FLIP_BAND)) / (INK_FLIP_BAND * 2));
  const day = dayness >= 0.5;
  return {
    stopPos,
    ground,
    ink: mixHex(INK.night, INK.day, dayness),
    inkMuted: mixHex(INK.nightMuted, INK.dayMuted, dayness),
    line: mixHex(LINE.night, LINE.day, dayness),
    card: mixHex(SURFACE.cardNight, SURFACE.cardDay, dayness),
    // The spot colour does NOT cross-fade: a violet lerped through its own
    // midtones goes grey in the middle, which is worse than either end.
    spot: day ? SPOT.violet : SPOT.violetLight,
    dayness,
  };
};
