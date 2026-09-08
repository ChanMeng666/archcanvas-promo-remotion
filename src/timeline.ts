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
 *   - `data/vo.json` — measured voice-take lengths, written by ffprobe
 *
 * If a take is missing, the station holds at `minSec` and a line goes into
 * `warnings`. Nothing is silently defaulted. `verify-timeline.mjs --strict`
 * fails while `warnings` is non-empty, which is how "the film is still at
 * previz timing" stays a visible fact rather than a thing somebody remembers.
 */

import voJson from "./data/vo.json";
import { STATIONS, type Station, type StationId } from "./stations";
import { STATION_FRAMES, driftRect, type Fit, type WorldRect } from "./world";

/**
 * 30, because the source footage — the product screen recordings on the
 * lineage trail — is 30fps. Matching it avoids judder on the one part of the
 * film we did not draw ourselves.
 */
export const FPS = 30;

/* ── voice takes ──────────────────────────────────────────────────────────── */

type VoTake = number | { seconds?: number; file?: string };
type VoFile = { generatedAt?: string | null; fps?: number; takes?: Record<string, VoTake> };

const VO = voJson as VoFile;

const warningList: string[] = [];
const warn = (line: string) => {
  warningList.push(line);
};

const voSeconds = (key: string | null): number | null => {
  if (key === null) return null;
  const takes = VO.takes;
  if (!takes || !Object.prototype.hasOwnProperty.call(takes, key)) {
    warn(
      `vo take "${key}" is missing from src/data/vo.json — station holding at its previz minSec. Run \`npm run vo\` then \`npm run vo:measure\`.`
    );
    return null;
  }
  const raw = takes[key];
  const seconds = typeof raw === "number" ? raw : typeof raw?.seconds === "number" ? raw.seconds : null;
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    warn(
      `vo take "${key}" in src/data/vo.json is not a positive number of seconds (got ${JSON.stringify(raw)}) — station holding at its previz minSec.`
    );
    return null;
  }
  return seconds;
};

/* ── station lengths ──────────────────────────────────────────────────────── */

export type TimelineStation = {
  id: StationId;
  index: number;
  station: Station;
  /** Measured take length, or null when the film is still at previz timing. */
  voSec: number | null;
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
    const voSec = voSeconds(st.vo);

    let durationSec = st.minSec;
    if (voSec !== null) {
      const needed = voSec + st.leadInSec + st.tailSec;
      durationSec = Math.max(st.minSec, needed);
      if (durationSec > st.maxSec) {
        warn(
          `station "${st.id}" needs ${needed.toFixed(2)}s (vo ${voSec.toFixed(2)} + lead ${st.leadInSec} + tail ${st.tailSec}) but maxSec is ${st.maxSec} — clamped, so the tail is eaten. Shorten the line or raise maxSec.`
        );
        durationSec = st.maxSec;
      }
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
      voSec,
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
 * An object's opacity on a frame.
 *
 * Objects do not appear and disappear; they fade, and always while the camera
 * is somewhere else — `world.ts` picked each `fadeOutAt` / `fadeInAt` station
 * precisely so the fade happens off-frame. The windows are inset from the
 * station edges so a fade never collides with the camera arriving.
 *
 * Derived here rather than in `Film.tsx` so that `verify-timeline.mjs` can
 * skip objects that are invisible when it walks the raster-upscale bound —
 * otherwise the gate flags a blow-up nobody can see.
 */
export const objectOpacityAtFrame = (
  obj: { fadeInAt: string | null; fadeOutAt: string | null },
  frame: number
): number => {
  let o = 1;
  if (obj.fadeInAt) o *= ramp(progressInStation(obj.fadeInAt as StationId, frame), 0.1, 0.6, 0, 1);
  if (obj.fadeOutAt) o *= ramp(progressInStation(obj.fadeOutAt as StationId, frame), 0.15, 0.7, 1, 0);
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
      (s.voSec === null ? "previz" : s.voSec.toFixed(2)).padStart(7),
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
      "vo s".padStart(7),
      "ground".padStart(6),
    ].join(" ");
  return [head, ...rows, "", `  totalFrames ${totalFrames}  (${totalSeconds.toFixed(2)}s @ ${FPS}fps)`].join("\n");
};
