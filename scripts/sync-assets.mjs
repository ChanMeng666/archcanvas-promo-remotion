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

import { execFileSync, spawnSync } from "node:child_process";
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
  // NO AUDIO GROUP, AND THAT IS DELIBERATE.
  //
  // The first film's bed and its eight sound effects used to be staged here.
  // Every one of those eight was generated through ElevenLabs, and on
  // 2026-09-08 the key they came from was found to be a FREE tier, whose plan
  // carries no commercial licence -- with the clause that content created
  // outside a paid subscription, before or after, cannot be used commercially.
  // See docs/decisions.md D11.
  //
  // This film's audio is one file: public/audio/bgm.mp3, cut by
  // tools/prepare-bed.ps1 from the founder's own SUNO take. Nothing about it
  // comes from the source library, so nothing about it is synced. Re-adding an
  // audio group here would silently re-stage the retired effects and overwrite
  // the bed -- which is exactly what happened once, on the run that removed
  // them.
];

/** The plan wall: 60 rasterised plans from one recorded designer benchmark run. */
const WALL_SRC_DIR = `${CAP}/_archcanvas-library/bench`;

/**
 * Staged outside `public/` — a raw input, not something the film loads with
 * `staticFile()`. Gitignored here as it is there.
 */
// Empty for the same reason: `audio/source/drafting-room-full.mp3` is the FIRST
// film's SUNO take and this film is not cut from it. This film's source take,
// `audio/source/confident-arrival.mp3`, is tracked in git rather than synced --
// SUNO will not return the same track twice, so it is irreplaceable, not
// regenerable, and a sync source is the wrong home for it.
const SOURCES = [];

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

/**
 * The wall tiles are DOWNSCALED on the way in, and that is not an optimisation
 * detail -- it is the difference between a film that renders and one that does
 * not.
 *
 * The sixty tiles are 1536 wide and up to 2172 tall: about 3.3 megapixels each,
 * 200 megapixels across the set. They are mounted together (the wall is one
 * world object) and every one registers its own delayRender, so at full size a
 * still render died with "delayRender was called but not cleared after
 * 118000ms" on a single tile while the rest were still decoding.
 *
 * WALL_TILE_W is 640 because the widest shot in the film puts a tile at roughly
 * 170 screen pixels in the 1920 master -- 640 is nearly four times what the
 * frame can show, which is headroom, not fidelity lost. It is also why this is
 * legitimate rather than a shortcut: the source library's rule for these rasters
 * is MONTAGE ONLY, never present one as a showcase plan, so no frame of this
 * film ever asks a tile for detail it no longer has. Nothing is cropped; the
 * aspect ratio of every tile is preserved, which is the part law 2 cares about.
 */
const WALL_TILE_W = 640;

function stageWallTile(srcAbs, dstAbs) {
  if (!fs.existsSync(srcAbs)) die(`missing in the source library: ${slash(srcAbs)}`);
  if (!FORCE && fs.existsSync(dstAbs)) {
    const w = measureRaster(dstAbs).width;
    if (w === WALL_TILE_W) {
      stats.skipped += 1;
      const bytes = fs.statSync(dstAbs).size;
      stats.bytes += bytes;
      return { bytes, sha256: sha256(dstAbs) };
    }
  }
  fs.mkdirSync(path.dirname(dstAbs), { recursive: true });
  // -1 keeps the aspect ratio and rounds to an even height; the tiles are
  // ragged by design and a forced height would letterbox or crop them.
  const r = spawnSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", srcAbs, "-vf", `scale=${WALL_TILE_W}:-1:flags=lanczos`, dstAbs],
    { encoding: "utf8" }
  );
  if (r.status !== 0) die(`ffmpeg failed on ${slash(srcAbs)}: ${(r.stderr || "").trim().split(String.fromCharCode(10))[0]}`);
  stats.copied += 1;
  const bytes = fs.statSync(dstAbs).size;
  stats.bytes += bytes;
  return { bytes, sha256: sha256(dstAbs) };
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
    provenance: "source-library",
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

// Read before anything overwrites it: the tracked ledger is this script's only memory of
// generated assets, which have no other durable copy.
const previousLedger = (() => {
  if (!fs.existsSync(LEDGER)) return null;
  try {
    return JSON.parse(fs.readFileSync(LEDGER, "utf8"));
  } catch {
    return null; // an unreadable ledger is rebuilt from scratch; verify-assets reports it
  }
})();

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

