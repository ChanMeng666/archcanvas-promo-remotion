#!/usr/bin/env node
/**
 * Write `out/zoom-out.srt` and `out/zoom-out.vtt` — sidecar captions for the film.
 *
 * **Why sidecars and not burned-in text.** A caption burned into the picture is
 * a picture of words. It cannot be restyled by a viewer who needs a larger size
 * or a different contrast, cannot be resized independently of the video, cannot
 * be fed to a braille display, cannot be turned off by someone who finds it
 * distracting, and cannot be read at all by anyone who wants the text without
 * the video — a search engine, a translator, a person on a train reading rather
 * than listening. A `.srt` next to the file solves every one of those and costs
 * nothing at render time. `.gitignore` keeps the masters out of the repo and
 * keeps these two files in, deliberately: they are the reviewable record of
 * what the film says.
 *
 * Two inputs and one derivation:
 *
 *   - `src/data/script.json` — the words. Cleared line by line in
 *     `docs/copy-clearance.md` (law #1). Nothing here rewrites a line.
 *   - `src/data/vo.json` — how long each line takes, measured, from
 *     `scripts/measure-vo.mjs`. The *usable* duration, silence already trimmed.
 *   - the station schedule, from the film's own core via
 *     `capture/lib/load-core.mjs`. Law #3: the timeline is derived, never typed.
 *     This file must not do the arithmetic itself; a caption clock that agrees
 *     with the picture only because two files happen to hold the same numbers
 *     is a caption clock that will silently stop agreeing.
 *
 * Usage:
 *   node scripts/generate-captions.mjs
 *   node scripts/generate-captions.mjs --check    # write nothing, report drift
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_JSON = join(PROJECT, "src", "data", "script.json");
const VO_JSON = join(PROJECT, "src", "data", "vo.json");
const LOAD_CORE = join(PROJECT, "capture", "lib", "load-core.mjs");
const OUT_DIR = join(PROJECT, "out");
const BASENAME = "zoom-out";

const CHECK = process.argv.includes("--check");

/** Caption line length. 42 characters is the long-standing broadcast limit and
 *  is what every player's default styling is comfortable with; two lines max. */
const MAX_LINE = 42;
const MAX_LINES = 2;
/** No cue shorter than this. A caption that flashes for a third of a second is
 *  not readable by anyone, and it is what naive chunking produces at the end of
 *  a line: the tail words get their proportional share and it is tiny. */
const MIN_CUE_SEC = 1.0;

const die = (msg) => {
  console.error(`generate-captions: ${msg}`);
  process.exit(1);
};
const readJson = (file, what) => {
  if (!existsSync(file)) die(`${what} does not exist (${file}).`);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    die(`${what} is not valid JSON — ${e.message}`);
  }
};

// ── the derived timeline ─────────────────────────────────────────────────────
/**
 * Ask the film's own core when each line is spoken.
 *
 * `capture/lib/load-core.mjs` bundles the React-free half of `src/` and runs it
 * in Node, so this reads the real `timeline.ts`, not a copy of its arithmetic.
 * That is the whole point: two independent implementations of the film's clock
 * agree on the day they are written and drift the first time a station moves,
 * and the drift shows up as captions half a second early — which a reviewer
 * reads as sloppiness rather than as a bug, so nobody files it.
 *
 * The number taken is **`arriveFrame`**, not `startSec + leadInSec`. They are
 * the same thing, and `arriveFrame` is the one the core computed: a station's
 * `leadInSec` is both "when the camera finishes travelling here" and "when the
 * voice lands", and re-deriving it here would be exactly the second
 * implementation this file exists to avoid.
 */
