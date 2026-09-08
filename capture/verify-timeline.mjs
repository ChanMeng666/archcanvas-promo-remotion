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

let wallNote = "wall not packed";

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

/* the wall is packed from the ledger, completely */

const wallGroup = JSON.parse(fs.readFileSync(path.join(SRC, "data", "assets.json"), "utf8")).wall;
const ledgerTiles = wallGroup?.files ?? [];
if (ledgerTiles.length !== world.WALL_TILES.length) {
  fail(
    `the ledger stages ${ledgerTiles.length} wall tiles but WALL_TILES holds ${world.WALL_TILES.length} — the widest shot would render a partial wall`
  );
}
for (const t of ledgerTiles) {
  if (!world.WALL_TILES.some((p) => p.name === t.name)) {
    fail(`wall tile "${t.name}" is in the ledger but was not packed`);
  }
}
{
  const bottoms = new Array(world.WALL.cols).fill(0);
  for (const t of world.WALL_TILES) bottoms[t.col] = Math.max(bottoms[t.col], t.y + t.h);
  const spread = Math.max(...bottoms) - Math.min(...bottoms);
  const packedH = Math.max(...bottoms);
  if (Math.abs(packedH - world.WALL_GRID_H) > 1) {
    fail(`WALL_GRID_H is ${world.WALL_GRID_H.toFixed(1)} but the packed tiles reach ${packedH.toFixed(1)}`);
  }
  // A ragged bottom edge reads as masonry. A third of the grid missing from
  // one column reads as a bug, and it is the symptom of a re-sync that dropped
  // the packer's assumptions (uniform width, sane height range).
  if (spread > packedH * 0.25) {
    fail(
      `the wall's columns differ by ${Math.round(spread)} of ${Math.round(packedH)} (${((spread / packedH) * 100).toFixed(0)}%) — the pack no longer balances; check wall.sizeClasses in the ledger`
    );
  }
  wallNote = `wall packed from the ledger: ${world.WALL_TILES.length} tiles, ${world.WALL.cols} columns, ${Math.round(world.WALL_GRID_W)} x ${Math.round(packedH)} (aspect ${(world.WALL_GRID_W / packedH).toFixed(2)}), ragged edge ${Math.round(spread)}`;
}

/* the review pin is never hung on the showcase drawing */

/**
 * The one geometric fact that would print a visible falsehood.
 *
 * The pin says the plan has no bathroom, laundry or storage. That is true of
 * the filmed session's own 4-room / 108.00 m2 plan and false of
 * plan-family-house, which has a Bath and a Laundry. If these two rects ever
 * touch, the film states something untrue at the exact moment the voiceover
 * makes its honesty claim — so this is checked as geometry, not remembered as
 * a rule.
 */
{
  const pin = world.worldObject("reviewPin");
  const sheet = world.worldObject("planSheet");
  if (world.rectsOverlap(pin.rect, sheet.rect)) {
    fail(
      "reviewPin overlaps planSheet — the pin's sentence is about the filmed session's plan, not plan-family-house, and plan-family-house HAS a bathroom and a laundry"
    );
  }
}

/* the pin and the fixed drawing are both in frame during `lineage` */

