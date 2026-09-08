#!/usr/bin/env node
/**
 * cut-clips.mjs — cut this film's product footage from the raw OBS takes.
 *
 * The first film's clips (staged by sync-assets.mjs) were cut to 1786x944 at 30fps and
 * then had to hide a surviving recording-indicator glow behind a ~3% inset zoom, which
 * costs picture again. In THIS film the product recordings are cards in world space that
 * the camera can approach, so source resolution is spent directly on screen. Every pixel
 * that crop threw away is one we might want back, so we cut our own from the 1920x1080
 * originals.
 *
 * What this does that a bare `ffmpeg -ss … -c copy` does not:
 *
 *   1. Re-encodes rather than stream-copies. OBS wrote a ~2s keyframe interval, so a
 *      copy-cut snaps to the nearest keyframe and can land two seconds from the beat.
 *   2. Decimates 60 -> 30fps. A clean 2:1 drop, not the judder a non-integer ratio gives.
 *   3. Crops the capture furniture — measured, not inherited. See CROP.
 *   4. Writes public/clips/cut-manifest.json, which sync-assets.mjs reads so every clip in
 *      the ledger is traceable to the second of the take it came from.
 *
 * The takes are ~926 MB and live outside the repo. Nothing here can be recovered from git
 * if both they and public/ are lost — sync-assets.mjs refuses to silently forget these
 * rows for that reason.
 *
 * Usage:
 *   node scripts/cut-clips.mjs --list          # print the cut list, cut nothing
 *   node scripts/cut-clips.mjs                 # cut everything missing
 *   node scripts/cut-clips.mjs --only note-pin --force
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CLIPS_DIR = path.join(ROOT, "public", "clips");
const STILLS_DIR = path.join(ROOT, "public", "stills");
const MANIFEST = path.join(CLIPS_DIR, "cut-manifest.json");

const argv = process.argv.slice(2);
const LIST = argv.includes("--list");
const FORCE = argv.includes("--force");
const ONLY = (() => {
  const i = argv.indexOf("--only");
  return i === -1 ? null : argv[i + 1];
})();

const slash = (p) => p.split(path.sep).join("/");
function die(message) {
  console.error(`\ncut-clips: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The takes
// ---------------------------------------------------------------------------

const TAKES = {
  t1: { file: "2026-09-08 02-10-39.mp4", durationSec: 617.716667, what: "dashboard, brief, generate, plan, review, edits" },
  t2: { file: "2026-09-08 02-21-10.mp4", durationSec: 389.290667, what: "selection, shrink, export, timeline, rendering" },
  t3: { file: "2026-09-08 02-35-12.mp4", durationSec: 70.516667, what: "LibreCAD opening the exported DXF" },
};

/**
 * Resolve the raw takes directory. `ARCHCANVAS_TAKES_DIR` if set, otherwise `D:\videos`.
 * Validated by the presence of all three takes.
 *
 * Fatal on failure, and an explicitly-set env var that does not validate never falls
 * through to the default — same rule as sync-assets.mjs and for the same reason: cutting
 * the film from the wrong footage is worse than not cutting it.
 */