const loadTimeline = async () => {
  if (!existsSync(LOAD_CORE)) {
    die(
      `capture/lib/load-core.mjs does not exist yet, so the station schedule cannot be derived. ` +
        `This script deliberately does not compute it itself (CLAUDE.md law #3: the timeline is derived, never typed). ` +
        `Expected contract: an export \`loadCore()\` (or default) resolving to a core whose timeline reports FPS and a station array of { id, startSec, arriveFrame }.`,
    );
  }
  const mod = await import(pathToFileURL(LOAD_CORE).href);
  const entry = mod.loadCore ?? mod.load ?? mod.default;
  if (typeof entry !== "function") {
    die(`capture/lib/load-core.mjs exports no callable loadCore/load/default. Exports: ${Object.keys(mod).join(", ") || "(none)"}.`);
  }
  const core = await entry();
  const t = core?.timeline ?? core;

  const fps = Number(t?.FPS ?? t?.fps);
  if (!Number.isFinite(fps) || fps <= 0) die(`the core's timeline did not report a usable FPS (got ${t?.FPS ?? t?.fps}).`);

  const list = t?.stations;
  if (!Array.isArray(list)) die(`the core's timeline reported no station array (got ${typeof list}).`);

  const spokenAt = new Map();
  for (const s of list) {
    const id = s?.id;
    if (!id) continue;
    const sec = Number.isFinite(s?.arriveFrame) ? s.arriveFrame / fps : Number(s?.startSec) + Number(s?.station?.leadInSec ?? 0);
    if (!Number.isFinite(sec)) die(`the core gave station "${id}" no arriveFrame and no usable startSec.`);
    spokenAt.set(id, sec);
  }
  if (!spokenAt.size) die(`the core's station array carried no ids.`);

  // The core is also the authority on how long the film is; a caption past the
  // end is a caption a player will still try to show over black.
  const totalSec = Number.isFinite(t?.totalSeconds)
    ? Number(t.totalSeconds)
    : Number.isFinite(t?.totalFrames)
      ? t.totalFrames / fps
      : null;

  if (Array.isArray(t?.warnings) && t.warnings.length) {
    for (const w of t.warnings) console.warn(`  ! timeline warning: ${w}`);
  }
  return { fps, spokenAt, totalSec };
};

// ── inputs ───────────────────────────────────────────────────────────────────
const script = readJson(SCRIPT_JSON, "src/data/script.json");
if (!Array.isArray(script?.vo)) die(`src/data/script.json has no "vo" array. Expected { vo: [ { id, text, leadInSec, tailSec } ] }.`);

const vo = readJson(VO_JSON, "src/data/vo.json (the film's clock — run `npm run vo:measure`)");
if (!vo?.takes || typeof vo.takes !== "object") die(`src/data/vo.json has no "takes" object. Run \`npm run vo:measure\`.`);

const { fps, spokenAt, totalSec } = await loadTimeline();

// ── build the cues ───────────────────────────────────────────────────────────
/**
 * Timing model: a line starts when the core says the camera arrives at its
 * station, and runs for the take's *measured* duration.
 *
 * Where a line is long enough to need more than one caption, the split is
 * proportional to character count. Proportional scaling is the right model here
 * and the wrong one for a human read — a person's pauses land unpredictably, so
 * a scaled cue drifts *within* a line and the fix is forced alignment
 * (../chan-meng-promo-video/docs/decisions.md §6). This film's narration is TTS,
 * which is metronomic, so proportional is honest. **If the narration is ever
 * re-recorded by a person, this is the code that has to change**, not the
 * timeline around it.
 */
const wrap = (text) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if (line.length + 1 + w.length <= MAX_LINE) line += ` ${w}`;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
};

/**
 * Split a line into as few cues as it needs, **balanced**.
 *
 * The obvious implementation — wrap at 42, then take the lines two at a time —
 * leaves a runt: an 86-character line becomes three lines and the third cue is
 * one word, holding for a third of a second. So the number of cues is decided
 * first (from the total length against what one cue can hold), and the words
 * are then divided evenly between that many.
 */
const split = (words, nCues, cap) => {
  const total = words.join(" ").length;
  const target = total / nCues;
  const groups = [];
  let current = [];
  let length = 0;
  for (const w of words) {
    const add = current.length ? w.length + 1 : w.length;
    // Close the group once it has reached its share, unless it is the last one
    // (which takes whatever is left) or adding would blow the hard cap.
    if (current.length && (length + add > cap || (length >= target && groups.length < nCues - 1))) {
      groups.push(current);
      current = [];
      length = 0;
    }
    current.push(w);
    length += current.length === 1 ? w.length : add;
  }
  if (current.length) groups.push(current);
  return groups.map((g) => wrap(g.join(" ")));
};

const chunk = (text) => {
  const words = text.split(/\s+/).filter(Boolean);
  const cap = MAX_LINE * MAX_LINES;
  // A group can exceed MAX_LINES even under the character cap when a long word
  // forces an early break, so ask for more cues until every one of them fits.
  // Never truncate to make it fit — a caption that drops a word is worse than
  // no caption, because it reads as the film having said something else.
  for (let n = Math.max(1, Math.ceil(text.length / cap)); n <= words.length; n++) {
    const groups = split(words, n, cap);
    if (groups.every((g) => g.length <= MAX_LINES)) return groups;
  }
  return words.map((w) => [w]);
};

