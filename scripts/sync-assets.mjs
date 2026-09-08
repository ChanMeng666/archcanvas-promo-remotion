#!/usr/bin/env node
/**
 * sync-assets.mjs — stage the film's raw material into `public/` and write the ledger.
 *
 * Nothing in this film is shot for it. Every drawing, rendering, screen capture and
 * sound already exists in the first film's repo (`../archcanvas-promo-video`), which is
 * live and must not be modified: this script COPIES, never moves.
 *
 * It does two things:
 *
 *   1. Stages a flat, purposeful tree under `public/` (gitignored, regenerable).
 *   2. Rewrites `src/data/assets.json` — the tracked ledger recording exactly which
 *      bytes the film was cut from (path, size, sha256, native pixel size, duration).
 *
 * Idempotent: a destination whose sha256 already matches the source is skipped, so a
 * re-run with nothing changed leaves `src/data/assets.json` byte-identical. `--force`
 * recopies everything.
 *
 * Requires `ffprobe` on PATH for raster/video measurement. Node builtins otherwise.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const LEDGER = path.join(ROOT, "src", "data", "assets.json");
const FORCE = process.argv.includes("--force");

/** Absolute path, forward slashes — stable in the ledger diff, still absolute on Windows. */
const slash = (p) => p.split(path.sep).join("/");

