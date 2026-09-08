import { Img, interpolate, staticFile } from "remotion";

import { WALL_TILES, WALL_GRID_W, WALL_GRID_H } from "../world";
import { STROKE } from "../tokens";
import type { WorldObjectComponent } from "./primitives";

/**
 * Sixty plans, at the furthest point of the pull-back.
 *
 * ── What this beat may and may not say ────────────────────────────────────
 *
 * These are rasters from a recorded offline designer benchmark run. B10 forbids
 * presenting that eval as a public benchmark or attaching a score to it, and
 * B9 forbids claiming a model-loop gain in either direction. The source library
 * adds its own rule: montage only, never present a single one as a showcase
 * plan. So this station carries NO text, NO number and NO count — not in the
 * component, not in script.json, not in a caption. Showing the volume and
 * saying nothing is the only honest treatment, and it is also the strongest:
 * the film has spent sixty seconds on one drawing, and this is the moment you
 * see there are always more.
 *
 * ── Masonry, not a grid ───────────────────────────────────────────────────
 *
 * The tiles share a width (1536 native) and nothing else: heights run 1086 to
 * 2172 across six size classes, because a taller plan is a taller drawing. A
 * fixed-height grid would have to letterbox or crop most of the set, and
 * cropping a plan raster is exactly what law 2 exists to prevent. The packing —
 * ten columns, longest-processing-time assignment, deterministic ties — is done
 * in `world.ts` at module scope from the ledger, so this component computes
 * nothing and a re-sync of the library cannot silently leave it with two empty
 * columns.
 */
export const PlanWall: WorldObjectComponent = ({ width, height, local, palette }) => {
  const sx = width / WALL_GRID_W;
  const sy = height / WALL_GRID_H;

  return (
    <div style={{ width, height, position: "relative" }}>
      {WALL_TILES.map((tile, i) => {
        // A staggered settle by column, so the wall assembles as the camera
        // arrives rather than being simply present. Left-to-right, because the
        // camera is still travelling when the first column lands.
        const delay = tile.col * 0.035;
        const p = interpolate(local, [delay, delay + 0.32], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={tile.name}
            style={{
              position: "absolute",
              left: tile.x * sx,
              top: tile.y * sy,
              width: tile.w * sx,
              height: tile.h * sy,
              opacity: p,
              overflow: "hidden",
              background: palette.card,
              outline: `${STROKE.hair}px solid ${palette.line}`,
              outlineOffset: -STROKE.hair,
            }}
          >
            <Img
              src={staticFile(`wall/${tile.name}`)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              // Sixty images is a lot to hold at once; the wall is only ever
              // seen at a scale where a tile is a few hundred pixels wide.
              loading={i < 20 ? "eager" : "lazy"}
            />
          </div>
        );
      })}
    </div>
  );
};
