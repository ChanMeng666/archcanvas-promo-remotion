import { interpolate } from "remotion";

import script from "../data/script.json";
import { TYPE, WEIGHT } from "../tokens";
import { Sans, type WorldObjectComponent } from "./primitives";

/**
 * The sentence a person typed — the thing the whole film is reversing towards.
 *
 * It sits AT THE WORLD ORIGIN, underneath the rendering, and it has been there
 * since frame 0. Nothing brings it on: the rendering above it fades out while
 * the origin is thousands of units off-frame, and station 7 flies the camera
 * back up through the plan wall to find it exactly where the film started.
 * That geography is the film's argument, so this component does not animate in
 * — it types.
 *
 * ── `about 110 m2` is not a typo ──────────────────────────────────────────
 *
 * The brief was read off `c01-brief-typing.mp4` at t=44.0s, where it is typed
 * with an ASCII `m2`. The first film's clearance doc recorded it as `m²` and
 * was wrong. It is transcribed as filmed: tidying the one thing the film says a
 * human wrote would be mocking it up, and CLAUDE.md law 2 has no small-print
 * exception for typography. See docs/decisions.md D8.
 */

type Card = { id: string; lines: string[] };

const LINES =
  (script.cards as Card[]).find((c) => c.id === "sentence")?.lines ?? null;

export const BriefLine: WorldObjectComponent = ({
  width,
  height,
  local,
  localFrame,
  palette,
}) => {
  if (!LINES) {
    throw new Error(
      'BriefLine: no cards[] row "sentence" in src/data/script.json',
    );
  }

  const size = Math.min(height / (LINES.length * 1.55), width / 26);

  // Typed, not faded. The whole sentence, character by character, across the
  // station's hold — because a person typed it, and the film has just spent
  // seventy seconds arguing that this is where a drawing comes from.
  const total = LINES.join(" ").length;
  const shown = Math.round(
    interpolate(local, [0.12, 0.72], [0, total], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // A caret that blinks on the beat rather than on a timer — 101.65 BPM is
  // 17.7 frames, and half of that is a clean on/off.
  const caretOn = Math.floor(localFrame / 9) % 2 === 0;

  let budget = shown;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: size * 0.26,
      }}
    >
      {LINES.map((line, i) => {
        const take = Math.max(0, Math.min(line.length, budget));
        budget -= take + 1;
        const isLast = i === LINES.length - 1;
        const done = take >= line.length;

        return (
          <div key={line} style={{ display: "flex", alignItems: "baseline" }}>
            <Sans size={size} tone={palette.ink} weight={WEIGHT.regular}>
              {line.slice(0, take)}
            </Sans>
            {take > 0 && !done && (
              <span
                style={{
                  display: "inline-block",
                  width: size * 0.06,
                  height: size * 0.92,
                  marginLeft: size * 0.08,
                  background: caretOn ? palette.spot : "transparent",
                }}
              />
            )}
            {isLast && done && shown >= total && (
              <span
                style={{
                  display: "inline-block",
                  width: size * 0.06,
                  height: size * 0.92,
                  marginLeft: size * 0.08,
                  background: caretOn ? palette.spot : "transparent",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export const BRIEF_MAX = TYPE.display;
