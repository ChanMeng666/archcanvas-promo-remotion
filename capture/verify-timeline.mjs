// Law 3: the timeline is derived, never typed.
//
// Two halves, and it needs both:
//
//   1. A TEXT check. `src/**` is grepped for frame literals — a `from={840}`, a
//      `durationInFrames={210}`, any number assigned to something named
//      *frame*. One of those anywhere but `src/timeline.ts` and the film has
//      two clocks, which is the state where a voiceover slips a beat and the
//      cut still looks fine in Studio.
//
//   2. A BEHAVIOUR check. The real core is bundled and executed (see
//      capture/lib/load-core.mjs) and the derived timeline is asserted against
//      the intent in `src/stations.ts`. This half exists because the text half
//      cannot see a station that is silently shorter than its own minSec.
//
// Usage:
//     node capture/verify-timeline.mjs            structural checks
//     node capture/verify-timeline.mjs --strict    ...and warnings must be empty

import fs from "node:fs";
import path from "node:path";

import { ROOT, SRC, loadCore } from "./lib/load-core.mjs";

const STRICT = process.argv.includes("--strict");

const failures = [];
const fail = (line) => failures.push(line);

/* ── 1. the text check ────────────────────────────────────────────────────── */

/** The one file allowed to do frame arithmetic. */
const TIMELINE = path.join(SRC, "timeline.ts");

