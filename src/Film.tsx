import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";

import { FONT } from "./fonts";
import { cameraAt, useLayout } from "./layout";
import { paletteAt } from "./palette";
import type { StationId } from "./stations";
import {
  cameraKeyframes,
  groundStopAtFrame,
  localFrame as localFrameOf,
  objectOpacityAtFrame,
  progressInStation,
  stationAtFrame,
  totalFrames,
  BED_FADE_OUT_FRAMES,
} from "./timeline";
import { WORLD_OBJECTS, rect as worldRect, rectsOverlap } from "./world";
import { Camera } from "./components/Camera";
import { type WorldObjectRegistry } from "./components/primitives";
import { BriefLine } from "./components/BriefLine";
import { RenderCard } from "./components/RenderCard";
import { PlanSheet } from "./components/PlanSheet";
import { DimStrings } from "./components/DimStrings";
import { ReviewPin } from "./components/ReviewPin";
import { LineageTrail } from "./components/LineageTrail";
import { PlanWall } from "./components/PlanWall";
import { EndCard } from "./components/EndCard";
import { StationCard } from "./components/StationCard";

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
  briefLine: BriefLine,
  renderCard: RenderCard,
  planSheet: PlanSheet,
  dimStrings: DimStrings,
  reviewPin: ReviewPin,
  lineageTrail: LineageTrail,
  planWall: PlanWall,
  endCard: EndCard,
  cardInterior: StationCard,
  cardPair: StationCard,
  cardDrawing: StationCard,
  cardFacts: StationCard,
  cardLineage: StationCard,
};

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const palette = paletteAt(groundStopAtFrame(frame));
  const here = stationAtFrame(frame);

  // The camera, resolved once here so the cull below and `<Camera>` cannot
  // disagree about where it is pointing.
  const framings = useMemo(
    () => cameraKeyframes.map((k) => layout.viewportFit(k.rect, k.fit)),
    [layout]
  );
  const cam = cameraAt(cameraKeyframes, framings, frame);
  const viewport = worldRect(cam.cx, cam.cy, layout.width / cam.scale, layout.height / cam.scale);

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
          // Cull anything the camera cannot see.
          //
          // Every world object used to stay mounted for the whole film, which
          // is how sixty wall tiles came to be decoded from frame 0 for a beat
          // that starts at 52.5s. Opacity bounds fixed that one object; this
          // fixes the class. `verify-timeline.mjs` already computes exactly
          // this overlap to decide what it is allowed to check, so the film and
          // its gate now agree on what "on screen" means.
          if (!rectsOverlap(viewport, obj.rect)) return null;
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

      {/**
       * The bed. One file, and the film's only audio.
       *
       * Core `remotion` <Audio>, NOT @remotion/media's: the latter previewed
       * fine and rendered a silent track (-91 dB across the whole file) in
       * a11y-loop-promo-video. Worth retrying on a future release, not on this
       * one.
       *
       * The file is already cut to length and already levelled, so the only
       * thing the composition owns is the envelope. The fade-out starts at
       * FADE_OUT_SEC because the track is still at full energy where the film
       * ends -- the window was chosen to put the track's biggest jump on the
       * camera's reversal at 62.5s, which leaves no natural ending inside the
       * window, so the ending is made here rather than pretended at.
       */}
      <Audio
        src={staticFile("audio/bgm.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [totalFrames - BED_FADE_OUT_FRAMES, totalFrames],
            [1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />
    </AbsoluteFill>
  );
};