{
  const L = layout.deriveLayout(1920, 1080);
  const f = world.STATION_FRAMES.lineage;
  const pin = world.worldObject("reviewPin").rect;
  const trail = world.worldObject("lineageTrail").rect;
  const fixed = world.rect(
    world.leftOf(trail) + world.LINEAGE.fixedDrawing.x + world.LINEAGE.fixedDrawing.w / 2,
    world.topOf(trail) + world.LINEAGE.fixedDrawing.y + world.LINEAGE.fixedDrawing.h / 2,
    world.LINEAGE.fixedDrawing.w,
    world.LINEAGE.fixedDrawing.h
  );
  const cam = L.viewportFit(f.rect, f.fit);
  const view = world.rect(cam.cx, cam.cy, 1920 / cam.scale, 1080 / cam.scale);
  const holds = (r) =>
    world.leftOf(view) <= world.leftOf(r) &&
    world.rightOf(view) >= world.rightOf(r) &&
    world.topOf(view) <= world.topOf(r) &&
    world.bottomOf(view) >= world.bottomOf(r);
  if (!holds(pin)) fail("the `lineage` framing does not hold the whole review pin — the named defect leaves frame before the fixed drawing arrives");
  if (!holds(fixed)) fail("the `lineage` framing does not hold LINEAGE.fixedDrawing — plan-hero is what makes the pin's defect visibly fixed");
  const dx = Math.abs(pin.cx - fixed.cx);
  if (dx > 80) {
    fail(
      `LINEAGE.fixedDrawing sits ${Math.round(dx)} units off the pin's centre line — the pull-back reads as two unrelated cards rather than one being the answer to the other`
    );
  }
}

/* one walk of every frame in every format: raster bound, display widths, wall exclusivity */

const worstUpscale = {};
/** Max on-screen width each object ever reaches. This is a raster budget. */
const widestDisplay = {};
/** Widest an object gets while its opacity is mid-change, per format. */
const widestWhileFading = {};
const markStation = timeline.byId.mark;
const markIntruders = new Set();

for (const d of layout.DELIVERABLES) {
  const L = layout.deriveLayout(d.width, d.height);
  const framings = kfs.map((k) => L.viewportFit(k.rect, k.fit));
  let reported = false;

  for (let frame = 0; frame <= timeline.totalFrames; frame += 1) {
    const cam = layout.cameraAt(kfs, framings, frame);
    const viewport = world.rect(cam.cx, cam.cy, d.width / cam.scale, d.height / cam.scale);
    const onMark = frame >= markStation.arriveFrame && frame < markStation.endFrame;

    for (const obj of world.WORLD_OBJECTS) {
      if (!world.rectsOverlap(viewport, obj.rect)) continue;
      // An object faded out is not on screen, and a bound it cannot break is
      // not a failure. The fade windows are derived in timeline.ts precisely
      // so both the film and this gate read the same ones.
      if (timeline.objectOpacityAtFrame(obj, frame) <= 0.001) continue;

      const shown = obj.rect.w * cam.scale;
      const wkey = `${d.id} ${obj.id}`;
      if (!widestDisplay[wkey] || shown > widestDisplay[wkey].px) {
        widestDisplay[wkey] = { px: shown, frame };
      }

      // A fade is only allowed while the thing fading is a thumbnail. See
      // FADE_INVISIBLE_PX in world.ts for why this is measured in pixels
      // rather than argued from "it happens off-frame" — that argument is
      // true in 16:9 and false in 9:16, which is the worst kind of true.
      //
      // TEXT IS EXEMPT, and this is a scope correction rather than a loophole.
      // The rule exists so a photograph or a drawing never visibly dissolves
      // into the ground — that reads as a rendering bug, because a physical
      // thing does not do it. A line of type is not a physical thing: arriving
      // and leaving IS how type behaves, in this film and in every other one,
      // and a card that is forbidden to fade can only be forbidden to appear.
      // Objects that carry a `surface` are the cards; everything else is still
      // held to the original rule.
      const isText = Boolean(obj.surface);
      const o = timeline.objectOpacityAtFrame(obj, frame);
      if (!isText && o > 0.001 && o < 0.999) {
        const fkey = `${d.id} ${obj.id}`;
        if (!widestWhileFading[fkey] || shown > widestWhileFading[fkey].px) {
          widestWhileFading[fkey] = { px: shown, frame };
        }
      }

      // The last beat is a wordmark and terms on ivory. Anything else still in
      // frame there is a world object that drifted into the end card.
      if (onMark && obj.id !== "endCard" && obj.id !== "briefLine") {
        markIntruders.add(`${d.id}: ${obj.id}`);
      }

      if (obj.raster === null || reported) continue;
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
        reported = true; // one report per format is enough
      }
    }
  }
}

