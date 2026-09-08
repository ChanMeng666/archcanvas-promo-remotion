/**
 * Intent, in SECONDS. Never in frames.
 *
 * Law 3 of this repo: the timeline is derived, never typed. This file is the
 * only place a human decides how long a beat should be, and it decides in the
 * unit a human thinks in. `timeline.ts` is the only file that multiplies by a
 * frame rate; `capture/verify-timeline.mjs` greps everything else for frame
 * literals and fails the build on one.
 *
 * ── How a station's length is actually chosen ──────────────────────────────
 *
 * These `minSec` values are PREVIZ PLACEHOLDERS. Once `src/data/vo.json` holds
 * measured ElevenLabs take durations, each station becomes
 *
 *     max(minSec, voSec + leadInSec + tailSec), clamped at maxSec
 *
 * and the film's clock is the voice, not this table. If vo.json is missing, or
 * a key is missing from it, the station holds at `minSec` AND pushes a line
 * into `timeline.warnings` — it never silently substitutes a default.
 * `gavigo-ire-video` shipped at placeholder timing because a catch-block did
 * exactly that, and nobody noticed until the master was cut.
 *
 * ── leadInSec does double duty, deliberately ───────────────────────────────
 *
 * `leadInSec` is both "how long the voice waits after this beat starts" and
 * "how long the camera takes to travel here from the previous beat". They are
 * the same number because they are the same idea: the camera arrives, and then
 * the line lands. It is also the only speed control the camera has — station
 * `sentence` flies ~12,400 world units home, and 3.0s is what makes that a
 * fast push rather than a whip.
 */

export type StationId =
  | "interior"
  | "pair"
  | "drawing"
  | "facts"
  | "note"
  | "lineage"
  | "wall"
  | "sentence"
  | "mark";

export type Station = {
  id: StationId;
  /**
   * How long this station lasts, in seconds. Total, including the lead-in.
   *
   * This is a flat number because the film is SILENT. It briefly derived from
   * measured voice takes; the voiceover was removed on 2026-09-08 (licensing —
   * docs/decisions.md D11) and with it the only thing that had a claim to set
   * the pace. The camera is now the edit, so the edit is typed here, once.
   */
  holdSec: number;
  /** Camera travel in, and the voice's delay after the beat starts. */
  leadInSec: number;
  /** Silence held after the voice ends, before the next camera move begins. */
  tailSec: number;
  /**
   * Ground ramp position at the START of this station, interpolated linearly
   * to the next station's value. See GROUND_STOPS in tokens.ts.
   */
  groundStop: number;
  /** What the camera is looking at. The framing itself lives in world.ts. */
  intent: string;
};

export const STATIONS: readonly Station[] = [
  {
    id: "interior",
    holdSec: 7.0,
    leadInSec: 0.0,
    tailSec: 0.8,
    groundStop: 0,
    intent: "A photoreal interior rendering, filling the frame. Very slow drift. Not a title card, not a logo — the room first.",
  },
  {
    id: "pair",
    holdSec: 8.0,
    leadInSec: 2.0,
    tailSec: 0.8,
    groundStop: 0.2,
    intent: "Pull back: the rendering is a card, and its own drawing is beside it. The film's first claim, made by the camera rather than by a word.",
  },
  {
    id: "drawing",
    holdSec: 11.0,
    leadInSec: 2.0,
    tailSec: 0.8,
    groundStop: 1,
    intent: "Push into the drawing. CAD layers arrive in order; dimension strings draw themselves.",
  },
  {
    id: "facts",
    holdSec: 8.5,
    leadInSec: 1.6,
    tailSec: 0.8,
    groundStop: 1,
    intent: "Tight on one room: its area label counts up, the circulation overlay resolves.",
  },
  {
    id: "note",
    holdSec: 9.0,
    // 4.0s, and it is the longest lead-in in the film for a reason: this is
    // the crossing from the showcase cluster to the session cluster, ~2,750
    // world units. At 3.4s it runs at 930 screen px/s and reads as a whip; at
    // 4.0s it is 790 and reads as a journey. It is the only control the move
    // has — see the leadInSec note at the top of this file.
    leadInSec: 3.6,
    tailSec: 0.6,
    groundStop: 1,
    intent: "Cross into the session cluster and read the product's own review note in passing. The camera does not stop — its drift is already carrying it down onto the trail.",
  },
  {
    id: "lineage",
    holdSec: 9.0,
    leadInSec: 2.2,
    tailSec: 0.8,
    groundStop: 2,
    intent: "Pull back onto a second drawing's earlier versions, with product screen recordings as world-space cards.",
  },
  {
    id: "wall",
    holdSec: 7.0,
    leadInSec: 2.6,
    tailSec: 0.6,
    // The film's one silent beat. No voice, no text, no number — the widest
    // shot earns nothing from a sentence over it, and the ground ramp crosses
    // its unreadable mid-luminance band here precisely because nothing is set
    // in type. See the CONTRAST_PAIRS note in tokens.ts.
    // If the script ever grows a line for the wall, change this one field to
    // "wall" and the timeline will absorb it.
    groundStop: 2,
    intent: "Furthest out: a montage wall of 60 plan rasters. No text, no number.",
  },
  {
    id: "sentence",
    holdSec: 7.5,
    leadInSec: 3.0,
    tailSec: 0.8,
    // 3.4 rather than 4: the wall's own ramp has to clear the ink-flip band
    // BEFORE this station starts, or the sentence types itself onto a ground
    // where neither ink clears 4.5:1.
    groundStop: 3.4,
    intent: "Fast push back in to the origin, up through the wall, to find one typed sentence exactly where the film started.",
  },
  {
    id: "mark",
    holdSec: 8.0,
    leadInSec: 2.0,
    tailSec: 1.0,
    groundStop: 4,
    intent: "Hold. Ivory ground, the wordmark, and the terms. The camera has stopped.",
  },
];

export const stationIds: readonly StationId[] = STATIONS.map((s) => s.id);

export const station = (id: StationId): Station => {
  const found = STATIONS.find((s) => s.id === id);
  if (!found) throw new Error(`No station "${id}"`);
  return found;
};

/** The ground ramp position the film ends on, held through the last station. */
export const FINAL_GROUND_STOP = 4;