function resolveTakesDir() {
  const hasAll = (dir) => Object.values(TAKES).every((t) => fs.existsSync(path.join(dir, t.file)));

  const override = process.env.ARCHCANVAS_TAKES_DIR;
  if (override) {
    const dir = path.resolve(override);
    if (hasAll(dir)) return dir;
    const missing = Object.values(TAKES).filter((t) => !fs.existsSync(path.join(dir, t.file)));
    die(
      [
        `ARCHCANVAS_TAKES_DIR is set to ${slash(dir)} but ${missing.length} take(s) are not there:`,
        ...missing.map((t) => `  ${t.file}`),
        "",
        "Not falling back to D:/videos: you named a directory, and cutting the film from",
        "different footage than you asked for is worse than not cutting it.",
      ].join("\n"),
    );
  }

  const fallback = path.resolve("D:/videos");
  if (hasAll(fallback)) return fallback;
  const missing = Object.values(TAKES).filter((t) => !fs.existsSync(path.join(fallback, t.file)));
  die(
    [
      `the raw takes are not in ${slash(fallback)} — ${missing.length} missing:`,
      ...missing.map((t) => `  ${t.file}`),
      "",
      "Set ARCHCANVAS_TAKES_DIR to wherever they are. There is no fallback and no stub:",
      "every frame of product footage in this film is real capture of the real product.",
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------
// The crop — measured on these takes, not inherited
// ---------------------------------------------------------------------------

/**
 * Two artefacts sit on the 1920x1080 take, and the numbers below were measured rather than
 * copied: R-B (redness) profiles per row and per column, averaged over 16 frames spread
 * across each take so that page content averages out and only the fixed overlays survive.
 *
 *   TOP — a foreign window, rows 0..35. Not a glow: an opaque pale-blue band carrying
 *   another app's text, a blue button and a close ×. Rows 0-17 read R-B ~ -18 with the
 *   variance of live content; rows 22-35 read exactly -10.0 with ZERO variance across all
 *   16 frames, i.e. a solid fill. Row 36 jumps to +21 with high variance — that is the
 *   product's own breadcrumb bar ("Dashboard / <project title>", Transcript, Share).
 *   So: crop 36, and KEEP the product bar. The first film cropped 104 to reach the canvas
 *   and deliberately discarded that bar; this film shows the product UI whole, so it stays.
 *
 *   THE OTHER THREE EDGES — a soft pink recording-indicator glow, strongest at the very
 *   edge and decaying inward to the page's own colour:
 *     left    R-B 45.5 at x=0, at the interior baseline (~2.3) by x~44
 *     right   R-B 38.6 at x=1919, at baseline (~2.7) by x~1871  -> crop 48
 *     bottom  R-B 6.5 at y=1079, at baseline (~3.3) by y~1051   -> crop 28, weakest edge
 *
 * There is no glow to remove along the top: rows 22-35 are a flat -10.0 with no pink
 * gradient at all, so the foreign window is the only top artefact.
 *
 * Every boundary lands on an even coordinate, which matters: the source is 4:2:0, so
 * chroma is shared between pixel PAIRS. Cropping at 36/44/48/28 keeps each retained pair
 * intact and prevents the artefacts bleeding into the first kept row or column via chroma.
 *
 * Result: 1828x1016 (aspect 1.799, near but not exactly 16:9 — the cards are placed at
 * their native aspect, so this is not corrected by squeezing real pixels away).
 * Against the inherited cut that is +42px of width and +72px of height, plus the product's
 * own top bar, plus no inset-zoom tax.
 */
const CROP = { top: 36, bottom: 28, left: 44, right: 48 };
const OUT_W = 1920 - CROP.left - CROP.right; // 1828
const OUT_H = 1080 - CROP.top - CROP.bottom; // 1016
const OUT_FPS = 30;

// ---------------------------------------------------------------------------
// The cut list
// ---------------------------------------------------------------------------

/**
 * Named by the STATION each moment serves in this film, not by the other project's
 * storyboard numbering — c06/c07/c10 are that film's frames and mean nothing here.
 * `supersedes` records which inherited clip a cut replaces, so the swap is auditable.
 *
 * Source windows come from ../archcanvas-promo-video/capture/cut-clips.mjs (chosen by
 * watching the take), widened by HANDLE seconds at each end and clamped to the take.
 * In-points are picked at composition time from inside the window, so the handles are the
 * point: they keep the choice open.
 */
const HANDLE = 3;

const CLIPS = [
  { id: "plan-fit", take: "t1", win: [170, 200], station: "plan", supersedes: "c05-fit",
    why: "fit to 168% — the whole drawing, dimensions legible" },
  { id: "note-pin", take: "t1", win: [262, 306], station: "note", supersedes: "c06-review-pins",
    why: "flag 5, the PROGRAM finding card, pins bloom, circulation overlay. The card is blank until ~276s and fully readable from ~282s — the film's one honesty claim lands here" },
  { id: "lineage-instruction", take: "t1", win: [350, 404], station: "lineage", supersedes: "c07-edit-type",
    why: "the instruction typed while the finding card is still on screen" },
  { id: "lineage-morph", take: "t1", win: [400, 450], station: "lineage", supersedes: "c08-morph",
    why: "the sheet morphs in place — one sheet, not a second card" },
  { id: "lineage-room-verbs", take: "t2", win: [8, 30], station: "lineage", supersedes: "c10-select-room",
    why: "room selected: Enlarge / Shrink / Merge with neighbor / Add window" },
  { id: "lineage-shrink", take: "t2", win: [84, 108], station: "lineage", supersedes: "c11-shrink-result",
    why: "the shrink lands; the plan is right at last" },
  { id: "lineage-timeline", take: "t2", win: [172, 216], station: "lineage", supersedes: "c13-timeline",
    why: "v4/4 and the rooms / area / brief chip — the drawing's own history" },
  { id: "pair-rendering", take: "t2", win: [288, 325], station: "pair", supersedes: "c15-render-full",
    why: "the rendering full-frame with the product's own always-on AI-generated pill (EU AI Act Art 50 — the film must carry provenance on any AI rendering, and the product's real pill beats one we draw)" },
];

/**
 * Frames exported as PNG rather than motion. At 1828px wide these are sharper than
 * anything the inherited 1786-wide clip can give, and a still serves a beat the camera
 * crosses without stopping better than motion does.
 */
const STILLS = [
  { id: "note-pin-card", take: "t1", atSec: 286, station: "note",
    why: "the PROGRAM finding card at full readability, cursor steady, card settled (blank at 272, settled by 284)" },
];

const withHandles = (c) => {
  const take = TAKES[c.take];
  const startSec = Math.max(0, c.win[0] - HANDLE);
  const endSec = Math.min(take.durationSec, c.win[1] + HANDLE);
  return { ...c, startSec, endSec, durationSec: +(endSec - startSec).toFixed(3) };
};

const CUTS = CLIPS.map(withHandles);
const selected = ONLY ? CUTS.filter((c) => c.id === ONLY) : CUTS;
const selectedStills = ONLY ? STILLS.filter((s) => s.id === ONLY) : STILLS;
if (ONLY && selected.length === 0 && selectedStills.length === 0) {
  die(`no clip or still called "${ONLY}". Run --list to see them.`);
}

// ---------------------------------------------------------------------------
// --list
// ---------------------------------------------------------------------------

if (LIST) {
  console.log(`\n  cut list — crop t${CROP.top} b${CROP.bottom} l${CROP.left} r${CROP.right} => ${OUT_W}x${OUT_H} @ ${OUT_FPS}fps, ${HANDLE}s handles\n`);
  for (const c of selected) {
    console.log(
      `  ${c.id.padEnd(20)} ${c.station.padEnd(8)} ${TAKES[c.take].file}  ${String(c.startSec).padStart(6)}s +${c.durationSec.toFixed(0)}s  (window ${c.win[0]}-${c.win[1]}, supersedes ${c.supersedes})`,
    );
    console.log(`      ${c.why}`);
  }
  if (selectedStills.length > 0) console.log("\n  stills\n");
  for (const s of selectedStills) {
    console.log(`  ${s.id.padEnd(20)} ${s.station.padEnd(8)} ${TAKES[s.take].file}  @${s.atSec}s`);
    console.log(`      ${s.why}`);
  }
  console.log("");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Cut
// ---------------------------------------------------------------------------

const TAKES_DIR = resolveTakesDir();
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  die("ffmpeg is not on PATH.");
}

console.log(`cut-clips: takes = ${slash(TAKES_DIR)}${FORCE ? "  (--force)" : ""}`);
console.log(`  crop t${CROP.top} b${CROP.bottom} l${CROP.left} r${CROP.right} -> ${OUT_W}x${OUT_H} @ ${OUT_FPS}fps${ONLY ? `  (--only ${ONLY})` : ""}`);
fs.mkdirSync(CLIPS_DIR, { recursive: true });
fs.mkdirSync(STILLS_DIR, { recursive: true });

const vf = `crop=${OUT_W}:${OUT_H}:${CROP.left}:${CROP.top},fps=${OUT_FPS}`;
let cut = 0;
let skipped = 0;
const manifestClips = {};
const manifestStills = {};

for (const c of selected) {
  const take = TAKES[c.take];
  const src = path.join(TAKES_DIR, take.file);
  const out = path.join(CLIPS_DIR, `${c.id}.mp4`);

  const record = () => {
    manifestClips[c.id] = {
      file: `${c.id}.mp4`,
      station: c.station,
      take: c.take,
      takeFile: take.file,
      startSec: c.startSec,
      endSec: c.endSec,
      durationSec: c.durationSec,
      sourceWindow: c.win,
      handleSec: HANDLE,
      crop: { ...CROP },
      output: { width: OUT_W, height: OUT_H, fps: OUT_FPS },
      supersedes: c.supersedes,
      why: c.why,
    };
  };

  if (fs.existsSync(out) && !FORCE) {
    console.log(`  · ${c.id.padEnd(20)} exists (${(fs.statSync(out).size / 1e6).toFixed(1)} MB) — --force to recut`);
    skipped += 1;
    record();
    continue;
  }

  // -ss BEFORE -i seeks by keyframe (fast); re-encoding then trims to the exact frame, so
  // this is both quick and frame-accurate. Output seeking here would decode the whole take.
  const r = spawnSync(
    "ffmpeg",
    [
      "-v", "error", "-y",
      "-ss", String(c.startSec), "-i", src, "-t", String(c.durationSec),
      "-vf", vf,
      "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-an", // the takes carry six aac streams of room noise; the film has its own audio
      out,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) die(`ffmpeg failed on ${c.id}: ${String(r.stderr).split("\n")[0]}`);

  console.log(`  ✓ ${c.id.padEnd(20)} ${c.durationSec.toFixed(0)}s  ${OUT_W}x${OUT_H}@${OUT_FPS}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  cut += 1;
  record();
}

for (const s of selectedStills) {
  const take = TAKES[s.take];
  const src = path.join(TAKES_DIR, take.file);
  const out = path.join(STILLS_DIR, `${s.id}.png`);

  const record = () => {
    manifestStills[s.id] = {
      file: `${s.id}.png`,
      station: s.station,
      take: s.take,
      takeFile: take.file,
      atSec: s.atSec,
      crop: { ...CROP },
      output: { width: OUT_W, height: OUT_H },
      why: s.why,
    };
  };

  if (fs.existsSync(out) && !FORCE) {
    console.log(`  · ${s.id.padEnd(20)} exists (${(fs.statSync(out).size / 1e6).toFixed(1)} MB) — --force to re-export`);
    skipped += 1;
    record();
    continue;
  }

  const r = spawnSync(
    "ffmpeg",
    [
      "-v", "error", "-y",
      "-ss", String(s.atSec), "-i", src, "-frames:v", "1",
      "-vf", `crop=${OUT_W}:${OUT_H}:${CROP.left}:${CROP.top}`,
      "-compression_level", "9",
      out,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) die(`ffmpeg failed on still ${s.id}: ${String(r.stderr).split("\n")[0]}`);

  console.log(`  ✓ ${s.id.padEnd(20)} still @${s.atSec}s  ${OUT_W}x${OUT_H}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  cut += 1;
  record();
}

// ---------------------------------------------------------------------------
// The manifest sync-assets.mjs reads
// ---------------------------------------------------------------------------

if (!ONLY) {
  const manifest = {
    $comment:
      "Written by scripts/cut-clips.mjs — never hand-edited. Read by scripts/sync-assets.mjs, " +
      "which copies this provenance into src/data/assets.json so every clip in the ledger is " +
      "traceable to the second of the raw take it was cut from. Regenerate with " +
      "`node scripts/cut-clips.mjs`; the raw takes live outside the repo.",
    crop: { ...CROP },
    output: { width: OUT_W, height: OUT_H, fps: OUT_FPS, codec: "h264", crf: 18 },
    handleSec: HANDLE,
    takesDir: slash(TAKES_DIR),
    takes: Object.fromEntries(
      Object.entries(TAKES).map(([k, t]) => [
        k,
        { file: t.file, durationSec: t.durationSec, bytes: fs.statSync(path.join(TAKES_DIR, t.file)).size, what: t.what },
      ]),
    ),
    clips: manifestClips,
    stills: manifestStills,
  };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

console.log(`  ${cut} cut, ${skipped} skipped${ONLY ? "  (--only: manifest not rewritten)" : `  -> ${slash(path.relative(ROOT, MANIFEST))}`}`);
console.log("  run `npm run sync:assets` to put them in the ledger, then `npm run verify:assets`");