function die(message) {
  console.error(`\nsync-assets: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The source library
// ---------------------------------------------------------------------------

/**
 * Resolve the first film's repo. `ARCHCANVAS_PROMO_REPO` if set, otherwise the sibling
 * directory. Validated by its inventory doc.
 *
 * Two things are deliberate here. Staging a stub is fatal, not a warning: a film cut from
 * placeholder material renders perfectly and ships wrong. And an ARCHCANVAS_PROMO_REPO
 * that is set but does not validate is ALSO fatal — it never falls through to the sibling,
 * because someone who pointed this at a specific checkout would otherwise get a film
 * quietly cut from a different one.
 */
const MARKER = path.join("capture", "extracted", "asset-descriptions.md");
const isSourceRepo = (dir) => fs.existsSync(path.join(dir, MARKER));

function resolveSourceRepo() {
  const override = process.env.ARCHCANVAS_PROMO_REPO;
  if (override) {
    const dir = path.resolve(override);
    if (isSourceRepo(dir)) return dir;
    die(
      [
        `ARCHCANVAS_PROMO_REPO is set to ${slash(dir)}, which is not the source library.`,
        `It must contain ${slash(MARKER)} — the canonical inventory of what this film is cut from.`,
        "",
        "Not falling back to ../archcanvas-promo-video: you named a checkout, and silently",
        "cutting the film from a different one is worse than not cutting it at all.",
      ].join("\n"),
    );
  }

  const sibling = path.resolve(ROOT, "..", "archcanvas-promo-video");
  if (isSourceRepo(sibling)) return sibling;

  die(
    [
      "could not find the source library.",
      "",
      `Looked in ${slash(sibling)} for ${slash(MARKER)} and did not find it.`,
      "Set ARCHCANVAS_PROMO_REPO to the checkout. There is no fallback: every frame of this",
      "film is real product output, so a stub source is worse than no film.",
    ].join("\n"),
  );
}

const SOURCE = resolveSourceRepo();
const from = (...parts) => path.join(SOURCE, ...parts);

// ---------------------------------------------------------------------------
// What gets staged
// ---------------------------------------------------------------------------

const CAP = "capture/assets"; // the complete set; `assets/` is a partial mirror missing c09

/**
 * Declarative manifest. `dest` is relative to `public/`; `src` is relative to the
 * source repo. Order here is the ledger's order (each group re-sorted by id below).
 */
const GROUPS = [
  {
    role: "plan",
    label: "plans",
    dest: "plans",
    note: "ArchLang-compiled drawings, straight out of the product. Resolution-independent.",
    items: [
      // The hero drawing: 9 rooms, 121.5 m², 11 windows, 1 storey.
      { id: "plan-family-house", src: `${CAP}/plan-family-house.svg` },
      { id: "plan-family-house-annotated", src: `${CAP}/plan-family-house-annotated.svg` },
      { id: "plan-family-house-sheet", src: `${CAP}/plan-family-house-sheet.svg` },
      // The drawing the filmed session itself produced: 6 rooms, 109.8 m².
      { id: "plan-hero", src: "assets/plan-hero.svg" },
    ],
  },
  {
    role: "render",
    label: "renders",
    dest: "renders",
    note: "Photoreal renderings, each grounded on a raster of ITS OWN plan (the family house).",
    items: [
      { id: "render-family-house-aerial", src: `${CAP}/render-family-house-aerial.webp` },
      { id: "render-family-house-exterior", src: `${CAP}/render-family-house-exterior.webp` },
      { id: "render-family-house-interior", src: `${CAP}/render-family-house-interior.webp` },
    ],
  },
  {
    role: "clip",
    label: "clips",
    dest: "clips",
    note: "OBS capture of the live product, cropped to 1786x944, decimated to 30fps, no audio.",
    items: [
      { id: "c05-fit", src: `${CAP}/videos/c05-fit.mp4` },
      { id: "c06-review-pins", src: `${CAP}/videos/c06-review-pins.mp4` },
      { id: "c07-edit-type", src: `${CAP}/videos/c07-edit-type.mp4` },
      { id: "c08-morph", src: `${CAP}/videos/c08-morph.mp4` },
      { id: "c10-select-room", src: `${CAP}/videos/c10-select-room.mp4` },
      { id: "c11-shrink-result", src: `${CAP}/videos/c11-shrink-result.mp4` },
      { id: "c13-timeline", src: `${CAP}/videos/c13-timeline.mp4` },
      { id: "c15-render-full", src: `${CAP}/videos/c15-render-full.mp4` },
    ],
  },
  {
    role: "brand",
    label: "brand",
    dest: "brand",
    note: "The brand marks. Resolution-independent.",
    items: [
      { id: "archcanvas-icon", src: `${CAP}/archcanvas-icon.svg` },
      { id: "archcanvas-wordmark", src: `${CAP}/archcanvas-wordmark.svg` },
    ],
  },
  {
    role: "audio",
    label: "audio",
    dest: "audio",
    note: "bgm.mp3 is a PLACEHOLDER until the founder delivers a new SUNO track.",
    items: [
      { id: "bgm", src: "audio/bgm.mp3" },
      { id: "sfx-instrument", src: "audio/sfx-instrument.mp3" },
      { id: "sfx-paper-settle", src: "audio/sfx-paper-settle.mp3" },
      { id: "sfx-paper-sweep", src: "audio/sfx-paper-sweep.mp3" },
      { id: "sfx-pencil-line", src: "audio/sfx-pencil-line.mp3" },
      { id: "sfx-stamp", src: "audio/sfx-stamp.mp3" },
      { id: "sfx-tick", src: "audio/sfx-tick.mp3" },
      { id: "sfx-ui-click", src: "audio/sfx-ui-click.mp3" },
      { id: "sfx-warm-swell", src: "audio/sfx-warm-swell.mp3" },
    ],
  },
];

/** The plan wall: 60 rasterised plans from one recorded designer benchmark run. */
const WALL_SRC_DIR = `${CAP}/_archcanvas-library/bench`;

/**
 * Staged outside `public/` — a raw input, not something the film loads with
 * `staticFile()`. Gitignored here as it is there.
 */
const SOURCES = [
  { id: "drafting-room-full", role: "audio", dest: "audio/source", src: "audio/source/drafting-room-full.mp3" },
];

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

let ffprobeChecked = false;
function ffprobe(file) {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    ffprobeChecked = true;
    return JSON.parse(out);
  } catch (err) {
    if (!ffprobeChecked && (err.code === "ENOENT" || /not recognized|not found/i.test(String(err.message)))) {
      die("ffprobe is not on PATH. It measures every raster and clip; guessed dimensions are not acceptable.");
    }
    die(`ffprobe failed on ${slash(file)}: ${err.message.split("\n")[0]}`);
  }
}

/** Parse the root <svg> element's viewBox and intrinsic width/height. */
function measureSvg(file) {
  const head = fs.readFileSync(file, "utf8").slice(0, 4096);
  const open = head.match(/<svg\b[^>]*>/i);
  if (!open) die(`${slash(file)}: no <svg> element in the first 4KB.`);
  const tag = open[0];

  const attr = (name) => {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
    return m ? m[1].trim() : null;
  };

  const rawViewBox = attr("viewBox");
  if (!rawViewBox) die(`${slash(file)}: <svg> has no viewBox.`);
  const viewBox = rawViewBox.split(/[\s,]+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n))) {
    die(`${slash(file)}: unparseable viewBox "${rawViewBox}".`);
  }

  const px = (raw) => {
    if (raw === null) return null;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  };
  const width = px(attr("width"));
  const height = px(attr("height"));
  if (width === null || height === null) {
    die(`${slash(file)}: <svg> has no intrinsic width/height attributes.`);
  }

  return { width, height, viewBox, durationSec: null, fps: null, resolutionBound: false };
}

function measureRaster(file) {
  const probe = ffprobe(file);
  const v = (probe.streams ?? []).find((s) => s.codec_type === "video");
  if (!v) die(`${slash(file)}: ffprobe found no video stream.`);
  return {
    width: Number(v.width),
    height: Number(v.height),
    viewBox: null,
    durationSec: null,
    fps: null,
    resolutionBound: true,
  };
}

function measureClip(file) {
  const probe = ffprobe(file);
  const streams = probe.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  if (!v) die(`${slash(file)}: ffprobe found no video stream.`);
  const [num, den] = String(v.avg_frame_rate ?? v.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    width: Number(v.width),
    height: Number(v.height),
    viewBox: null,
    durationSec: Number(probe.format.duration),
    fps: den ? num / den : null,
    resolutionBound: true,
    codec: v.codec_name,
    frames: v.nb_frames === undefined ? null : Number(v.nb_frames),
    // Every clip is silent. Wiring an <Audio> to one of these gets you nothing.
    hasAudioStream: streams.some((s) => s.codec_type === "audio"),
  };
}

function measureAudio(file) {
  const probe = ffprobe(file);
  return {
    width: null,
    height: null,
    viewBox: null,
    durationSec: Number(probe.format.duration),
    fps: null,
    resolutionBound: false,
  };
}

function measure(role, file) {
  if (path.extname(file).toLowerCase() === ".svg") return measureSvg(file);
  if (role === "clip") return measureClip(file);
  if (role === "audio") return measureAudio(file);
  return measureRaster(file);
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const stats = { copied: 0, skipped: 0, bytes: 0 };

/** Copy `srcAbs` to `dstAbs` unless the destination already holds the same bytes. */
function stage(srcAbs, dstAbs) {
  if (!fs.existsSync(srcAbs)) {
    die(`missing in the source library: ${slash(srcAbs)}`);
  }
  const srcHash = sha256(srcAbs);
  const fresh = !FORCE && fs.existsSync(dstAbs) && fs.statSync(dstAbs).size === fs.statSync(srcAbs).size && sha256(dstAbs) === srcHash;

  if (fresh) {
    stats.skipped += 1;
  } else {
    fs.mkdirSync(path.dirname(dstAbs), { recursive: true });
    fs.copyFileSync(srcAbs, dstAbs);
    stats.copied += 1;
  }
  const bytes = fs.statSync(dstAbs).size;
  stats.bytes += bytes;
  return { bytes, sha256: srcHash, copied: !fresh };
}

function stageRow({ id, role, src, destRel }) {
  const srcAbs = from(src);
  const dstAbs = path.join(PUBLIC_DIR, destRel);
  const { bytes, sha256: hash } = stage(srcAbs, dstAbs);
  const m = measure(role, dstAbs);
  return {
    id,
    src: destRel,
    role,
    bytes,
    sha256: hash,
    width: m.width,
    height: m.height,
    ...(m.viewBox ? { viewBox: m.viewBox } : {}),
    durationSec: m.durationSec,
    fps: m.fps,
    ...(m.codec ? { codec: m.codec } : {}),
    ...(m.frames !== undefined && m.frames !== null ? { frames: m.frames } : {}),
    ...(m.hasAudioStream === undefined ? {} : { hasAudioStream: m.hasAudioStream }),
    resolutionBound: m.resolutionBound,
    from: slash(srcAbs),
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log(`sync-assets: source = ${slash(SOURCE)}${FORCE ? "  (--force)" : ""}`);
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const assets = [];
const groupSummaries = [];

for (const group of GROUPS) {
  const before = { copied: stats.copied, skipped: stats.skipped, bytes: stats.bytes };
  const rows = [...group.items]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((item) =>
      stageRow({
        id: item.id,
        role: group.role,
        src: item.src,
        destRel: `${group.dest}/${path.basename(item.src)}`,
      }),
    );
  assets.push(...rows);
  groupSummaries.push({
    label: group.label,
    dest: `public/${group.dest}/`,
    n: rows.length,
    copied: stats.copied - before.copied,
    skipped: stats.skipped - before.skipped,
    bytes: stats.bytes - before.bytes,
  });
}

// The plan wall — 60 files, treated as one montage.
const wallSrcDir = from(WALL_SRC_DIR);
if (!fs.existsSync(wallSrcDir)) die(`missing in the source library: ${slash(wallSrcDir)}`);
const wallNames = fs
  .readdirSync(wallSrcDir)
  .filter((n) => n.toLowerCase().endsWith(".png"))
  .sort();
if (wallNames.length === 0) die(`no PNGs under ${slash(wallSrcDir)}`);

const wallBefore = { copied: stats.copied, skipped: stats.skipped, bytes: stats.bytes };
const wallFiles = wallNames.map((name) => {
  const dstAbs = path.join(PUBLIC_DIR, "wall", name);
  const { bytes, sha256: hash } = stage(path.join(wallSrcDir, name), dstAbs);
  const m = measureRaster(dstAbs);
  return { name, bytes, sha256: hash, width: m.width, height: m.height };
});
groupSummaries.push({
  label: "wall",
  dest: "public/wall/",
  n: wallFiles.length,
  copied: stats.copied - wallBefore.copied,
  skipped: stats.skipped - wallBefore.skipped,
  bytes: stats.bytes - wallBefore.bytes,
});

const wallWidths = [...new Set(wallFiles.map((f) => f.width))].sort((a, b) => a - b);
const wallHeights = [...new Set(wallFiles.map((f) => f.height))].sort((a, b) => a - b);
// Every tile is 1536 wide; the heights vary because a plan is rasterised at its own aspect.
// Lay the wall out on a fixed COLUMN WIDTH, never a fixed tile height.
const wallSizeClasses = Object.entries(
  wallFiles.reduce((acc, f) => {
    const key = `${f.width}x${f.height}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {}),
)
  .map(([size, count]) => ({ size, count }))
  .sort((a, b) => (a.size < b.size ? -1 : a.size > b.size ? 1 : 0));