const FRAME_LITERALS = [
  {
    re: /\bfrom=\{\s*-?\d/g,
    why: "a literal `from={n}` — Sequence offsets come from timeline.ts",
  },
  {
    re: /\bdurationInFrames=\{\s*-?\d/g,
    why: "a literal `durationInFrames={n}` — lengths come from timeline.ts",
  },
  {
    re: /\b[A-Za-z_$][\w$]*[Ff]rames?[\w$]*\s*[:=]\s*-?\d/g,
    why: "a number assigned to a *frame* identifier — seconds live in stations.ts, frames are derived in timeline.ts",
  },
];

/**
 * Strip comments before matching.
 *
 * Prose about frame 892 is not a frame literal, and a gate that cannot tell
 * the difference gets switched off. `://` is spared so a URL in a comment does
 * not swallow the rest of its line.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
};

const sourceFiles = walk(SRC).filter((p) => p !== TIMELINE);

for (const file of sourceFiles) {
  const raw = fs.readFileSync(file, "utf8");
  const code = stripComments(raw);
  const lines = code.split("\n");
  for (const { re, why } of FRAME_LITERALS) {
    lines.forEach((line, i) => {
      re.lastIndex = 0;
      const hit = re.exec(line);
      if (hit) {
        fail(
          `${path.relative(ROOT, file)}:${i + 1}  frame literal: ${why}\n      ${line.trim()}`
        );
      }
    });
  }
}

/* ── 2. the behaviour check ───────────────────────────────────────────────── */

const core = await loadCore();
const { timeline, stations: stationsMod, world, layout, palette, tokens } = core;

/* the four compositions agree on length */

const EXPECTED_DELIVERABLES = [
  ["Zoom-Landscape-16x9", 1920, 1080],
  ["Zoom-Vertical-9x16", 1080, 1920],
  ["Zoom-Portrait-4x5", 1080, 1350],
  ["Zoom-Square-1x1", 1080, 1080],
];

if (layout.DELIVERABLES.length !== EXPECTED_DELIVERABLES.length) {
  fail(`DELIVERABLES has ${layout.DELIVERABLES.length} entries, expected ${EXPECTED_DELIVERABLES.length}`);
}
for (const [id, w, h] of EXPECTED_DELIVERABLES) {
  const d = layout.DELIVERABLES.find((x) => x.id === id);
  if (!d) fail(`DELIVERABLES is missing "${id}"`);
  else if (d.width !== w || d.height !== h) {
    fail(`"${id}" is ${d.width}x${d.height}, expected ${w}x${h}`);
  }
  else if (Math.min(d.width, d.height) !== 1080) {
    fail(`"${id}" short edge is ${Math.min(d.width, d.height)}, expected 1080`);
  }
}

const rootSrc = fs.readFileSync(path.join(SRC, "Root.tsx"), "utf8");
const durationProps = rootSrc.match(/durationInFrames=\{[^}]*\}/g) ?? [];
if (durationProps.length !== 1) {
  fail(
    `src/Root.tsx has ${durationProps.length} distinct durationInFrames props — all four compositions must read ONE derived length (map over DELIVERABLES)`
  );
} else if (!/durationInFrames=\{\s*totalFrames\s*\}/.test(durationProps[0])) {
  fail(`src/Root.tsx sets ${durationProps[0]} — it must be {totalFrames} from timeline.ts`);
}
if (!/DELIVERABLES\.map/.test(rootSrc)) {
  fail("src/Root.tsx no longer maps over DELIVERABLES — the four sizes can now drift apart");
}

/* intent is honoured */

for (const s of timeline.stations) {
  if (s.durationSec < s.station.minSec - 1e-9) {
    fail(
      `station "${s.id}" is ${s.durationSec.toFixed(3)}s, shorter than its minSec of ${s.station.minSec}s`
    );
  }
  if (s.durationSec > s.station.maxSec + 1e-9) {
    fail(
      `station "${s.id}" is ${s.durationSec.toFixed(3)}s, longer than its maxSec of ${s.station.maxSec}s`
    );
  }
  if (s.durationInFrames < 1) fail(`station "${s.id}" is zero frames long`);
}

if (timeline.stations.length !== stationsMod.STATIONS.length) {
  fail("timeline dropped a station");
}
if (timeline.totalFrames !== timeline.stations.reduce((n, s) => n + s.durationInFrames, 0)) {
  fail("totalFrames does not equal the sum of the stations");
}

/* the camera is continuous */

const kfs = timeline.cameraKeyframes;
if (kfs.length !== timeline.stations.length * 2) {
  fail(`expected 2 camera keyframes per station, got ${kfs.length} for ${timeline.stations.length}`);
}
if (kfs[0].frame !== 0) fail(`the first camera keyframe is at frame ${kfs[0].frame}, not 0`);
if (kfs[kfs.length - 1].frame !== timeline.totalFrames) {
  fail(
    `the last camera keyframe is at frame ${kfs[kfs.length - 1].frame}, not totalFrames (${timeline.totalFrames})`
  );
}
for (let i = 1; i < kfs.length; i += 1) {
  if (kfs[i].frame < kfs[i - 1].frame) {
    fail(`camera keyframes run backwards at index ${i} (${kfs[i - 1].frame} -> ${kfs[i].frame})`);
  }
}
for (const s of stationsMod.STATIONS) {
  if (!world.STATION_FRAMES[s.id]) fail(`station "${s.id}" has no STATION_FRAMES entry`);
}
for (const id of Object.keys(world.STATION_FRAMES)) {
  if (!stationsMod.STATIONS.some((s) => s.id === id)) {
    fail(`STATION_FRAMES has "${id}", which is not a station`);
  }
}

/* every world object is rendered by something */

const filmSrc = fs.readFileSync(path.join(SRC, "Film.tsx"), "utf8");
for (const obj of world.WORLD_OBJECTS) {
  if (!new RegExp(`\\b${obj.id}\\s*:`).test(filmSrc)) {
    fail(
      `world object "${obj.id}" has no entry in the REGISTRY in src/Film.tsx — Remotion renders a missing region as blank, silently`
    );
  }
  if ((obj.raster === null) !== (obj.rasterWorldW === null)) {
    fail(`world object "${obj.id}" declares raster ${obj.raster} but rasterWorldW ${obj.rasterWorldW}`);
  }
}

/* no raster is blown up past the bound, in any format, on any frame */

const rasterObjects = world.WORLD_OBJECTS.filter((o) => o.raster !== null);
const worstUpscale = {};

for (const d of layout.DELIVERABLES) {
  const L = layout.deriveLayout(d.width, d.height);
  const framings = kfs.map((k) => L.viewportFit(k.rect, k.fit));

  for (let frame = 0; frame <= timeline.totalFrames; frame += 1) {
    const cam = layout.cameraAt(kfs, framings, frame);
    const viewport = world.rect(cam.cx, cam.cy, d.width / cam.scale, d.height / cam.scale);
    for (const obj of rasterObjects) {
      if (!world.rectsOverlap(viewport, obj.rect)) continue;
      // An object faded out is not on screen, and a bound it cannot break is
      // not a failure. The fade windows are derived in timeline.ts precisely
      // so both the film and this gate read the same ones.
      if (timeline.objectOpacityAtFrame(obj, frame) <= 0.001) continue;
      const key = `${d.id} ${obj.id}`;
      const up = world.rasterUpscale(obj.rasterWorldW, cam.scale, world.NATIVE_RASTER[obj.raster].w);
      if (!worstUpscale[key] || up > worstUpscale[key].up) worstUpscale[key] = { up, frame };
      const complaint = world.assertRasterScale(
        `${d.id} frame ${frame} "${obj.id}"`,
        obj.rasterWorldW,
        cam.scale,
        obj.raster
      );
      if (complaint) {
        fail(complaint);
        frame = timeline.totalFrames + 1; // one report per format is enough
        break;
      }
    }
  }
}

/* the hero framing is derived from the bound, not hand-picked */

for (const d of layout.DELIVERABLES) {
  const L = layout.deriveLayout(d.width, d.height);
  if (L.heroFullBleed && L.heroCoverUpscale > world.MAX_RASTER_UPSCALE + 1e-6) {
    fail(
      `${d.id} claims heroFullBleed but covering costs ${L.heroCoverUpscale.toFixed(3)}x (max ${world.MAX_RASTER_UPSCALE})`
    );
  }
}

/* the palette is legible where the film actually sets type */

for (const pair of tokens.CONTRAST_PAIRS) {
  const stopColour = tokens.GROUND_STOPS[pair.stop];
  if (stopColour !== pair.bg) {
    fail(
      `CONTRAST_PAIRS row "${pair.use}" says bg ${pair.bg} at stop ${pair.stop}, but GROUND_STOPS[${pair.stop}] is ${stopColour}`
    );
  }
  const ratio = palette.contrastRatio(pair.fg, pair.bg);
  if (ratio < pair.min) {
    fail(`contrast: ${pair.use} is ${ratio.toFixed(2)}:1, below ${pair.min}:1 (${pair.fg} on ${pair.bg})`);
  }
}

/* the vo measurer and the station list agree on the station ids */

/**
 * `scripts/measure-vo.mjs` keeps its own copy of the station ids, because it
 * runs before any bundling and cannot import a .ts file. That copy is the seam
 * where a renamed station quietly loses its voice: measure-vo writes takes
 * under the old id, timeline.ts looks for the new one, every station falls
 * back to previz timing, and the only symptom is warnings that were already
 * there. Checked by text, and only while the text has this shape — if the
 * script is refactored the check says so out loud rather than passing.
 */
let voSeamNote = "scripts/measure-vo.mjs not present — station-id seam unchecked";
const measurePath = path.join(ROOT, "scripts", "measure-vo.mjs");
if (fs.existsSync(measurePath)) {
  const measureSrc = fs.readFileSync(measurePath, "utf8");
  const literal = measureSrc.match(/const STATIONS\s*=\s*\[([^\]]*)\]/);
  if (!literal) {
    voSeamNote =
      "scripts/measure-vo.mjs no longer declares `const STATIONS = [...]` — the station-id seam is UNCHECKED; update this gate";
  } else {
    const theirs = literal[1].match(/"([^"]+)"/g)?.map((q) => q.slice(1, -1)) ?? [];
    const ours = stationsMod.STATIONS.map((s) => s.id);
    if (theirs.join(",") !== ours.join(",")) {
      fail(
        `scripts/measure-vo.mjs lists stations [${theirs.join(", ")}] but src/stations.ts has [${ours.join(", ")}] — measured takes would land under ids nothing reads`
      );
    }
    voSeamNote = `station ids reconciled with scripts/measure-vo.mjs (${ours.length})`;
  }
}

