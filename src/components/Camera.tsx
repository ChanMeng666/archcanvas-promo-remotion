import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";

import { cameraAt, type Layout } from "../layout";
import type { CameraKeyframe } from "../timeline";

/**
 * The whole film's edit, in one transform on one layer.
 *
 * There are no cuts. `Camera` takes the derived keyframes, asks where the
 * camera is on this frame, and applies a single transform to a single
 * absolutely-positioned world layer. Children lay themselves out in world
 * coordinates and know nothing about any of this.
 *
 * The curve itself — log(scale) zoom, screen-linear pan, and why both — is
 * `cameraAt` in `layout-core.ts`. It lives there rather than here so that
 * `capture/verify-timeline.mjs` can walk every frame of every format through
 * the same function this component renders with, instead of through a copy
 * that drifts.
 */
export const Camera: React.FC<{
  keyframes: readonly CameraKeyframe[];
  layout: Layout;
  frame: number;
  children: React.ReactNode;
}> = ({ keyframes, layout, frame, children }) => {
  // Fitting is per-format — the same world rect is a different scale at
  // 1920x1080 and at 1080x1920 — so it happens here and not in timeline.ts,
  // which has no viewport and must stay React-free.
  const framings = useMemo(
    () => keyframes.map((k) => layout.viewportFit(k.rect, k.fit)),
    [keyframes, layout]
  );

  const cam = cameraAt(keyframes, framings, frame);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        data-camera
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          transformOrigin: "0 0",
          // Read right to left: put the world point the camera is looking at
          // under the origin, scale about it, then move it to the middle of the
          // frame. A zero-size layer, so nothing here can lay anything out.
          transform: `translate(${layout.width / 2}px, ${layout.height / 2}px) scale(${cam.scale}) translate(${-cam.cx}px, ${-cam.cy}px)`,
          // NO `willChange: transform` HERE, deliberately.
          //
          // It is the reflex on a transformed layer and it is catastrophic on
          // this one. The world's children span 17,800 x 18,305 units, which at
          // the tightest station's 1.25x is a layer of 22,250 x 22,881 CSS
          // pixels. `will-change` promotes that to a composited layer and asks
          // Chrome to allocate backing store for ALL of it, most of which no
          // frame can ever see. Renders were killed for memory with 5.4 GB free.
          //
          // Without the hint Chrome rasterises what is actually on screen. The
          // hint is right on a small element that moves; it is wrong on a
          // world.
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