const wall = {
  $comment:
    "60 rasterised plans from one recorded designer benchmark run. Real machine output, not " +
    "curated: this is a montage, and no single tile may be presented as a showcase plan. " +
    "Each row lives at public/wall/<name> and is verified individually like any other ledger row. " +
    "Uniform width, RAGGED HEIGHT (see sizeClasses) — lay it out on a fixed column width.",
  role: "wall",
  dest: "wall",
  count: wallFiles.length,
  totalBytes: wallFiles.reduce((n, f) => n + f.bytes, 0),
  resolutionBound: true,
  durationSec: null,
  fps: null,
  uniformWidth: wallWidths.length === 1,
  uniformHeight: wallHeights.length === 1,
  width: wallWidths.length === 1 ? wallWidths[0] : null,
  height: wallHeights.length === 1 ? wallHeights[0] : null,
  heightRange: [wallHeights[0], wallHeights[wallHeights.length - 1]],
  sizeClasses: wallSizeClasses,
  fromDir: slash(wallSrcDir),
  files: wallFiles,
};

// Off-`public/` raw sources.
const sourcesBefore = { copied: stats.copied, skipped: stats.skipped, bytes: stats.bytes };
const sources = SOURCES.map((item) => {
  const srcAbs = from(item.src);
  const destRel = `${item.dest}/${path.basename(item.src)}`;
  const dstAbs = path.join(ROOT, destRel);
  const { bytes, sha256: hash } = stage(srcAbs, dstAbs);
  const m = measure(item.role, dstAbs);
  return {
    id: item.id,
    src: destRel,
    role: item.role,
    bytes,
    sha256: hash,
    width: m.width,
    height: m.height,
    durationSec: m.durationSec,
    fps: m.fps,
    resolutionBound: m.resolutionBound,
    from: slash(srcAbs),
  };
});
groupSummaries.push({
  label: "sources",
  dest: "audio/source/",
  n: sources.length,
  copied: stats.copied - sourcesBefore.copied,
  skipped: stats.skipped - sourcesBefore.skipped,
  bytes: stats.bytes - sourcesBefore.bytes,
});

