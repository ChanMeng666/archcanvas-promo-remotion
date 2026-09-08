#!/usr/bin/env node
/**
 * Locate a transient precisely, then report the beat-aligned window start that
 * lands it on a given time in the film.
 *
 * The coarse jump detector in find-window.mjs smooths over two seconds either
 * side, so it reports the middle of a rise rather than its edge. This measures
 * the steepest short-term rise inside a narrow search band instead — run
 * find-window.mjs first to get the band, then run this to get the number you
 * actually pass to prepare-bed.ps1.
 *
 * Why the precision is worth the extra step in a film with no cuts: the
 * reversal at ~72s is the one hard direction change in 85 seconds of continuous
 * motion, and the ear is far better at hearing a music lift arrive slightly
 * *after* a visual change than slightly before. Half a second of slop is the
 * difference between "the music answered the camera" and "the music was late".
 *
 * Ported unchanged in method from
 * ../she-sharp-promo-video-event-lesmills-03-september-2026/tools/locate-drop.mjs.
 * Only the decode was changed (pipe instead of a temp .raw file) and the
 * vocabulary ("drop" -> "lift"), because this film does not have a drop and
 * asking SUNO for one is on the Exclude list.
 *
 * Usage:
 *   node tools/locate-drop.mjs "<audio>" <searchFrom> <searchTo> <bpm> <phase> <hitSeconds>
 *
 * e.g. to pin down the lift analyze-music put near 112s and land it at film 72s:
 *   node tools/locate-drop.mjs "audio/source/take.mp3" 108 116 98.35 0.46 72
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const [input, fromArg, toArg, bpmArg, phaseArg, hitArg] = process.argv.slice(2);
const FROM = Number(fromArg);
const TO = Number(toArg);
const BPM = Number(bpmArg);
const PHASE = Number(phaseArg);
const HIT = Number(hitArg);

if (!input || !existsSync(input) || ![FROM, TO, BPM, PHASE, HIT].every(Number.isFinite)) {
  console.error('usage: node tools/locate-drop.mjs "<audio>" <searchFrom> <searchTo> <bpm> <phase> <hitSeconds>');
  process.exit(1);
}

// 16kHz here, not 8kHz: this is measuring a 300ms edge, and the extra bandwidth
// sharpens the attack the RMS envelope sees.
const SR = 16000;
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

// 10ms RMS.
const HOP = SR / 100;
const frames = Math.floor(n / HOP);
const env = new Float32Array(frames);
for (let f = 0; f < frames; f++) {
  let s = 0;
  for (let i = f * HOP; i < (f + 1) * HOP; i++) s += x[i] * x[i];
  env[f] = Math.sqrt(s / HOP);
}

const win = (a, b) => {
  let s = 0;
  for (let f = Math.max(0, a); f < Math.min(frames, b); f++) s += env[f];
  return s / Math.max(1, Math.min(frames, b) - Math.max(0, a));
};

// Steepest rise: 300ms after vs 300ms before, stepped every 10ms.
let best = { t: 0, ratio: -Infinity };
const trace = [];
for (let f = Math.round(FROM * 100); f < Math.round(TO * 100); f++) {
  const ratio = win(f, f + 30) / (win(f - 30, f) + 1e-9);
  trace.push({ t: f / 100, ratio });
  if (ratio > best.ratio) best = { t: f / 100, ratio };
}

console.log(`steepest rise in ${FROM}-${TO}s:  ${best.t.toFixed(3)}s  (x${best.ratio.toFixed(2)} over 300ms)\n`);
console.log("rise profile (10ms steps, only where ratio > 1.15)");
for (const p of trace) {
  if (p.ratio > 1.15) console.log(`  ${p.t.toFixed(2)}s  x${p.ratio.toFixed(3)}`);
}

const beat = 60 / BPM;
const bar = beat * 4;
const nearestBeat = PHASE + Math.round((best.t - PHASE) / beat) * beat;
const nearestBar = PHASE + Math.round((best.t - PHASE) / bar) * bar;
console.log(`\nnearest beat line ${nearestBeat.toFixed(4)}s  (transient is ${((best.t - nearestBeat) * 1000).toFixed(0)}ms off)`);
console.log(`nearest bar line  ${nearestBar.toFixed(4)}s  (transient is ${((best.t - nearestBar) * 1000).toFixed(0)}ms off)`);

console.log(`\nto land this on film ${HIT.toFixed(4)}s:`);
for (const [label, target] of [["measured transient", best.t], ["nearest beat line", nearestBeat], ["nearest bar line", nearestBar]]) {
  const ideal = target - HIT;
  const k = Math.round((ideal - PHASE) / beat);
  const snapped = PHASE + k * beat;
  const err = (snapped + HIT - target) * 1000;
  console.log(
    `  ${label.padEnd(20)} ideal start ${ideal.toFixed(4)}s -> beat-aligned ${snapped.toFixed(4)}s  (beat ${k}, lands ${err >= 0 ? "+" : ""}${err.toFixed(0)}ms, bar-aligned: ${k % 4 === 0 ? "yes" : "no"})`,
  );
}
console.log("");