/* the native pixel sizes match the asset ledger, once there is one */

/**
 * Reconciled BY ROLE, not by "widest raster in the file".
 *
 * The blunt version of this check failed the moment the ledger landed: the
 * product screen recordings are 1786px wide, wider than any rendering, and the
 * film had never registered them. That is the check working — but it only
 * pointed at a number, not at which raster kind was missing. Matching roles
 * says WHICH.
 */
const LEDGER_ROLES = { render: "rendering", wall: "wallTile", clip: "screenCapture" };

const ledgerPath = path.join(SRC, "data", "assets.json");
let ledgerNote = "src/data/assets.json not present yet — native raster sizes unverified";
if (fs.existsSync(ledgerPath)) {
  try {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    const perRaster = ledger?.maxUpscale?.perRaster ?? [];
    if (perRaster.length === 0) {
      ledgerNote = "src/data/assets.json has no maxUpscale.perRaster — native raster sizes unverified";
    } else {
      const widest = {};
      for (const row of perRaster) {
        const kind = LEDGER_ROLES[row.role];
        if (!kind) continue;
        if (!widest[kind] || row.nativeWidth > widest[kind]) widest[kind] = row.nativeWidth;
      }
      const parts = [];
      for (const [kind, native] of Object.entries(world.NATIVE_RASTER)) {
        const fromLedger = widest[kind];
        if (fromLedger === undefined) {
          fail(`NATIVE_RASTER.${kind} has no matching role in src/data/assets.json — it is not measured, it is assumed`);
          continue;
        }
        parts.push(`${kind} ${native.w}px`);
        if (fromLedger !== native.w) {
          fail(
            `NATIVE_RASTER.${kind}.w is ${native.w} but the ledger says ${fromLedger} — the upscale bound is being computed against the wrong number`
          );
        }
      }
      for (const [role, kind] of Object.entries(LEDGER_ROLES)) {
        if (!(kind in world.NATIVE_RASTER)) {
          fail(`the ledger has role "${role}" but the film registers no NATIVE_RASTER.${kind}`);
        }
      }
      ledgerNote = `native raster sizes reconciled with the ledger by role: ${parts.join(", ")}`;
    }

    // The wall is packed from the ledger's own tiles, so its framing has to
    // track them. A re-sync that swaps in taller plans leaves the widest shot
    // with two empty columns and nothing else notices.
    const tiles = ledger?.wall?.files ?? [];
    if (tiles.length) {
      const totalNativeH = tiles.reduce((n, t) => n + (t.height ?? 0), 0);
      const packed =
        (totalNativeH * (world.WALL.colW / world.NATIVE_RASTER.wallTile.w)) / world.WALL.cols +
        (tiles.length / world.WALL.cols - 1) * world.WALL.gap;
      const drift = Math.abs(packed - world.WALL_GRID_H) / packed;
      if (tiles.length !== world.WALL.tiles) {
        fail(`WALL.tiles is ${world.WALL.tiles} but the ledger stages ${tiles.length} wall tiles`);
      }
      if (drift > 0.2) {
        fail(
          `WALL_GRID_H is ${world.WALL_GRID_H} but the ledger's tiles pack to ~${Math.round(packed)} in ${world.WALL.cols} columns (${(drift * 100).toFixed(0)}% off) — the wall framing no longer fits the wall`
        );
      }
      ledgerNote += `; wall packs to ~${Math.round(packed)} vs WALL_GRID_H ${world.WALL_GRID_H}`;
    }
  } catch (err) {
    fail(`src/data/assets.json could not be read: ${err.message}`);
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */

console.log(`\nverify:timeline  ${sourceFiles.length} source files scanned, ${timeline.totalFrames} frames derived\n`);
console.log(timeline.describe());
console.log(`\n  ${ledgerNote}`);
console.log(`  ${voSeamNote}`);
console.log("\n  worst raster upscale reached, per format:");
for (const [key, v] of Object.entries(worstUpscale)) {
  console.log(`    ${key.padEnd(34)} ${v.up.toFixed(3)}x  (frame ${v.frame}, max ${world.MAX_RASTER_UPSCALE})`);
}

if (timeline.warnings.length) {
  console.log(`\n  ${timeline.warnings.length} timeline warning(s):`);
  for (const w of timeline.warnings) console.log(`    ! ${w}`);
  if (STRICT) {
    fail(
      `${timeline.warnings.length} timeline warning(s) under --strict — the film is still at previz timing`
    );
  }
}

if (failures.length) {
  console.error(`\nFAIL  verify:timeline  (${failures.length})\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log(`\nOK  verify:timeline${STRICT ? " --strict" : ""}\n`);