// ---------------------------------------------------------------------------
// maxUpscale — the camera's hard ceiling, computed from the staged bytes
// ---------------------------------------------------------------------------

const rasters = [
  ...assets
    .filter((a) => a.resolutionBound)
    .map((a) => ({ id: a.id, role: a.role, nativeWidth: a.width, nativeHeight: a.height })),
  // The wall is one montage of same-width tiles; its narrowest tile is the whole group's ceiling.
  {
    id: "wall/*",
    role: "wall",
    nativeWidth: Math.min(...wallFiles.map((f) => f.width)),
    nativeHeight: Math.min(...wallFiles.map((f) => f.height)),
  },
];
const round2 = (n) => Math.round(n * 100) / 100;
const SAFE_FACTOR = 1.5;
const TARGET_W = 1920; // the widest master this film renders

// The raster that runs out of pixels first is the one the camera is actually bounded by.
const tightest = rasters.reduce((a, b) => (b.nativeWidth < a.nativeWidth ? b : a));
const renderRasters = rasters.filter((r) => r.role === "render");
const widestRender = renderRasters.reduce((a, b) => (b.nativeWidth > a.nativeWidth ? b : a));

const maxUpscale = {
  $comment:
    "The camera's hard ceiling, computed from the staged bytes — never guessed. A raster shown " +
    "wider than its native pixel width is being upscaled, and past roughly " +
    `${SAFE_FACTOR}x it visibly softens on a ${TARGET_W}px master. ANY COMPOSITION THAT ASKS FOR ` +
    `MORE THAN ~${SAFE_FACTOR}x ON A RASTER IS A DESIGN ERROR: bound the zoom, or reach for an ` +
    "SVG instead. Plans and brand marks are SVG, are resolution-independent and have no ceiling " +
    "at all — every row carries resolutionBound saying which it is. Read maxSafeDisplayWidth per " +
    "raster; tightestRaster is the one the pull-back runs out of pixels on first.",
  safeFactor: SAFE_FACTOR,
  targetCompositionWidth: TARGET_W,
  tightestRaster: {
    id: tightest.id,
    nativeWidth: tightest.nativeWidth,
    nativeHeight: tightest.nativeHeight,
    maxSafeDisplayWidth: Math.floor(tightest.nativeWidth * SAFE_FACTOR),
  },
  // Worked example: the renderings are the film's largest single images, and even they are
  // only a 1.25x upscale filling a 1920px master edge to edge.
  worked: {
    example: `${widestRender.id} is ${widestRender.nativeWidth}x${widestRender.nativeHeight}; shown ${TARGET_W}px wide that is`,
    upscale: round2(TARGET_W / widestRender.nativeWidth),
    verdict: TARGET_W / widestRender.nativeWidth <= SAFE_FACTOR ? "inside the ceiling" : "OVER the ceiling",
  },
  perRaster: rasters
    .map((r) => ({
      id: r.id,
      role: r.role,
      nativeWidth: r.nativeWidth,
      nativeHeight: r.nativeHeight,
      upscaleAtTargetWidth: round2(TARGET_W / r.nativeWidth),
      maxSafeDisplayWidth: Math.floor(r.nativeWidth * SAFE_FACTOR),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
};

// ---------------------------------------------------------------------------
// Write the ledger
// ---------------------------------------------------------------------------

const byRole = {};
for (const a of assets) {
  byRole[a.role] ??= { files: 0, bytes: 0 };
  byRole[a.role].files += 1;
  byRole[a.role].bytes += a.bytes;
}
byRole.wall = { files: wall.count, bytes: wall.totalBytes };

const ledger = {
  $comment: [
    "WRITTEN BY scripts/sync-assets.mjs — NEVER HAND-EDIT.",
    "",
    "This is the film's ledger: the record of exactly which bytes it was cut from. Every row",
    "names a file staged into public/ (gitignored, regenerable) out of the first film's repo,",
    "with its size, sha256 and machine-measured native dimensions. public/ is not tracked;",
    "this file is, so a diff here is the reviewable record of a change in the raw material.",
    "",
    "Nothing on screen is mocked up (CLAUDE.md law 2). If a drawing, rendering or clip is not",
    "in this ledger, it did not come out of the product and it does not belong in the film.",
    "",
    "Regenerate with `npm run sync:assets`. Verify with `npm run verify:assets` — Remotion",
    "fails SOFTLY on a missing staticFile(), so an unverified render can ship with a hole in it.",
    "",
    "Shape: `assets` are individual files under public/<src>. `wall` groups 60 montage tiles",
    "under public/wall/<files[].name> (same guarantees, compact form). `sources` are raw inputs",
    "staged OUTSIDE public/, relative to the repo root — they are not loadable with staticFile().",
  ].join("\n"),
  generatedBy: "scripts/sync-assets.mjs",
  sourceRepo: slash(SOURCE),
  maxUpscale,
  totals: {
    files: assets.length + wall.count + sources.length,
    bytes: assets.reduce((n, a) => n + a.bytes, 0) + wall.totalBytes + sources.reduce((n, s) => n + s.bytes, 0),
    byRole,
  },
  assets,
  wall,
  sources,
};

fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
const json = `${JSON.stringify(ledger, null, 2)}\n`;
const unchanged = fs.existsSync(LEDGER) && fs.readFileSync(LEDGER, "utf8") === json;
fs.writeFileSync(LEDGER, json, { encoding: "utf8" });

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
for (const g of groupSummaries) {
  console.log(
    `  ${g.label.padEnd(9)} ${String(g.n).padStart(3)} files  ${mb(g.bytes).padStart(9)}  -> ${g.dest.padEnd(16)} ${g.copied} copied, ${g.skipped} skipped`,
  );
}
console.log(
  `  ${"TOTAL".padEnd(9)} ${String(stats.copied + stats.skipped).padStart(3)} files  ${mb(stats.bytes).padStart(9)}  (${stats.bytes} bytes)  ${stats.copied} copied, ${stats.skipped} skipped`,
);
console.log(`  ledger     src/data/assets.json ${unchanged ? "unchanged" : "rewritten"} (${json.length} bytes)`);
