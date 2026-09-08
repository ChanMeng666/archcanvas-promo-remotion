/**
 * The film's two voices.
 *
 * **Space Grotesk is the human voice** — the brief someone typed, the spoken
 * lines, the wordmark, the terms. **Geist Mono is the machine voice** — areas,
 * dimensions, the drawing's own labels. The full rule is in `tokens.ts`; this
 * file only loads them.
 *
 * Weights are narrowed to exactly what the film sets. `@remotion/google-fonts`
 * loads every weight and every subset by default, which in
 * `a11y-loop-promo-video` meant 126 network requests PER RENDER WORKER — and
 * Remotion re-executes module scope in every worker it spins up, so that cost
 * is paid again each time one comes up cold. Adding a weight here is not free.
 */

import { loadFont as loadSans } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";

const sans = loadSans("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

const mono = loadMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const FONT = {
  /** Human voice. */
  sans: `${sans.fontFamily}, "Helvetica Neue", Helvetica, Arial, sans-serif`,
  /** Machine voice. */
  mono: `${mono.fontFamily}, ui-monospace, "SF Mono", Consolas, monospace`,
} as const;

/**
 * Resolves when both faces are actually applied.
 *
 * `<Stage>` waits on `document.fonts.ready` rather than this, because that is
 * the signal that covers the fallback-metrics trap. This is exported for
 * anything that needs to hold a `delayRender` on the fonts specifically.
 */
export const fontsReady: Promise<unknown> = Promise.all([
  sans.waitUntilDone(),
  mono.waitUntilDone(),
]);
