#!/usr/bin/env node
/**
 * Pick the music window for a film whose one big moment is at a fixed second.
 *
 * `analyze-music.mjs` answers "what is this take?". This answers "given the
 * tempo and beat phase it measured, and given that the film's biggest moment is
 * at HIT seconds, where should the cut start?" — by scoring bar-aligned starts
 * on how close the track's own largest energy jump lands to that moment.
 *
 * Bar alignment matters even in a film with no cuts. A bed that starts mid-bar
 * sounds like it resumed from somewhere; the film's first second is meant to
 * feel like the beginning of something. (In the sibling films it mattered twice
 * over, because their picture cuts also had to land on beats. Here there are no
 * cuts, so only the "starts rather than resumes" half applies — which is why
 * this tool's output is advisory and the shape-led table in analyze-music.mjs
 * is usually the one to trust for this particular film.)
 *
 * Ported from ../she-sharp-promo-video-event-lesmills-03-september-2026/tools/
 * find-window.mjs. Changes: the report also carries the tail level, because a
 * continuous 85-second breath has to *settle*, and a window that lands the jump
 * perfectly but ends mid-wall is useless here.
 *
 * Usage:
 *   node tools/find-window.mjs "<audio>" <bpm> <phaseSeconds> <hitSeconds> <videoSeconds>
 *
 * e.g. after analyze-music reports 98.35 BPM at phase 0.46s:
 *   node tools/find-window.mjs "audio/source/take.mp3" 98.35 0.46 72 85
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const [input, bpmArg, phaseArg, hitArg, videoArg] = process.argv.slice(2);
const BPM = Number(bpmArg);
const PHASE = Number(phaseArg);
const HIT = Number(hitArg);
const VIDEO_S = Number(videoArg);

if (!input || !existsSync(input) || !Number.isFinite(BPM) || !Number.isFinite(PHASE) || !Number.isFinite(HIT) || !Number.isFinite(VIDEO_S)) {
  console.error('usage: node tools/find-window.mjs "<audio>" <bpm> <phaseSeconds> <hitSeconds> <videoSeconds>');
  process.exit(1);
}

const SR = 8000;
// -vn drops the embedded cover art a SUNO export carries; piped rather than
// written to a temp file so nothing is left behind if this dies mid-decode.
const dec = spawnSync("ffmpeg", ["-v", "error", "-vn", "-i", input, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], {
  maxBuffer: 1 << 30,
  encoding: "buffer",
});
if (dec.status !== 0) {
  console.error("ffmpeg decode failed:\n" + dec.stderr.toString());
  process.exit(1);
}
const raw = dec.stdout;
const n = Math.floor(raw.length / 2);
const x = new Float32Array(n);
for (let i = 0; i < n; i++) x[i] = raw.readInt16LE(i * 2) / 32768;
const duration = n / SR;

// RMS in 50ms hops. Coarser than analyze-music's 10ms because this is looking
// for sustained arrangement changes, not attacks.
const HOP = Math.round(SR * 0.05);
const frames = Math.floor(n / HOP);
const env = new Float32Array(frames);
for (let f = 0; f < frames; f++) {
  let s = 0;
  for (let i = f * HOP; i < (f + 1) * HOP; i++) s += x[i] * x[i];
  env[f] = Math.sqrt(s / HOP);
}
const tOf = (f) => f * 0.05;
const fOf = (t) => Math.round(t / 0.05);
const mean = (t0, t1) => {
  const a = Math.max(0, fOf(t0));
  const z = Math.min(frames, fOf(t1));
  let s = 0;
  for (let f = a; f < z; f++) s += env[f];
  return s / Math.max(1, z - a);
};
const loudest = Math.max(...env) || 1;

// --- the biggest sustained energy jump in the track ---
console.log("energy jumps (2s after vs 2s before, top 10)");
const jumps = [];
for (let f = fOf(4); f < frames - fOf(4); f++) {
  const before = mean(tOf(f) - 2, tOf(f));
  const after = mean(tOf(f), tOf(f) + 2);
  jumps.push({ t: tOf(f), ratio: after / (before + 1e-9) });
}
// Keep only local maxima at least 3s apart so one lift is not listed 40 times.
jumps.sort((a, b) => b.ratio - a.ratio);
const drops = [];
for (const j of jumps) {
  if (drops.every((d) => Math.abs(d.t - j.t) > 3)) drops.push(j);
  if (drops.length === 10) break;
}
for (const d of drops) console.log(`  ${d.t.toFixed(2).padStart(7)}s   x${d.ratio.toFixed(3)}`);

// --- bar-aligned window starts, scored on how well the lift lands on HIT ---
const beat = 60 / BPM;
const bar = beat * 4;
console.log(`\nbeat ${beat.toFixed(4)}s   bar ${bar.toFixed(4)}s   phase ${PHASE}s`);
console.log(`want the lift at film ${HIT.toFixed(2)}s, window length ${VIDEO_S}s\n`);

const rows = [];
for (let m = 0; ; m++) {
  const start = PHASE + m * bar;
  if (start + VIDEO_S + 0.3 > duration) break;
  const hitAt = start + HIT;
  // Nearest real lift to where the film's big moment lands.
  const nearest = drops.reduce((p, c) => (Math.abs(c.t - hitAt) < Math.abs(p.t - hitAt) ? c : p));
  const offset = hitAt - nearest.t;
  const intro = mean(start, start + HIT - 1);
  const body = mean(start + HIT, start + VIDEO_S);
  // The tail is this film's addition: the last 8 seconds are the hold on the
  // sentence, and they have to be quieter than the lift or the film has no
  // resolution to close on.
  const tail = mean(start + VIDEO_S - 8, start + VIDEO_S) / loudest;
  rows.push({ start, offset, lift: body / (intro + 1e-9), dropRatio: nearest.ratio, dropAt: nearest.t, tail });
}
rows.sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset) || b.lift - a.lift);
console.log("  start      lift at    lands       lift after      strength   tail");
for (const r of rows.slice(0, 10)) {
  console.log(
    `  ${r.start.toFixed(3).padStart(8)}s  ${r.dropAt.toFixed(2).padStart(7)}s   ${(r.offset >= 0 ? "+" : "") + r.offset.toFixed(3)}s`.padEnd(44) +
      `${r.lift.toFixed(3).padStart(8)}x       x${r.dropRatio.toFixed(2).padStart(5)}  ${r.tail.toFixed(3)}`,
  );
}
console.log("");
