import { Img, interpolate, staticFile } from "remotion";

import type { WorldObjectComponent } from "./primitives";

/**
 * Sixty plans, at the furthest point of the pull-back — as ONE image.
 *
 * ── What this beat may and may not say ────────────────────────────────────
 *
 * These are rasters from a recorded offline designer benchmark run. B10 forbids
 * presenting that eval as a public benchmark or attaching a score to it, and B9
 * forbids claiming a model-loop gain in either direction. The source library
 * adds its own rule: montage only, never present a single one as a showcase
 * plan. So this station carries NO text, NO number and NO count — not here, not
 * in script.json, not in a caption. Showing the volume and saying nothing is
 * the only honest treatment, and it is also the strongest: the film has spent a
 * minute on one drawing, and this is the moment you see there are always more.
 *
 * ── Why one image and not sixty ───────────────────────────────────────────
 *
 * It was sixty `<Img>` elements, and Remotion registers a delayRender per
 * image. Renders died with "delayRender was called but not cleared after
 * 118000ms", always naming a different-but-deterministic tile — because the
 * named one is just whichever sat last in a load queue the browser never
 * finished. Downscaling the tiles from 1536px to 640px cut the decode from
 * roughly 200 megapixels to 22 and did not fix it: the problem was the COUNT.
 *
 * `scripts/build-wall-montage.mjs` composites them offline, at the exact
 * positions `world.ts` packs them into, and this loads the result. Every tile is
 * still a real plan raster at its own aspect ratio, uncropped, which is the part
 * law 2 cares about — a montage is a single static image that happens to be made
 * of sixty pictures, and building it once is what it always should have been.
 *
 * The per-column stagger that used to reveal the tiles is gone with them. What
 * replaces it is closer to the truth anyway: the camera arrives on a wall that
 * was already there, because the plans were already there before the film
 * started.
 */
export const PlanWall: WorldObjectComponent = ({ width, height, local }) => {
  // A slow drift outward across the beat. The camera is still pulling back when
  // this station ends, so the wall must never look like it has settled.
  const scale = interpolate(local, [0, 1], [1.015, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ width, height, overflow: "hidden" }}>
      <Img
        src={staticFile("wall-montage.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "fill",
          transform: `scale(${scale})`,
          transformOrigin: "50% 50%",
        }}
      />
    </div>
  );
};
