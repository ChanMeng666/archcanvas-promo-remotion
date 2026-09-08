#!/usr/bin/env node
/**
 * Composite the 60 plan rasters into ONE image.
 *
 * Why this exists. The wall was sixty `<Img>` elements in one world object, and
 * Remotion registers a delayRender per image. Renders died with "delayRender was
 * called but not cleared after 118000ms" — always naming a different-but-
 * deterministic tile, because the named one is simply whichever sat last in a
 * load queue the browser never got to the end of. Downscaling the tiles to 640px
 * cut the decode from ~200 megapixels to ~22 and did not fix it: the problem is
 * the COUNT, not the pixels.
 *
 * A montage is a single static image that happens to be made of sixty pictures.
 * Building it once, offline, is what it always should have been.
 *
 * What this does NOT change: every tile is a real plan raster from the recorded
 * designer benchmark run, at its own aspect ratio, uncropped, in the position
 * world.ts packed it into. Nothing is invented and nothing is trimmed to fit —
 * which is the part CLAUDE.md law 2 cares about. The reveal that used to be a
 * per-column stagger is now the camera arriving on a finished wall, which is
 * also closer to the truth: the plans were all there before the film started.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCore } from "../capture/lib/load-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "wall-montage.png");

/**
 * 3560px wide, which is a deliberate halving of the tiles' own resolution.
 *
 * The widest shot in the film puts one tile at roughly 170 screen pixels in the
 * 1920 master. At this width a tile is ~320px, so there is nearly 2x headroom —
 * and the source library's rule for these rasters is montage only, never present
 * one as a showcase plan, so no frame ever asks a tile for more than that.
 */
const MONTAGE_W = 3560;

const { world } = await loadCore();
const tiles = world.WALL_TILES;
const gw = world.WALL_GRID_W;
const gh = world.WALL_GRID_H;
const k = MONTAGE_W / gw;
const H = Math.round(gh * k);

const args = ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=0x00000000:s=${MONTAGE_W}x${H}:d=1,format=rgba`];
for (const t of tiles) args.push("-i", path.join(ROOT, "public", "wall", t.name));

const parts = [];
let prev = "[0:v]";
tiles.forEach((t, i) => {
  const w = Math.max(1, Math.round(t.w * k));
  const h = Math.max(1, Math.round(t.h * k));
  const x = Math.round(t.x * k);
  const y = Math.round(t.y * k);
  parts.push(`[${i + 1}:v]scale=${w}:${h}[s${i}]`);
  const out = i === tiles.length - 1 ? "[out]" : `[b${i}]`;
  parts.push(`${prev}[s${i}]overlay=${x}:${y}${out}`);
  prev = `[b${i}]`;
});

args.push("-filter_complex", parts.join(";"), "-map", "[out]", "-frames:v", "1", OUT);
execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });

const bytes = fs.statSync(OUT).size;
console.log(`wall-montage.png  ${MONTAGE_W}x${H}  ${(bytes / 1024 / 1024).toFixed(1)} MB  from ${tiles.length} tiles`);
console.log("Now run: node scripts/sync-assets.mjs   (adopts it into the ledger)");
