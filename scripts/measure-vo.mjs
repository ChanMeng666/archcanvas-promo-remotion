#!/usr/bin/env node
/**
 * Master every narration take, then measure it. Writes `src/data/vo.json` —
 * the film's clock.
 *
 * **Why this is a Node script and not `calculateMetadata`.** Remotion runs
 * `calculateMetadata` in Studio *and* in every render worker. Probing audio
 * there means N probes per render, a different answer if a file changes
 * mid-render, and — the failure that actually happens — a catch block that
 * substitutes a default duration, so the film renders at placeholder timing
 * and nobody notices until it is on YouTube. This runs once, on a person's
 * machine, and commits the numbers. The composition reads them synchronously.
 * See CLAUDE.md, "Traps already paid for".
 *
 * **Why mastering happens here rather than in generate-vo.mjs.** The number
 * that matters is the *usable* duration: how long the voice actually speaks,
 * not how long the file is. A TTS take carries a variable amount of silence at
 * each end, and the amount differs per line. Measure the raw file and every
 * station inherits however long the model sat quiet before speaking, with a
 * different error each time — drift that accumulates across nine stations and
 * cannot be corrected without re-cutting the whole timeline. So: trim both
 * ends, level, write the file back, and measure THAT. The file the composition
 * plays and the number the timeline uses are then the same object.
 *
 * (This is the piece none of the reference repos had; the reasoning is
 * ../chan-meng-promo-video/docs/decisions.md §6, where it was `vo:master`.)
 *
 * Levelling uses the same flat-gain trick as `tools/prepare-bed.ps1`: measure
 * once with `ebur128`, apply one constant dB, let `alimiter` catch the peaks.
 * `loudnorm`'s dynamic mode would flatten the read's own shape, and a narrator
 * dropping their voice on the last line is intent, not an error.
 *
 * Idempotent: a take whose sha256 already matches the ledger was mastered by a
 * previous run and is only re-measured. `--force` re-masters everything, which
 * on an already-mastered take is a second lossy encode — so don't, unless the
 * targets below changed.
 *
 * Usage:
 *   node scripts/measure-vo.mjs
 *   node scripts/measure-vo.mjs --dry      # report, write nothing
 *   node scripts/measure-vo.mjs --partial  # mid-read, some lines not voiced yet
 *   node scripts/measure-vo.mjs --force
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(PROJECT, "public", "audio");
const SCRIPT_JSON = join(PROJECT, "src", "data", "script.json");
const OUT_JSON = join(PROJECT, "src", "data", "vo.json");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const FORCE = argv.includes("--force");
/** Allow measuring a partial read. Off by default: a station with a written
 *  line and no take renders silent while the timeline still reserves its time,
 *  which is a hole nobody sees. Use it while the read is in progress. */
const PARTIAL = argv.includes("--partial");

/** Narration sits at −16 LUFS; the music bed at −20 (tools/prepare-bed.ps1). */
const TARGET_LUFS = -16.0;
/** −45 dBFS peak for 100ms reads as silence in a TTS take without clipping a soft consonant. */
const SILENCE_THRESHOLD = "-45dB";
const SILENCE_DURATION = "0.1";

/** src/data/vo.json's contract, verbatim. Only used if the file is absent. */
const SCHEMA_NOTE =
  "takes[<station id>] = { seconds: <measured take length>, file: <path under audio/> }. A bare number is also accepted and read as seconds. Written by scripts/measure-vo.mjs via ffprobe — never hand-edited, and never probed at render time (see CLAUDE.md, Traps already paid for).";

const STATIONS = ["interior", "pair", "drawing", "facts", "note", "lineage", "wall", "sentence", "mark"];
const SILENT_BY_DESIGN = new Set(["wall"]);

