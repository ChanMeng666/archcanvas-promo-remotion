/**
 * The derived timeline. **The only file in this repo that does frame
 * arithmetic**, and the only file allowed to contain a frame literal.
 *
 * React-free and Remotion-free: `capture/lib/load-core.mjs` bundles this with
 * esbuild and executes it in Node, so `verify-timeline.mjs` checks the real
 * clock rather than a re-implementation of it. A gate that re-implements what
 * it checks eventually disagrees with it, and then it is worse than no gate.
 *
 * Everything here is derived from two inputs and nothing else:
 *   - `stations.ts`  — intent in seconds
 *
 * If a take is missing, the station holds at `minSec` and a line goes into
 * `warnings`. Nothing is silently defaulted. `verify-timeline.mjs --strict`
 * fails while `warnings` is non-empty, which is how "the film is still at
 * previz timing" stays a visible fact rather than a thing somebody remembers.
 */

import { STATIONS, type Station, type StationId } from "./stations";
import { STATION_FRAMES, driftRect, worldWarnings, type Fit, type WorldRect } from "./world";

/**
 * 30, because the source footage — the product screen recordings on the
 * lineage trail — is 30fps. Matching it avoids judder on the one part of the
 * film we did not draw ourselves.
 */
export const FPS = 30;

/* ── warnings collector ───────────────────────────────────────────────────── */

/**
 * Collected here, exported as `warnings`, and never thrown.
 *
 * A derivation that falls back must SAY it fell back. gavigo-ire-video shipped
 * at placeholder timing because a catch-block substituted a default and nothing
 * recorded that it had; `verify-timeline.mjs --strict` fails while this list is
 * non-empty, so a fallback stays a visible fact rather than a thing somebody
 * remembers.
 */
const warningList: string[] = [...worldWarnings];
const warn = (message: string): void => {
  warningList.push(message);
};

/* ── station lengths ──────────────────────────────────────────────────────── */

export type TimelineStation = {
  id: StationId;
  index: number;
  station: Station;
  startSec: number;
  durationSec: number;
  startFrame: number;
  durationInFrames: number;
  /** Exclusive: the next station's startFrame. */
  endFrame: number;
  /** The frame the camera finishes arriving on, and the voice starts. */
  arriveFrame: number;
};

const buildStations = (): TimelineStation[] => {
  const out: TimelineStation[] = [];
  let cursorFrame = 0;
  let cursorSec = 0;

  STATIONS.forEach((st, index) => {
    const durationSec = st.holdSec;

    if (st.leadInSec + st.tailSec >= durationSec) {
      warn(
        `station "${st.id}" is ${durationSec}s but spends ${st.leadInSec}s arriving and ${st.tailSec}s settling — there is no time left in the middle for anything to happen.`
      );
    }

    const durationInFrames = Math.round(durationSec * FPS);
    const leadInFrames = Math.round(st.leadInSec * FPS);

    if (index > 0 && st.leadInSec < 0.4) {
      warn(
        `station "${st.id}" has leadInSec ${st.leadInSec} — the camera has under 0.4s to travel here from "${STATIONS[index - 1].id}", which reads as a cut. This film has no cuts.`
      );
    }
    if (leadInFrames >= durationInFrames) {
      warn(
        `station "${st.id}" spends its whole length arriving (leadIn ${st.leadInSec}s of ${durationSec.toFixed(2)}s) — it never holds.`
      );
    }

    out.push({
      id: st.id,
      index,
      station: st,
      startSec: cursorSec,
      durationSec,
      startFrame: cursorFrame,
      durationInFrames,
      endFrame: cursorFrame + durationInFrames,
      arriveFrame: cursorFrame + Math.min(leadInFrames, durationInFrames - 1),
    });

    cursorFrame += durationInFrames;
    cursorSec += durationSec;
  });

  return out;
};

export const stations: readonly TimelineStation[] = buildStations();

export const totalFrames: number = stations[stations.length - 1].endFrame;
export const totalSeconds: number = totalFrames / FPS;