// ---------------------------------------------------------------------------
// Locally generated audio — adopted into the ledger, not copied from the source
// ---------------------------------------------------------------------------
//
// `scripts/generate-sfx.mjs` (ElevenLabs) writes cues this film needs that the first film
// never had. They are ledgered here for one reason: verify-assets is the only thing
// standing between a truncated asset and a render that ships with a silent hole in it, and
// it can only protect what the ledger names.
//
// The registry is `public/audio/` ITSELF — every mp3 there that did not come from the
// source library. It is deliberately NOT a durable copy under repo-root `audio/`: that was
// tried, and repo-root `audio/` is gitignored only at `audio/source/*`, so those files were
// on track to be committed as ~528 KB of permanent tracked binaries. `public/audio/` is now
// their ONLY home, and `"from": null` on a generated row is the intended steady state, not
// a gap to be closed. A stray mp3 back at repo root is warned about below for that reason.
//
// Which makes these four the most fragile bytes in the repo: gitignored, with no local
// copy, and unreproducible — a rerun costs four ElevenLabs requests and returns a
// DIFFERENT sound, because only the prompt is deterministic, not the audio. So:
//
//   - This staging is ADDITIVE. Nothing in this script ever deletes.
//   - The previous ledger is the tripwire. `src/data/assets.json` IS tracked, so it
//     remembers these rows even when public/ does not. A generated row that was in the
//     last ledger and has no file now is a HARD FAILURE, never a silent drop — because
//     the alternative is a sync that reports success while quietly forgetting four
//     irreplaceable files. That is not hypothetical: keying this off repo-root `audio/`
//     did exactly that once, and wiping public/audio/ did it again, both reporting green.
//     Override with --drop-generated only when removing a cue is what you actually meant.
//
// `audio/source/` is not scanned: those are raw inputs, staged separately below.

const DURABLE_AUDIO_DIR = path.join(ROOT, "audio");
const STAGED_AUDIO_DIR = path.join(PUBLIC_DIR, "audio");
const stagedBasenames = new Set(assets.map((a) => path.basename(a.src)));
const generatedBefore = { copied: stats.copied, skipped: stats.skipped, bytes: stats.bytes };

const listMp3 = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".mp3"))
        .map((e) => e.name)
        .sort()
    : [];

// Repo-root `audio/` is gitignored only at `audio/source/*`, so an mp3 sitting directly in
// it is bound for a permanent place in git history. Staging it is still the right call —
// bytes the film loads must be ledgered — but say so, because this is a trap the project
// has already fallen into once.
const durableStrays = listMp3(DURABLE_AUDIO_DIR);
if (durableStrays.length > 0) {
  console.log(
    `  ! ${durableStrays.length} mp3(s) directly in audio/ (${durableStrays.join(", ")}) are NOT gitignored ` +
      "— only audio/source/* is. They will be committed as tracked binaries unless moved or ignored.",
  );
}

const generatedNames = [...new Set([...listMp3(STAGED_AUDIO_DIR), ...listMp3(DURABLE_AUDIO_DIR)])]
  .filter((name) => !stagedBasenames.has(name))
  .sort();

// The tripwire covers EVERY row this repo produced rather than copied — generated audio
// and locally cut footage alike. A source-library row heals from ../archcanvas-promo-video
// on the next sync; these do not. Losing one is unrecoverable, so a sync that would write a
// ledger forgetting it refuses instead.
const DROP_GENERATED = process.argv.includes("--drop-generated");
const previousLocal = (previousLedger?.assets ?? []).filter(
  (a) => a.provenance && a.provenance !== "source-library",
);
const lostLocal = previousLocal.filter((a) => !fs.existsSync(path.join(PUBLIC_DIR, a.src)));

if (lostLocal.length > 0 && !DROP_GENERATED) {
  const cues = lostLocal.filter((a) => a.provenance === "generated");
  const cuts = lostLocal.filter((a) => a.provenance === "cut");
  die(
    [
      `${lostLocal.length} locally produced asset(s) are in the committed ledger but missing from public/:`,
      "",
      ...lostLocal.map(
        (a) => `  ${a.src}  ${a.bytes} bytes  ${a.durationSec ?? "-"}s  [${a.provenance}]  sha256 ${a.sha256}`,
      ),
      "",
      ...(cues.length > 0
        ? [
            "The generated cues have no durable copy: re-running scripts/generate-sfx.mjs costs",
            "ElevenLabs requests and returns a DIFFERENT sound, because the prompt is deterministic",
            "but the audio is not.",
          ]
        : []),
      ...(cuts.length > 0
        ? [
            "The cut footage can be remade by scripts/cut-clips.mjs, but ONLY while the ~926 MB raw",
            "takes are still on disk outside the repo. Nothing in git can rebuild them.",
          ]
        : []),
      "",
      "Refusing to write a ledger that silently forgets them. Restore the files, or pass",
      "--drop-generated if dropping them is genuinely what you meant.",
    ].join("\n"),
  );
}
if (lostLocal.length > 0) {
  console.log(`  (--drop-generated) dropping ${lostLocal.length} missing locally produced asset(s) from the ledger`);
}

