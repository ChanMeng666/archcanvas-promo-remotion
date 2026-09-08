import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { FONT } from "./fonts";
import { useLayout } from "./layout";
import { paletteAt } from "./palette";
import type { StationId } from "./stations";
import {
  cameraKeyframes,
  groundStopAtFrame,
  localFrame as localFrameOf,
  objectOpacityAtFrame,
  progressInStation,
  stationAtFrame,
} from "./timeline";
import { WORLD_OBJECTS } from "./world";
import { Camera } from "./components/Camera";
import { Placeholder, type WorldObjectRegistry } from "./components/primitives";

/**
 * One world, one camera, no cuts.
 *
 * `Film` does four things and nothing else: paint the ground for this frame,
 * put every world object at its world rect, fade the ones whose beat has
 * passed, and hand the lot to `<Camera>`. It contains no timing and no
 * geometry — those are `timeline.ts` and `world.ts`, which are React-free so
 * the gates can execute them.
 */

/**
 * ── THE ONE EDIT ANOTHER AGENT MAKES IN THIS FILE ──────────────────────────
 *
 * Swap a `Placeholder` for the real component as each one lands:
 *
 *     import { RenderCard } from "./components/RenderCard";
 *     ...
 *     renderCard: RenderCard,
 *
 * The contract is `WorldObjectComponent` in `components/primitives.tsx`: a
 * component is handed its world box, its own station's local frame, the
 * current palette and the layout, and draws in world units. It never reads
 * `useVideoConfig()`, never picks a colour, and never asks what frame the film
 * is on globally.
 *
 * Every id in `WORLD_OBJECTS` must appear here — the type makes that a
 * compile error rather than a blank region in a render, which is how Remotion
 * would otherwise report it (silently, at 90 minutes, in the master).
 */
const REGISTRY: WorldObjectRegistry = {
  briefLine: Placeholder,
  renderCard: Placeholder,
  planSheet: Placeholder,
  dimStrings: Placeholder,
  reviewPin: Placeholder,
  lineageTrail: Placeholder,
  planWall: Placeholder,
  endCard: Placeholder,
};

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const palette = paletteAt(groundStopAtFrame(frame));
  const here = stationAtFrame(frame);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.ground,
        fontFamily: FONT.sans,
        // The ground is the narrative arc, so it must not be a gradient the
        // codec can band: one flat colour per frame, washed over 88 seconds.
        color: palette.ink,
      }}
    >
      <Camera keyframes={cameraKeyframes} layout={layout} frame={frame}>
        {WORLD_OBJECTS.map((obj) => {
          const Component = REGISTRY[obj.id];
          const opacity = objectOpacityAtFrame(obj, frame);
          if (opacity <= 0.001) return null;
          const own = obj.station as StationId;
          return (
            <div
              key={obj.id}
              data-world-object={obj.id}
              style={{
                position: "absolute",
                left: obj.rect.cx - obj.rect.w / 2,
                top: obj.rect.cy - obj.rect.h / 2,
                width: obj.rect.w,
                height: obj.rect.h,
                opacity,
              }}
            >
              <Component
                id={obj.id}
                width={obj.rect.w}
                height={obj.rect.h}
                localFrame={localFrameOf(own, frame)}
                local={progressInStation(own, frame)}
                station={here.id}
                stationProgress={progressInStation(here.id, frame)}
                frame={frame}
                layout={layout}
                palette={palette}
              />
            </div>
          );
        })}
      </Camera>
    </AbsoluteFill>
  );
};
