import { Img, interpolate, staticFile } from "remotion";

import { TYPE, RADIUS, STROKE, WEIGHT } from "../tokens";
import { Sans, type WorldObjectComponent } from "./primitives";

/**
 * The photoreal rendering that opens the film, and its provenance pill.
 *
 * ── The pill is not decoration ────────────────────────────────────────────
 *
 * This is an AI-generated image and the film says so, on screen, for the whole
 * time it is visible. EU AI Act Article 50 requires AI-generated media to be
 * marked, and the grace period ends 2026-12-02 — inside this film's useful
 * life. The product already carries an always-on "AI-generated" pill on every
 * rendering it shows, so the honest mark is the product's own, reproduced,
 * rather than a smaller one of our invention. Do not remove it, do not fade it
 * out early, and do not shrink it below `TYPE.caption`.
 *
 * ── Why it barely moves ───────────────────────────────────────────────────
 *
 * The rendering is natively 1536x1024 and `MAX_RASTER_UPSCALE` is 1.5, so there
 * is almost no room to push into it — a 1920 master is already showing it at
 * 1.25x. The intimacy of the opening therefore comes from STILLNESS, not from
 * magnification: a very slow drift, and a bloom that lifts as the camera starts
 * to leave. Reaching for a zoom here buys mush.
 */
export const RenderCard: WorldObjectComponent = ({
  width,
  height,
  local,
  palette,
}) => {
  // A slow bloom, not a push. Peaks as the station ends and the camera begins
  // to pull away, so the image feels lit rather than dimmed as it recedes.
  const bloom = interpolate(local, [0, 1], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The card is COVER-fitted into the landscape frame, so roughly 8% of its
  // height is cropped off the top and bottom before anything is drawn. The pill
  // is a provenance mark the film is required to show (EU AI Act Art 50), so it
  // is inset past that band rather than sitting at a pretty margin.
  const pillPad = Math.round(height * 0.018);
  const cropSafe = Math.round(height * 0.115);

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        borderRadius: RADIUS.card,
        // A hairline, never a shadow. The palette has no shadow token and
        // tokens.ts says why: depth in this film is a line, not a blur.
        outline: `${STROKE.hair}px solid ${palette.line}`,
        outlineOffset: -STROKE.hair,
      }}
    >
      <Img
        src={staticFile("renders/render-family-house-interior.webp")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: `brightness(${bloom})`,
        }}
      />

      {/* The product's own always-on provenance pill. */}
      <div
        style={{
          position: "absolute",
          right: cropSafe,
          bottom: cropSafe,
          padding: `${pillPad}px ${pillPad * 2.2}px`,
          borderRadius: 999,
          background: "rgba(12,11,10,0.62)",
          border: `${STROKE.hair}px solid rgba(255,255,255,0.28)`,
          backdropFilter: "blur(6px)",
        }}
      >
        <Sans size={TYPE.caption} tone="rgba(255,255,255,0.92)" weight={WEIGHT.medium}>
          AI-generated
        </Sans>
      </div>
    </div>
  );
};