const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  // ffmpeg writes progress and warnings to stderr; only a non-zero status is a failure.
  if (r.status !== 0) {
    console.error(r.stderr || r.error?.message || "ffmpeg failed");
    process.exit(1);
  }
  return r.stderr || "";
};
const probeDuration = (file) => {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file], { encoding: "utf8" });
  const d = Number(r.stdout?.trim());
  if (!Number.isFinite(d)) {
    console.error(`measure-vo: ffprobe could not read a duration from ${file}`);
    process.exit(1);
  }
  return d;
};
const lastLufs = (log, label = "I") => {
  const m = [...log.matchAll(new RegExp(`${label}:\\s+(-?\\d+\\.\\d+)`, "g"))];
  return m.length ? Number(m[m.length - 1][1]) : null;
};
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

// ── what takes exist ─────────────────────────────────────────────────────────
if (!existsSync(AUDIO_DIR)) {
  console.error("measure-vo: public/audio/ does not exist. Run `npm run vo` first — there is nothing to measure.");
  process.exit(1);
}
const files = readdirSync(AUDIO_DIR).filter((f) => /^vo-.+\.mp3$/.test(f)).sort();
if (!files.length) {
  console.error("measure-vo: no public/audio/vo-*.mp3. Run `npm run vo` first — there is nothing to measure.");
  process.exit(1);
}

const ids = files.map((f) => f.replace(/^vo-|\.mp3$/g, ""));
const strays = ids.filter((id) => !STATIONS.includes(id));
if (strays.length) {
  console.error(`measure-vo: public/audio/ holds takes for stations this film does not have: ${strays.join(", ")}. Delete them — a stray take is a line that was cut and not removed.`);
  process.exit(1);
}
const silentButPresent = ids.filter((id) => SILENT_BY_DESIGN.has(id));
if (silentButPresent.length) {
  console.error(`measure-vo: there is a take for "${silentButPresent.join(", ")}", which is the film's deliberate silence. Delete it, or the station stops being silent.`);
  process.exit(1);
}

// Cross-check against the script if it exists yet, so a line that was written
// but never read is caught here rather than as a hole in the render.
if (existsSync(SCRIPT_JSON)) {
  try {
    const script = JSON.parse(readFileSync(SCRIPT_JSON, "utf8"));
    const spoken = (script?.vo ?? []).filter((l) => (l?.text ?? "").trim()).map((l) => l.id);
    const unread = spoken.filter((id) => !ids.includes(id));
    if (unread.length && PARTIAL) {
      console.warn(`measure-vo: --partial, so continuing with ${unread.length} line(s) not yet read: ${unread.join(", ")}.`);
    } else if (unread.length) {
      console.error(`measure-vo: src/data/script.json has lines with no take: ${unread.join(", ")}. Run \`npm run vo\` — a station with no audio renders silent and the timeline still reserves time for it.`);
      process.exit(1);
    }
  } catch {
    console.warn("measure-vo: src/data/script.json could not be parsed; skipping the cross-check.");
  }
}

const existingDoc = existsSync(OUT_JSON) ? JSON.parse(readFileSync(OUT_JSON, "utf8")) : {};
const previous = existingDoc?.takes ?? {};

// ── master + measure ─────────────────────────────────────────────────────────
/**
 * One take row. The field is `seconds`, NOT `durationSec`.
 *
 * This script was originally specified to write `durationSec`, and `src/`
 * had already shipped a reader for `seconds`. That mismatch would not have
 * thrown: the reader would have seen `undefined`, fallen back to the station's
 * previz `minSec`, and the film would have rendered at placeholder timing with
 * nothing going red. `src/data/vo.json`'s own `_schema` line is the contract
 * and it wins; `sha256` is an addition, not a replacement, and exists only so
 * a re-run can tell a take it already mastered from a fresh one.
 */
const take = (id, seconds, sha) => ({
  seconds: Number(seconds.toFixed(3)),
  file: `audio/vo-${id}.mp3`,
  sha256: sha,
});