const generatedRows = generatedNames.map((name) => {
  const destRel = `audio/${name}`;
  const dstAbs = path.join(PUBLIC_DIR, destRel);
  const durable = path.join(DURABLE_AUDIO_DIR, name);

  // Prefer the durable copy when there is one; otherwise the staged file IS the only copy.
  if (fs.existsSync(durable)) stage(durable, dstAbs);
  else {
    const bytes = fs.statSync(dstAbs).size;
    stats.skipped += 1;
    stats.bytes += bytes;
  }

  const m = measureAudio(dstAbs);
  return {
    id: name.replace(/\.mp3$/i, ""),
    src: destRel,
    role: "audio",
    provenance: "generated",
    bytes: fs.statSync(dstAbs).size,
    sha256: sha256(dstAbs),
    width: null,
    height: null,
    durationSec: m.durationSec,
    fps: null,
    resolutionBound: false,
    // Where a re-sync would restore it from, or null when the staged file is the only copy.
    from: fs.existsSync(durable) ? slash(durable) : null,
  };
});

// The cue list `scripts/generate-sfx.mjs` published, cross-checked against what is on disk.
// A cue named there with no file is the blank-region failure this whole gate exists to stop.
const SFX_MANIFEST = path.join(STAGED_AUDIO_DIR, "sfx-manifest.json");
if (fs.existsSync(SFX_MANIFEST)) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(SFX_MANIFEST, "utf8"));
  } catch (err) {
    die(`public/audio/sfx-manifest.json is not valid JSON: ${String(err.message).split("\n")[0]}`);
  }
  const ledgered = new Set([...stagedBasenames, ...generatedNames]);
  const orphans = Object.entries(manifest.sfx ?? {})
    .map(([id, cue]) => cue.file ?? `${id}.mp3`)
    .filter((file) => !ledgered.has(file));
  if (orphans.length > 0) {
    die(
      `sfx-manifest.json names ${orphans.length} cue(s) with no file in public/audio/: ${orphans.join(", ")}. ` +
        "Re-run scripts/generate-sfx.mjs — Remotion renders these as silence, not as an error.",
    );
  }
}

// The plan-wall montage, composited from the sixty tiles by
// scripts/build-wall-montage.mjs. It is DERIVED, not generated in the
// irreplaceable sense — `node scripts/build-wall-montage.mjs` reproduces it
// byte-for-byte from files that are themselves synced — so its absence is a
// warning with the command to fix it, not the hard failure a lost audio cue is.
const MONTAGE_REL = "wall-montage.png";
const montageAbs = path.join(PUBLIC_DIR, MONTAGE_REL);
if (fs.existsSync(montageAbs)) {
  const m = measureRaster(montageAbs);
  const bytes = fs.statSync(montageAbs).size;
  stats.skipped += 1;
  stats.bytes += bytes;
  generatedRows.push({
    id: "wall-montage",
    src: MONTAGE_REL,
    role: "montage",
    provenance: "derived",
    from: null,
    bytes,
    sha256: sha256(montageAbs),
    width: m.width,
    height: m.height,
    durationSec: null,
    fps: null,
    resolutionBound: true,
    note: "The 60 bench rasters composited into one image at the positions world.ts packs them into. Rebuild with `node scripts/build-wall-montage.mjs`.",
  });
} else {
  warnings.push(
    `public/${MONTAGE_REL} is missing — the wall station will render a blank region. Run \`node scripts/build-wall-montage.mjs\`.`
  );
}

assets.push(...generatedRows);
groupSummaries.push({
  label: "generated",
  dest: "public/audio/ + public/",
  n: generatedRows.length,
  copied: stats.copied - generatedBefore.copied,
  skipped: stats.skipped - generatedBefore.skipped,
  bytes: stats.bytes - generatedBefore.bytes,
});

// ---------------------------------------------------------------------------
// Locally cut product footage — adopted, with its provenance from cut-clips.mjs
// ---------------------------------------------------------------------------
//
// `scripts/cut-clips.mjs` cuts this film's clips from the raw 1920x1080 OBS takes rather
// than inheriting the first film's 1786x944 crop, because here the recordings are cards in
// world space that the camera approaches, so source resolution is spent directly on screen.
// It writes public/clips/cut-manifest.json, and that provenance is copied onto each row
// below so a clip in the ledger is traceable to the second of the take it came from.
//
// Adopted the same way as generated audio, and for the same reason: verify-assets can only
// protect what the ledger names. The raw takes live OUTSIDE the repo, so these rows are not
// re-syncable and the tripwire above covers them.

