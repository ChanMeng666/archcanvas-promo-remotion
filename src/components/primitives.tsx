import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";

import { FONT } from "../fonts";
import type { Layout } from "../layout";
import type { Palette } from "../palette";
import type { StationId } from "../stations";
import { LEADING, RADIUS, TRACKING, TYPE, WEIGHT } from "../tokens";
import type { WorldObjectId } from "../world";

/**
 * ── Only two spring configs exist in this repo ─────────────────────────────
 *
 * Every entrance uses ENTER; every accent uses POP. A film with five slightly
 * different springs has no motion signature, it has five accidents — and the
 * difference between damping 200 and damping 180 is invisible in isolation and
 * obvious in sequence. If a beat needs different motion, change its DURATION,
 * not its physics.
 */
export const SPRING = {
  /** Arrives and stops. No overshoot. */
  enter: { damping: 200, mass: 0.7, stiffness: 105 },
  /** Overshoots a little. For a pin dropping, a number landing. */
  pop: { damping: 14, mass: 0.9, stiffness: 120 },
} as const;

/**
 * Type rises into place from behind a mask.
 *
 * `mask` has to be off for anything with a glow or a descender that matters,
 * because the same `overflow: hidden` that makes the reveal crisp also clips
 * bloom.
 */
export const Reveal: React.FC<{
  delay?: number;
  duration?: number;
  mask?: boolean;
  distance?: number;
  /** Frames since this object's own station arrived; negative before it does. */
  frame: number;
  children: React.ReactNode;
}> = ({ delay = 0, duration = 24, mask = true, distance = 110, frame, children }) => {
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - delay,
    fps,
    config: SPRING.enter,
    durationInFrames: duration,
  });
  const opacity = interpolate(p, [0, 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const inner = (
    <div
      style={{
        transform: `translateY(${(1 - p) * (mask ? distance : distance * 0.35)}${mask ? "%" : "px"})`,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );

  if (!mask) return inner;
  // The mask has to clear the deepest descender at display size or the
  // descenders come out sliced flat. The negative margin keeps that extra room
  // from opening a gap in the stack.
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.26em", marginBottom: "-0.18em" }}>
      {inner}
    </div>
  );
};

/** Scales in with a little overshoot. */
export const PopIn: React.FC<{
  delay?: number;
  from?: number;
  frame: number;
  children: React.ReactNode;
}> = ({ delay = 0, from = 0.86, frame, children }) => {
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: SPRING.pop });
  return (
    <div
      style={{
        transform: `scale(${interpolate(p, [0, 1], [from, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })})`,
        opacity: interpolate(p, [0, 0.35], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
};

/* ── the two voices ───────────────────────────────────────────────────────── */

/**
 * Human voice. Authored line breaks, rendered `nowrap`.
 *
 * Lines are passed in rather than left to the browser: the same string breaks
 * in different places at 1080 and at 1920 wide, and a bad break must show up
 * as an overflow failure from `<Stage>`, not as a silent reflow that nobody
 * looks at until the master is cut.
 */
export const Sans: React.FC<{
  children: React.ReactNode;
  size?: number;
  tone: string;
  weight?: 400 | 500 | 700;
  align?: "left" | "center";
  nowrap?: boolean;
}> = ({ children, size = TYPE.body, tone, weight = WEIGHT.medium, align = "left", nowrap = true }) => (
  <div
    style={{
      fontFamily: FONT.sans,
      fontWeight: weight,
      fontSize: size,
      lineHeight: size >= TYPE.title ? LEADING.display : LEADING.body,
      letterSpacing: size * (size >= TYPE.title ? TRACKING.display : TRACKING.body),
      color: tone,
      textAlign: align,
      whiteSpace: nowrap ? "nowrap" : "normal",
    }}
  >
    {children}
  </div>
);

/** Machine voice. Areas, dimensions, the drawing's own labels. */
export const Mono: React.FC<{
  children: React.ReactNode;
  size?: number;
  tone: string;
  weight?: 400 | 500;
  caps?: boolean;
  align?: "left" | "center";
}> = ({ children, size = TYPE.label, tone, weight = WEIGHT.regular, caps = false, align = "left" }) => (
  <div
    style={{
      fontFamily: FONT.mono,
      fontWeight: weight,
      fontSize: size,
      lineHeight: LEADING.mono,
      letterSpacing: size * (caps ? TRACKING.caps : TRACKING.mono),
      textTransform: caps ? "uppercase" : "none",
      color: tone,
      textAlign: align,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

/* ── the world-object contract ────────────────────────────────────────────── */

/**
 * What every station component is handed.
 *
 * A component draws itself in WORLD units inside a `width x height` box and
 * knows nothing about the camera, the format, or the frame rate. Its box is
 * already positioned and already faded; it just draws.
 */
export type WorldObjectProps = {
  id: WorldObjectId;
  /** World units. The object's own rect, from `WORLD_OBJECTS` in world.ts. */
  width: number;
  height: number;
  /**
   * Frames since THIS object's own station finished arriving. Negative before
   * that, so it can be fed straight to `spring()` / `<Reveal frame={...}>` and
   * the entrance starts exactly when the camera settles.
   */
  localFrame: number;
  /** 0 before this object's station, 0..1 during it, 1 after. */
  local: number;
  /** The station the camera is on right now — not necessarily this object's. */
  station: StationId;
  /** 0..1 through whatever station the camera is on. */
  stationProgress: number;
  /** The absolute composition frame, for anything that needs the film's clock. */
  frame: number;
  layout: Layout;
  /** The ground/ink/spot colours at this frame. Never hard-code a colour. */
  palette: Palette;
};

export type WorldObjectComponent = React.FC<WorldObjectProps>;

/** Every world object needs an entry. `Film.tsx` holds the one instance. */
export type WorldObjectRegistry = Record<WorldObjectId, WorldObjectComponent>;

/**
 * The stand-in until a station component exists.
 *
 * Deliberately ugly and deliberately labelled with its own world size: a
 * placeholder that looks like design is a placeholder that ships.
 */
export const Placeholder: WorldObjectComponent = ({ id, width, height, local, palette }) => (
  <div
    style={{
      width,
      height,
      boxSizing: "border-box",
      border: `${Math.max(2, Math.round(width / 300))}px dashed ${palette.line}`,
      borderRadius: RADIUS.card,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: Math.round(height / 22),
      color: palette.inkMuted,
      // A faint hatch, not a fill: an object's extent has to be visible in a
      // previz still even when the camera is framing a corner of it and the
      // centred label is off-frame. Ugly on purpose — a placeholder that looks
      // like design is a placeholder that ships.
      backgroundImage: `repeating-linear-gradient(45deg, ${palette.line}22 0 ${Math.round(width / 60)}px, transparent ${Math.round(width / 60)}px ${Math.round(width / 20)}px)`,
    }}
  >
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: Math.round(Math.min(width, height) / 9),
        letterSpacing: 2,
        color: palette.ink,
      }}
    >
      {id}
    </div>
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: Math.round(Math.min(width, height) / 20),
        letterSpacing: 1,
      }}
    >
      {width} x {height} world - local {local.toFixed(2)}
    </div>
  </div>
);

/** A rule in the current palette. World units. */
export const Hairline: React.FC<{ width: number; weight?: number; tone: string }> = ({
  width,
  weight = 2,
  tone,
}) => <div style={{ width, height: weight, background: tone }} />;