const index = {} as Record<StationId, TimelineStation>;
for (const s of stations) index[s.id] = s;
/** Station lookup by id. */
export const byId: Readonly<Record<StationId, TimelineStation>> = index;

/** Which station a frame falls in. Clamped at both ends. */
export const stationAtFrame = (frame: number): TimelineStation => {
  for (const s of stations) {
    if (frame < s.endFrame) return s;
  }
  return stations[stations.length - 1];
};

/** 0..1 through a station, by id. */
export const progressInStation = (id: StationId, frame: number): number => {
  const s = byId[id];
  const p = (frame - s.startFrame) / s.durationInFrames;
  return p < 0 ? 0 : p > 1 ? 1 : p;
};

/**
 * Frames since a station's camera finished arriving. Negative before it does,
 * which is what a component wants to feed a `spring()` so its entrance starts
 * exactly when the camera settles.
 */
export const localFrame = (id: StationId, frame: number): number => frame - byId[id].arriveFrame;

/* ── what is visible ──────────────────────────────────────────────────────── */

/** A clamped lerp. Remotion's `interpolate` would drag React in here. */
const ramp = (v: number, a: number, b: number, from: number, to: number): number => {
  const t = (v - a) / (b - a);
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return from + (to - from) * c;
};

/**
 * 0..1 across a station's HOLD — the part after the camera has arrived.
 *
 * Not `progressInStation`, and the difference is the whole bug: a fade keyed
 * to the station would start during the lead-in, while the camera is still
 * travelling and has not yet pulled out to the scale that makes the fade
 * unreadable. Derived from `arriveFrame`, so changing a station's `leadInSec`
 * moves its fade windows with it.
 */
const holdProgress = (id: StationId, frame: number): number => {
  const s = byId[id];
  const span = Math.max(1, s.endFrame - s.arriveFrame);
  const p = (frame - s.arriveFrame) / span;
  return p < 0 ? 0 : p > 1 ? 1 : p;
};

/**
 * An object's opacity on a frame.
 *
 * Exactly two objects in this world ever change opacity, and both do it during
 * `wall`'s hold, where they are thumbnails in all four formats — see
 * FADE_INVISIBLE_PX in `world.ts`, which `verify-timeline.mjs` measures against
 * every frame of every window in every format.
 *
 * Derived here rather than in `Film.tsx` so the gate and the film read one
 * implementation. The gate also uses it to skip invisible objects when it
 * walks the raster bound.
 */
export const objectOpacityAtFrame = (
  obj: { fadeInAt: string | null; fadeOutAt: string | null },
  frame: number
): number => {
  let o = 1;
  // Fast in, fast out, and both well inside the station's hold.
  //
  // These used to run 0.1 -> 0.8, which spends seventy per cent of a beat
  // fading. At frame 1450 the lineage card was still only 41% opaque more than
  // half way through its own station, and read as washed-out type rather than
  // as type arriving. A promo cannot afford that: an element should be present
  // or gone, and the transition between should be the shortest thing that does
  // not read as a cut. This film has no cuts, so "shortest" is about a third of
  // a second at these station lengths.
  if (obj.fadeInAt) o *= ramp(holdProgress(obj.fadeInAt as StationId, frame), 0.04, 0.28, 0, 1);
  if (obj.fadeOutAt) o *= ramp(holdProgress(obj.fadeOutAt as StationId, frame), 0.7, 0.94, 1, 0);
  return o;
};

/* ── the ground ramp ──────────────────────────────────────────────────────── */

/**
 * The continuous ground-stop position at a frame, interpolated between each
 * station's declared `groundStop` and the next one's. Held flat through the
 * last station. `palette.ts` turns this into colours.
 */
export const groundStopAtFrame = (frame: number): number => {
  const s = stationAtFrame(frame);
  const next = stations[s.index + 1];
  const from = s.station.groundStop;
  const to = next ? next.station.groundStop : from;
  const p = progressInStation(s.id, frame);
  return from + (to - from) * p;
};

/* ── the camera ───────────────────────────────────────────────────────────── */

