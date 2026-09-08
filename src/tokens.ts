/**
 * Literal design tokens. **No expressions live in this file.**
 *
 * Every value here is a hex string or a plain number, because `verify:copy`
 * and the contrast gate parse this file as TEXT. A computed colour — even a
 * one-line `mix()` — is exactly what a text-parsing gate cannot see, so the
 * interpolation between these stops lives next door in `palette.ts` and this
 * file stays boring on purpose.
 *
 * ── The night-to-day ramp ───────────────────────────────────────────────────
 *
 * The ground washes from graphite night to the product's own ivory paper across
 * the film. The colour IS the narrative arc: atmosphere at the start (a
 * photoreal room, no evidence yet), evidence at the end (a sentence, a
 * wordmark, terms you can read). The stops were authored in OKLCH — L rising
 * 0.155 -> 0.98 with the hue swinging the long way round from cool graphite
 * (h 262) through to the brand's warm paper hue (h 85) — and then frozen to
 * hex here. That is why they are perceptually even despite the sRGB numbers
 * looking arbitrary.
 *
 * Stop 4 is not invented: it is the product's own `--background`,
 * `oklch(0.98 0.008 85)` from `archcanvas/src/app/globals.css`, converted to
 * hex. Same for the day ink (`--foreground`), the day hairline (`--border`),
 * the day card (`--card`) and the violet spot (`--plum-strong`).
 *
 * ── Two type voices, and this is a system, not decoration ───────────────────
 *
 * **Sans (Space Grotesk) is the human voice.** The brief someone typed, the
 * spoken lines, the wordmark, the terms. Anything a person said or would say.
 *
 * **Mono (Geist Mono) is the machine voice.** Dimensions, areas, the drawing's
 * own labels, file-ish metadata, the review note's coordinates. Anything the
 * software computed.
 *
 * The rule is absolute and it is what makes the film readable without a
 * caption: when the type changes voice, the source of the claim changed. Never
 * set a spoken line in mono to look technical, and never set a computed number
 * in sans to look friendly.
 */

/* ── the ground ramp ──────────────────────────────────────────────────────── */

/**
 * Five swatches, graphite night -> ivory paper. `palette.ts` interpolates
 * between them on a continuous "stop position" that the timeline derives from
 * each station's `groundStop` intent.
 */
export const GROUND_STOPS = [
  "#090C12", // 0 graphite night   — stations interior, pair
  "#22242B", // 1 slate            — drawing, facts, note
  "#514B50", // 2 dusk             — lineage, and the start of wall
  "#C4BCB6", // 3 warm grey        — reached inside wall, which carries no text
  "#FBF8F2", // 4 ivory paper      — the product's own --background
] as const;

/* ── ink ──────────────────────────────────────────────────────────────────── */

export const INK = {
  /** On stops 0-2. */
  night: "#EEF0F4",
  nightMuted: "#A8ABB0",
  /** On stops 3-4. The product's own --foreground / --muted-foreground. */
  day: "#13110F",
  dayMuted: "#69645D",
} as const;

export const LINE = {
  /** Hairlines on the night ground. */
  night: "#46474D",
  /** The product's own --border. */
  day: "#E2DED5",
} as const;

export const SURFACE = {
  /** A card raised off the night ground. */
  cardNight: "#181A20",
  /** The product's own --card. */
  cardDay: "#FFFDFA",
} as const;

/**
 * Violet is a SPOT colour: a pin head, a caret, a single hairline. Never a
 * field, never a fill behind type. The founder's standing objection to large
 * flat violet is on the record and this film does not relitigate it.
 */
export const SPOT = {
  /** The product's --plum-strong. Use on stops 3-4. */
  violet: "#6A3DF0",
  /** Lifted for legibility on the night stops; same hue family. */
  violetLight: "#A58FFF",
} as const;

/* ── contrast ─────────────────────────────────────────────────────────────── */

/**
 * Foreground/background pairs that must clear their ratio, listed with the
 * ground stop they are actually used on. A gate walks this table; `palette.ts`
 * exports `contrastRatio` so nothing has to reimplement WCAG.
 *
 * There is deliberately NO row for stops 2->3. Between them the ground passes
 * through the mid-luminance band where neither ink clears 4.5:1 — and that is
 * precisely the span the `wall` station occupies, which is why `wall` carries
 * no text and no number. The colour system and the edit agree on that beat; if
 * you ever put a word on the wall, this table is the reason it will not read.
 */
export const CONTRAST_PAIRS = [
  { fg: "#EEF0F4", bg: "#090C12", stop: 0, min: 4.5, use: "night ink on night ground" },
  { fg: "#EEF0F4", bg: "#22242B", stop: 1, min: 4.5, use: "night ink on slate" },
  { fg: "#EEF0F4", bg: "#514B50", stop: 2, min: 4.5, use: "night ink on dusk" },
  { fg: "#A8ABB0", bg: "#090C12", stop: 0, min: 4.5, use: "muted night ink on night ground" },
  { fg: "#A8ABB0", bg: "#22242B", stop: 1, min: 4.5, use: "muted night ink on slate" },
  { fg: "#A58FFF", bg: "#090C12", stop: 0, min: 4.5, use: "violet spot on night ground" },
  { fg: "#A58FFF", bg: "#22242B", stop: 1, min: 4.5, use: "violet spot on slate" },
  { fg: "#13110F", bg: "#C4BCB6", stop: 3, min: 4.5, use: "day ink on warm grey" },
  { fg: "#13110F", bg: "#FBF8F2", stop: 4, min: 4.5, use: "day ink on ivory" },
  { fg: "#69645D", bg: "#FBF8F2", stop: 4, min: 4.5, use: "muted day ink on ivory" },
  { fg: "#6A3DF0", bg: "#FBF8F2", stop: 4, min: 4.5, use: "violet spot on ivory" },
] as const;

/* ── type ─────────────────────────────────────────────────────────────────── */

/**
 * Sizes are WORLD units, not screen pixels. A world object keeps a constant
 * fraction of the frame width across all four formats — the camera fits its
 * rect to the viewport — so a world-unit type size renders proportionally in
 * 1920-wide landscape and 1080-wide vertical, which is the correct behaviour
 * for social formats. Never convert these to px in a component.
 */
export const TYPE = {
  /** The wordmark, and the one typed sentence. Sans. */
  display: 96,
  /** Section-weight sans. */
  title: 64,
  /** Spoken lines rendered on screen. Sans. */
  body: 40,
  /** The AI-generated pill, terms, credits. Sans. */
  caption: 24,
  /** Room names and area labels on the drawing. Mono. */
  label: 26,
  /** Dimension strings. Mono. The drawing's own smallest voice. */
  dimension: 18,
} as const;

export const WEIGHT = {
  regular: 400,
  medium: 500,
  bold: 700,
} as const;

/** Letter-spacing as a fraction of the size. Mono sets tighter than sans. */
export const TRACKING = {
  display: -0.022,
  body: -0.008,
  mono: 0.02,
  caps: 0.14,
} as const;

export const LEADING = {
  display: 1.02,
  body: 1.34,
  mono: 1.2,
} as const;

/* ── spacing ──────────────────────────────────────────────────────────────── */

/** World units. A 4-based step, same as the product's Tailwind rhythm. */
export const SPACE = {
  hair: 4,
  xs: 8,
  sm: 16,
  md: 32,
  lg: 64,
  xl: 128,
} as const;

/** Hairline weights in world units. The drawing is drawn in hairlines. */
export const STROKE = {
  hair: 1.5,
  thin: 3,
  wall: 9,
} as const;

export const RADIUS = {
  card: 12,
  pill: 999,
} as const;
