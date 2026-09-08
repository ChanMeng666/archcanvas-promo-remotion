import { OffthreadVideo, interpolate, staticFile } from "remotion";

import { LINEAGE } from "../world";
import { RADIUS, STROKE } from "../tokens";
import { InlineSvgLayer, useInlineSvg } from "./svg";
import type { WorldObjectComponent } from "./primitives";

/**
 * The session cluster: the drawing after the fix, and the conversation that
 * fixed it.
 *
 * ── The payoff nothing points at ──────────────────────────────────────────
 *
 * `plan-hero.svg` is the SAME filmed session as the review pin above it, later.
 * Same project in its title block; and it has the Bathroom and the Hall that
 * the pinned state does not. So the camera's pan from the pin down onto this
 * trail is the named defect actually being fixed, on screen, in one continuous
 * move. `world.ts` declares `LINEAGE.fixedDrawing` on the pin's centre line for
 * exactly this reason, and `verify-timeline.mjs` asserts the two stay
 * co-visible and centred within 80 units.
 *
 * No copy points at it, and none should. If it only lands for the people who
 * look, that is the right amount — see docs/decisions.md D1. Resist every
 * instinct to add a label, an arrow, or a highlight.
 *
 * ── The recordings are cards, never full-bleed ────────────────────────────
 *
 * Every clip sits in a bordered card with a hairline. They are silent
 * (`hasAudioStream: false` on every row in the ledger) and 30fps, matching the
 * composition, so they play without judder or resampling.
 */
export const LineageTrail: WorldObjectComponent = ({
  width,
  height,
  local,
  palette,
}) => {
  const plan = useInlineSvg(staticFile("plans/plan-hero.svg"));

  const sx = width / LINEAGE.w;
  const sy = height / LINEAGE.h;

  const fixed = LINEAGE.fixedDrawing;

  // The ghosts of earlier versions, behind the drawing that survived.
  const ghosts = LINEAGE.ghosts;

  return (
    <div style={{ width, height, position: "relative" }}>
      {ghosts.map((g, i) => {
        const p = interpolate(local, [0.05 + i * 0.06, 0.45 + i * 0.06], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={`ghost-${i}`}
            style={{
              position: "absolute",
              left: g.x * sx,
              top: g.y * sy,
              width: g.w * sx,
              height: g.h * sy,
              opacity: p * (0.16 + i * 0.06),
              border: `${STROKE.hair}px solid ${palette.line}`,
              borderRadius: RADIUS.card,
              background: palette.card,
            }}
          />
        );
      })}

      {/* The drawing the session arrived at. */}
      <div
        style={{
          position: "absolute",
          left: fixed.x * sx,
          top: fixed.y * sy,
          width: fixed.w * sx,
          height: fixed.h * sy,
          background: palette.card,
          borderRadius: RADIUS.card,
          border: `${STROKE.hair}px solid ${palette.line}`,
          overflow: "hidden",
        }}
      >
        {plan ? (
          <InlineSvgLayer
            doc={plan}
            scope="lineageTrail"
            width={fixed.w * sx}
            height={fixed.h * sy}
            // Fully drawn. This drawing is the session's OUTCOME, so it must
            // already exist when the camera arrives — the beat is the pin
            // above it being answered, not a second sheet inking itself.
            css={`[data-layer] { opacity: 1; }`}
          />
        ) : null}
      </div>

      {/* The conversation, as world-space cards. */}
      {LINEAGE.clips.map((clip, i) => {
        const p = interpolate(local, [0.18 + i * 0.1, 0.5 + i * 0.1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={clip.file}
            style={{
              position: "absolute",
              left: clip.x * sx,
              top: clip.y * sy,
              width: clip.w * sx,
              height: clip.h * sy,
              opacity: p,
              borderRadius: RADIUS.card,
              border: `${STROKE.hair}px solid ${palette.line}`,
              overflow: "hidden",
              background: palette.card,
            }}
          >
            <OffthreadVideo
              src={staticFile(`clips/${clip.file}`)}
              startFrom={clip.startFrom}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        );
      })}
    </div>
  );
};