export type CameraEase = "linear" | "inOut";

export type CameraKeyframe = {
  frame: number;
  /** A world rect. The camera fits it to the viewport; the FIT is per-format. */
  rect: WorldRect;
  fit: Fit;
  /** How to travel INTO this keyframe from the previous one. */
  ease: CameraEase;
  station: StationId;
  kind: "arrive" | "exit";
};

/**
 * Two keyframes per station, and the shape of the film lives in the gaps.
 *
 *   startFrame ─────────────► arriveFrame ──────────────► endFrame
 *      (travelling, eased)       (holding, drifting, linear)
 *
 * A station's `arrive` keyframe is `leadInSec` after it starts, so the travel
 * from the previous station's `exit` happens inside the NEXT station's lead-in.
 * That is why the film has no cuts and no dead air: the camera is always either
 * arriving somewhere or drifting where it is.
 */
const buildKeyframes = (): CameraKeyframe[] => {
  const out: CameraKeyframe[] = [];

  for (const s of stations) {
    const frame = STATION_FRAMES[s.id];
    if (!frame) {
      warn(`station "${s.id}" has no entry in STATION_FRAMES — the camera does not know where to look.`);
      continue;
    }
    out.push({
      frame: s.arriveFrame,
      rect: frame.rect,
      fit: frame.fit,
      ease: s.index === 0 ? "linear" : "inOut",
      station: s.id,
      kind: "arrive",
    });
    out.push({
      frame: s.endFrame,
      rect: driftRect(frame.rect, frame.drift),
      fit: frame.fit,
      ease: "linear",
      station: s.id,
      kind: "exit",
    });
  }

  return out;
};

export const cameraKeyframes: readonly CameraKeyframe[] = buildKeyframes();

/* ── warnings ─────────────────────────────────────────────────────────────── */

/**
 * Every place the film fell back to a placeholder. Empty is the ship
 * condition; `verify-timeline.mjs --strict` enforces it.
 */
export const warnings: readonly string[] = warningList;

/** A printable derivation, used by load-core.mjs and by the gate's output. */
export const describe = (): string => {
  const rows = stations.map((s) => {
    const cells = [
      s.id.padEnd(9),
      s.startSec.toFixed(2).padStart(7),
      s.durationSec.toFixed(2).padStart(7),
      String(s.startFrame).padStart(6),
      String(s.durationInFrames).padStart(6),
      String(s.arriveFrame).padStart(7),
      s.station.groundStop.toFixed(2).padStart(6),
    ];
    return "  " + cells.join(" ");
  });
  const head =
    "  " +
    [
      "station".padEnd(9),
      "start s".padStart(7),
      "dur s".padStart(7),
      "start".padStart(6),
      "frames".padStart(6),
      "arrive".padStart(7),
      "ground".padStart(6),
    ].join(" ");
  return [head, ...rows, "", `  totalFrames ${totalFrames}  (${totalSeconds.toFixed(2)}s @ ${FPS}fps)`].join("\n");
};

/* ── the bed's envelope ───────────────────────────────────────────────────── */

/**
 * The music fade, in seconds, converted here because this is the only file that
 * is allowed to know what a frame is (CLAUDE.md law 3).
 *
 * There is no fade-in: `tools/prepare-bed.ps1` bakes a 0.35s one into the file
 * so the cut never starts on a discontinuity, and a second fade on top would
 * just make the opening limp.
 *
 * The fade-out is 2.4s and it is doing real work. The window was chosen to put
 * the track's biggest energy jump (x3.54, at 99.80s of the source) on the
 * camera's reversal at 62.5s. That is the right trade, but it means the window
 * ends while the track is still at full energy -- there is no natural ending
 * inside it. So the ending is made here, honestly, rather than pretended at by
 * hunting for a quieter window that would have put the arrival in the wrong
 * place.
 */
export const BED_FADE_OUT_SEC = 2.4;
export const BED_FADE_OUT_FRAMES = Math.round(BED_FADE_OUT_SEC * FPS);