const cues = [];
const missing = [];
for (const entry of script.vo) {
  const text = (entry?.text ?? "").trim();
  if (!text) continue; // `wall` is the film's deliberate silence.
  const take = vo.takes[entry.id];
  if (!take) { missing.push(entry.id); continue; }
  const start = spokenAt.get(entry.id);
  if (!Number.isFinite(start)) { missing.push(`${entry.id} (no station)`); continue; }

  // Per src/data/vo.json's `_schema`, a take is `{ seconds, file }` or a bare
  // number read as seconds.
  const total = Number(typeof take === "number" ? take : take.seconds);
  if (!Number.isFinite(total)) { missing.push(`${entry.id} (no measured duration)`); continue; }
  const blocks = chunk(text);
  const weights = blocks.map((b) => b.join(" ").length);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;

  const made = [];
  let t = start;
  blocks.forEach((block, i) => {
    const d = (weights[i] / sum) * total;
    made.push({ station: entry.id, start: t, end: t + d, lines: block });
    t += d;
  });

  // Absorb any cue too short to read into its neighbour, where the combined
  // text still fits. Balanced chunking makes this rare; a two-word line with
  // one long word can still produce one.
  for (let i = made.length - 1; i >= 0 && made.length > 1; i--) {
    if (made[i].end - made[i].start >= MIN_CUE_SEC) continue;
    const j = i > 0 ? i - 1 : 1;
    const merged = wrap([...(j < i ? made[j].lines : made[i].lines), ...(j < i ? made[i].lines : made[j].lines)].join(" "));
    if (merged.length > MAX_LINES) continue; // cannot merge without losing readability; leave it short
    made[Math.min(i, j)] = {
      station: entry.id,
      start: Math.min(made[i].start, made[j].start),
      end: Math.max(made[i].end, made[j].end),
      lines: merged,
    };
    made.splice(Math.max(i, j), 1);
  }
  cues.push(...made);
}

if (missing.length) {
  die(`no measured take (or no station) for: ${missing.join(", ")}. Run \`npm run vo\` then \`npm run vo:measure\`.`);
}
if (!cues.length) die("no spoken lines found — nothing to caption.");

cues.sort((a, b) => a.start - b.start);

// Overlap is a real failure, not a cosmetic one: two cues on screen at once is
// what a player shows when the timeline and the takes disagree.
const overlaps = cues.filter((c, i) => i > 0 && c.start < cues[i - 1].end - 1e-6);
if (overlaps.length) {
  console.error(`generate-captions: ${overlaps.length} cue(s) overlap the one before — the stations are closer together than the takes are long.`);
  for (const c of overlaps) console.error(`  ${c.station} starts at ${c.start.toFixed(3)}s, previous ends later`);
  process.exit(1);
}

// ── format ───────────────────────────────────────────────────────────────────
// Snap to the frame grid so a caption never changes a frame before or after the
// picture it belongs to.
const snap = (sec) => Math.round(sec * fps) / fps;
const stamp = (sec, sep) => {
  const s = Math.max(0, snap(sec));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  const ms = String(Math.round((s % 1) * 1000)).padStart(3, "0");
  return `${h}:${m}:${ss}${sep}${ms}`;
};

const srt = cues
  .map((c, i) => `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${c.lines.join("\n")}\n`)
  .join("\n");

const vtt =
  "WEBVTT\n\n" +
  cues.map((c, i) => `${i + 1}\n${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${c.lines.join("\n")}\n`).join("\n");

const srtPath = join(OUT_DIR, `${BASENAME}.srt`);
const vttPath = join(OUT_DIR, `${BASENAME}.vtt`);

console.log(`\n  generate-captions — ${cues.length} cue${cues.length === 1 ? "" : "s"} at ${fps} fps\n`);
for (const c of cues) {
  console.log(`  ${stamp(c.start, ",")} -> ${stamp(c.end, ",")}  ${c.station.padEnd(10)} ${c.lines.join(" / ")}`);
}
const lastEnd = snap(cues[cues.length - 1].end);
console.log(`\n  last cue ends ${lastEnd.toFixed(3)}s${totalSec ? ` of ${totalSec.toFixed(3)}s` : ""}`);
if (totalSec && lastEnd > totalSec + 1e-6) {
  console.error(`generate-captions: the last caption ends ${(lastEnd - totalSec).toFixed(3)}s after the film does — a player will hold it over black.`);
  process.exit(1);
}

if (CHECK) {
  console.log(`\n  --check: nothing written.\n`);
  process.exit(0);
}
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(srtPath, srt, "utf8");
writeFileSync(vttPath, vtt, "utf8");
console.log(`\n  wrote out/${BASENAME}.srt and out/${BASENAME}.vtt\n`);