const cutManifest = (() => {
  const f = path.join(PUBLIC_DIR, "clips", "cut-manifest.json");
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (err) {
    die(`public/clips/cut-manifest.json is not valid JSON: ${String(err.message).split("\n")[0]}`);
  }
})();

// Keyed by filename so each row can find its own provenance.
const cutByFile = new Map();
for (const [kind, entries] of [
  ["clip", cutManifest?.clips],
  ["still", cutManifest?.stills],
]) {
  for (const [id, e] of Object.entries(entries ?? {})) cutByFile.set(e.file, { id, kind, ...e });
}

const localBefore = { copied: stats.copied, skipped: stats.skipped, bytes: stats.bytes };

/** Adopt a file already sitting in public/ — this repo made it, there is nothing to copy. */
function adoptInPlace({ destRel, role, provenance, extra }) {
  const dstAbs = path.join(PUBLIC_DIR, destRel);
  const bytes = fs.statSync(dstAbs).size;
  stats.skipped += 1;
  stats.bytes += bytes;
  const m = measure(role, dstAbs);
  return {
    id: path.basename(destRel).replace(/\.[^.]+$/, ""),
    src: destRel,
    role,
    provenance,
    bytes,
    sha256: sha256(dstAbs),
    width: m.width,
    height: m.height,
    durationSec: m.durationSec,
    fps: m.fps,
    ...(m.codec ? { codec: m.codec } : {}),
    ...(m.frames !== undefined && m.frames !== null ? { frames: m.frames } : {}),
    ...(m.hasAudioStream === undefined ? {} : { hasAudioStream: m.hasAudioStream }),
    resolutionBound: m.resolutionBound,
    ...extra,
    from: null,
  };
}

const listFiles = (dirRel, ext) => {
  const dirAbs = path.join(PUBLIC_DIR, dirRel);
  return fs.existsSync(dirAbs)
    ? fs
        .readdirSync(dirAbs, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(ext))
        .map((e) => e.name)
        .sort()
    : [];
};

const inheritedClipNames = new Set(assets.filter((a) => a.role === "clip").map((a) => path.basename(a.src)));
const cutRows = [];

for (const name of listFiles("clips", ".mp4")) {
  if (inheritedClipNames.has(name)) continue; // staged from the source library above
  const prov = cutByFile.get(name);
  if (!prov) {
    die(
      `public/clips/${name} is not from the source library and is not in cut-manifest.json, so its ` +
        "provenance is unknown. Every frame of product footage must be traceable to a take and an " +
        "in-point — re-run `node scripts/cut-clips.mjs`, or delete the stray file.",
    );
  }
  cutRows.push(
    adoptInPlace({
      destRel: `clips/${name}`,
      role: "clip",
      provenance: "cut",
      extra: {
        cut: {
          station: prov.station,
          takeFile: prov.takeFile,
          startSec: prov.startSec,
          endSec: prov.endSec,
          sourceWindow: prov.sourceWindow,
          handleSec: prov.handleSec,
          crop: prov.crop,
          supersedes: prov.supersedes,
        },
      },
    }),
  );
}

for (const name of listFiles("stills", ".png")) {
  const prov = cutByFile.get(name);
  if (!prov) {
    die(
      `public/stills/${name} is not in cut-manifest.json, so its provenance is unknown. ` +
        "Re-run `node scripts/cut-clips.mjs`, or delete the stray file.",
    );
  }
  cutRows.push(
    adoptInPlace({
      destRel: `stills/${name}`,
      role: "still",
      provenance: "cut",
      extra: {
        cut: { station: prov.station, takeFile: prov.takeFile, atSec: prov.atSec, crop: prov.crop },
      },
    }),
  );
}

assets.push(...cutRows);
groupSummaries.push({
  label: "cut",
  dest: "public/clips|stills/",
  n: cutRows.length,
  copied: stats.copied - localBefore.copied,
  skipped: stats.skipped - localBefore.skipped,
  bytes: stats.bytes - localBefore.bytes,
});

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
  const { bytes, sha256: hash } = stageWallTile(path.join(wallSrcDir, name), dstAbs);
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
    provenance: "source-library",
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
    "Every row carries `provenance`. \"source-library\" means the bytes came out of",
    "../archcanvas-promo-video and a sync restores them. \"generated\" means a script in this repo",
    "made them (the ElevenLabs cues and voiceover). \"cut\" means scripts/cut-clips.mjs cut them",
    "from the raw OBS takes, and those rows carry a `cut` block naming the take, the in-point and",
    "the crop. Only source-library rows can be re-synced; the rest are unrecoverable if lost, and",
    "sync-assets refuses to write a ledger that forgets one.",
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