const takes = {};
const rows = [];
for (const id of ids) {
  const file = join(AUDIO_DIR, `vo-${id}.mp3`);
  const before = { dur: probeDuration(file), sha: sha256(file) };
  const alreadyMastered = !FORCE && previous[id]?.sha256 === before.sha;

  if (alreadyMastered || DRY) {
    takes[id] = take(id, before.dur, before.sha);
    rows.push({ id, from: before.dur, to: before.dur, lufs: null, note: DRY && !alreadyMastered ? "would master" : "already mastered" });
    continue;
  }

  const tmp = join(tmpdir(), `vo-${id}-${process.pid}.wav`);
  const out = join(tmpdir(), `vo-${id}-${process.pid}.mp3`);

  // Trim both ends. `areverse` twice is the standard way to run silenceremove
  // against the tail — the filter only ever trims from the front.
  const trim =
    `silenceremove=start_periods=1:start_silence=${SILENCE_DURATION}:start_threshold=${SILENCE_THRESHOLD}:detection=peak,` +
    `areverse,` +
    `silenceremove=start_periods=1:start_silence=${SILENCE_DURATION}:start_threshold=${SILENCE_THRESHOLD}:detection=peak,` +
    `areverse`;
  ff(["-y", "-v", "error", "-i", file, "-af", trim, "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", tmp]);

  const log = ff(["-v", "info", "-i", tmp, "-af", "ebur128=peak=true", "-f", "null", process.platform === "win32" ? "NUL" : "/dev/null"]);
  const lufs = lastLufs(log, "I");
  if (lufs === null) {
    console.error(`measure-vo: could not read the loudness of the trimmed ${id} take.`);
    process.exit(1);
  }
  const gain = Number((TARGET_LUFS - lufs).toFixed(2));
  ff(["-y", "-v", "error", "-i", tmp, "-af", `volume=${gain}dB,alimiter=limit=0.95`, "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "48000", out]);

  renameSync(out, file);
  rmSync(tmp, { force: true });

  const after = { dur: probeDuration(file), sha: sha256(file) };
  takes[id] = take(id, after.dur, after.sha);
  rows.push({ id, from: before.dur, to: after.dur, lufs, note: `${gain >= 0 ? "+" : ""}${gain} dB` });
}

// ── write the clock ──────────────────────────────────────────────────────────
const doc = {
  // src/'s own header note, reproduced verbatim so it survives a rewrite even
  // if this file is ever regenerated from nothing.
  _schema: existingDoc._schema ?? SCHEMA_NOTE,
  // Anything else src/ put at the top level and this script does not own — fps,
  // today — is carried through rather than clobbered.
  ...Object.fromEntries(Object.entries(existingDoc).filter(([k]) => !["_schema", "generatedAt", "takes"].includes(k))),
  generatedAt: new Date().toISOString(),
  takes: Object.fromEntries(STATIONS.filter((id) => takes[id]).map((id) => [id, takes[id]])),
};

console.log(`\n  measure-vo — ${rows.length} take${rows.length === 1 ? "" : "s"}\n`);
console.log("    station     raw      usable    trimmed    level");
for (const r of rows) {
  const trimmed = r.from - r.to;
  console.log(
    `    ${r.id.padEnd(10)}  ${r.from.toFixed(3).padStart(7)}s  ${r.to.toFixed(3).padStart(7)}s  ` +
      `${trimmed > 0.0005 ? `-${trimmed.toFixed(3)}s` : "     —"}   ${r.lufs === null ? r.note : `${r.lufs.toFixed(1)} LUFS -> ${TARGET_LUFS} (${r.note})`}`,
  );
}
const total = Object.values(doc.takes).reduce((a, t) => a + t.seconds, 0);
console.log(`\n    ${Object.keys(doc.takes).length} stations speak · ${total.toFixed(3)}s of narration total`);
console.log(`    silent by design: ${[...SILENT_BY_DESIGN].join(", ")}`);

if (DRY) {
  console.log(`\n  --dry: src/data/vo.json not written.\n`);
  process.exit(0);
}
mkdirSync(dirname(OUT_JSON), { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2) + "\n");
console.log(`\n  wrote src/data/vo.json\n`);