for (const [key, v] of Object.entries(widestWhileFading)) {
  if (v.px > world.FADE_INVISIBLE_PX) {
    fail(
      `${key} is ${Math.round(v.px)}px wide at frame ${v.frame} while its opacity is changing (max ${world.FADE_INVISIBLE_PX}px) — the audience can watch it dissolve`
    );
  }
}
for (const intruder of markIntruders) {
  fail(`${intruder} is in frame during the \`mark\` station — the end card is a wordmark and terms, and nothing else`);
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
const LEDGER_ROLES = { render: "rendering", wall: "wallTile", clip: "screenCapture", still: "pinCard" };

const ledgerPath = path.join(SRC, "data", "assets.json");
let ledgerNote = "src/data/assets.json not present yet — native raster sizes unverified";
if (fs.existsSync(ledgerPath)) {
  try {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    const perRaster = ledger?.maxUpscale?.perRaster ?? [];
    if (perRaster.length === 0) {
      ledgerNote = "src/data/assets.json has no maxUpscale.perRaster — native raster sizes unverified";
    } else {
      // The NARROWEST row per role, not the widest. The bound has to hold for
      // whichever asset a component actually reaches for, so it is computed
      // against the one that runs out of pixels first — the ledger calls that
      // `tightestRaster` and it was reconciling against the wrong end until
      // the clip library grew a second, wider family.
      const widest = {};
      for (const row of perRaster) {
        const kind = LEDGER_ROLES[row.role];
        if (!kind) continue;
        if (!widest[kind] || row.nativeWidth < widest[kind]) widest[kind] = row.nativeWidth;
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
            `NATIVE_RASTER.${kind}.w is ${native.w} but the narrowest staged ${kind} in the ledger is ${fromLedger} — the upscale bound is being computed against the wrong number`
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

  } catch (err) {
    fail(`src/data/assets.json could not be read: ${err.message}`);
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */

console.log(`\nverify:timeline  ${sourceFiles.length} source files scanned, ${timeline.totalFrames} frames derived\n`);
console.log(timeline.describe());
console.log(`\n  ${ledgerNote}`);
console.log(`  ${voSeamNote}`);
console.log(`  ${wallNote}`);
console.log("\n  widest on-screen width per object — the budget for anything cropped from a clip:");
for (const [key, v] of Object.entries(widestDisplay)) {
  console.log(`    ${key.padEnd(34)} ${String(Math.round(v.px)).padStart(5)}px  (frame ${v.frame})`);
}

// An object with `raster: null` is a promise that whatever fills it is
// resolution-independent. This says what that promise costs: the native width
// a raster would have to have to survive the same framing. No staged clip is
// 2000px wide, so an object over that line cannot be filled with footage.
console.log("\n  vector-only objects — native width a raster would need to fill them:");
for (const obj of world.WORLD_OBJECTS) {
  if (obj.raster !== null) continue;
  const worst = Object.entries(widestDisplay)
    .filter(([k]) => k.endsWith(` ${obj.id}`))
    .reduce((n, [, v]) => Math.max(n, v.px), 0);
  if (worst === 0) continue;
  console.log(
    `    ${obj.id.padEnd(14)} ${String(Math.round(worst)).padStart(5)}px on screen -> needs >= ${Math.round(worst / world.MAX_RASTER_UPSCALE)}px native`
  );
}

console.log(`\n  widest while fading (max ${world.FADE_INVISIBLE_PX}px):`);
const fadingRows = Object.entries(widestWhileFading);
if (fadingRows.length === 0) console.log("    nothing in this film changes opacity");
for (const [key, v] of fadingRows) {
  console.log(`    ${key.padEnd(34)} ${String(Math.round(v.px)).padStart(5)}px  (frame ${v.frame})`);
}

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
