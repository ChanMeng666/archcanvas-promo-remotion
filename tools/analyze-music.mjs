#!/usr/bin/env node
/**
 * Measure a long music take: how fast it is, what shape its arrangement has,
 * where its real accents sit, and which window of it fits this film.
 *
 * This film is ONE continuous 85-second camera move. It has no cuts, so unlike
 * the sibling films there is no beat grid to hit — nothing on screen changes on
 * a downbeat. What the film needs from the music instead is a *shape*: near
 * silence at the open, one continuous opening-out, and the strongest lift
 * landing at the reversal (~72s), where the camera stops pulling back and
 * rushes home. So this tool reports tempo (useful for bar-aligning the cut so
 * the bed sounds like it starts rather than resumes) but spends most of its
 * output on the arrangement profile and on window candidates scored by shape.
 *
 * Ported from ../she-sharp-promo-video-event-lesmills-03-september-2026/tools/
 * analyze-music.mjs, merged with ../archcanvas-promo-video/scripts/analyze-music.mjs.
 * Where the two disagreed:
 *
 *   - **Fractional autocorrelation lag** — taken from she-sharp. archcanvas
 *     rounds the lag to whole 10ms frames, which makes several neighbouring BPM
 *     values share one lag; the curve becomes plateaus and every local peak
 *     hides. Kept the fractional interpolation.
 *   - **Smoothing the onset envelope — READ THIS ONE.** Taken from archcanvas,
 *     where it looks like a cosmetic tidy-up applied only to peak picking. It
 *     is not cosmetic and it is not optional, and the wrong turn is written out
 *     here in full because it is easy to re-take and it fails *quietly*: you
 *     get a confident number that is simply wrong.
 *
 *     she-sharp differences the raw 10ms log envelope and autocorrelates that.
 *     archcanvas first takes a ±3-frame (±30ms) mean of the log envelope and
 *     differences THAT. The first version of this port followed she-sharp,
 *     reasoning that smoothing lowpasses exactly the periodicity the
 *     autocorrelation is looking for. Measured on the reference take
 *     (`../archcanvas-promo-video/audio/source/drafting-room-full.mp3`):
 *
 *         raw flux,    fractional lag, 60-200 -> best 109.10 BPM
 *         smooth flux, fractional lag, 60-200 -> best  98.35 BPM
 *         raw flux,    archcanvas's own grid  -> best 108.25 BPM
 *         smooth flux, archcanvas's own grid  -> best  97.75 BPM   <- the recorded figure
 *
 *     So the 97.75 the old project recorded is reproducible ONLY from the
 *     smoothed flux, and 98.35 is that same answer measured on a finer grid.
 *     The raw-flux 109.1 is not a near miss and not an octave error — it is a
 *     lock onto the frame-scale noise floor, which in a felt-piano and
 *     brushed-percussion bed is loud enough to out-vote the beat. Worse, the
 *     phase-lock table below could not rescue it: on raw flux the lowest drift
 *     in the whole candidate set belonged to 146.35 BPM, a tempo outside the
 *     top peak's octave family entirely.
 *
 *     Hence: **every** stage here — tempo autocorrelation, the phase-lock comb,
 *     and peak picking — runs on the one smoothed `flux` array. There is
 *     deliberately no second, unsmoothed copy to reach for by accident.
 *   - **Peak picking with a musical minimum gap** — taken from archcanvas.
 *     she-sharp has no onset list at all; this film needs one, because "the
 *     single strongest accent in the take" is the thing that has to land at 72s.
 *   - **Octave disambiguation by phase lock** — taken from she-sharp, and it is
 *     the most valuable thing in either file. Autocorrelation peaks at the bar
 *     as readily as at the beat, so its raw maximum is often a half or a
 *     quarter of the true tempo. See the block that prints the phase-lock table.
 *
 *     **The octave-family restriction is NOT inherited — it is new here.**
 *     she-sharp printed the table against five hand-typed probes and left a
 *     human to read it. This port derives the probes, which makes it general,
 *     and that generality introduced a failure the original could not have: a
 *     tempo unrelated to the beat can score a low drift by luck and win an
 *     automated pick. One did, in the draft described above. So the probe set
 *     is now split — the raw best's octave family (x0.25 .. x4) is *eligible*,
 *     every other local peak is printed as *context only* and cannot win. If
 *     you ever make the winner selectable from the full set again, you are
 *     re-opening that hole.
 *   - **JSON output** — taken from archcanvas, so the numbers can be diffed.
 *
 * Method: decode to 8 kHz mono, take a 10ms RMS envelope, difference it in the
 * log domain and half-wave rectify (positive energy flux only — a note starting
 * is an onset, a note ending is not). Log domain because a bed that swells 6 dB
 * late would otherwise drown every early onset; we want attacks, not loudness.
 *
 * Usage:
 *   node tools/analyze-music.mjs "<audio>" [videoSeconds] [--land 72]
 *                                [--top 14] [--probe 92,97.75] [--json]
 *
 * Read-only. Cutting is tools/prepare-bed.ps1.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const argv = process.argv.slice(2);
// Flags that consume the next argv entry, so it is not mistaken for a positional.
const VALUED = new Set(["--land", "--top", "--probe"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && VALUED.has(argv[i - 1])));
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(argv[i + 1]);
};
const flagStr = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : argv[i + 1];
};

const AUDIO = positional[0];
const VIDEO_S = Number(positional[1] ?? 85);
const LAND = flag("land", 72);
const TOP = flag("top", 14);
const JSON_OUT = argv.includes("--json");

if (!AUDIO || !existsSync(AUDIO)) {
  console.error('usage: node tools/analyze-music.mjs "<audio file>" [videoSeconds] [--land 72] [--json]');
  process.exit(1);
}

const SR = 8000;
const HOP = 80; // samples = 10ms

// -vn matters: a SUNO export carries an embedded mjpeg cover-art stream, and
// without it ffmpeg will happily try to make sense of the picture.
// Piped to stdout rather than through a temp file — she-sharp writes a .raw to
// $TEMP and unlinks it; a 200s take at 8kHz mono is only ~3MB, so the pipe is
// simpler and leaves nothing behind if the process dies.
const dec = spawnSync(
  "ffmpeg",
  ["-v", "error", "-vn", "-i", AUDIO, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"],
  { maxBuffer: 1 << 30, encoding: "buffer" },
);
if (dec.status !== 0) {
  console.error("ffmpeg decode failed:\n" + dec.stderr.toString());
  process.exit(1);
}

// Read through the Buffer rather than aliasing an Int16Array onto it. Node may
// hand back a Buffer whose byteOffset is odd, and Int16Array construction
// throws on an unaligned offset — a failure that only shows up on some inputs.
const raw = dec.stdout;
const nSamples = Math.floor(raw.length / 2);
const x = new Float32Array(nSamples);
for (let i = 0; i < nSamples; i++) x[i] = raw.readInt16LE(i * 2) / 32768;
const duration = nSamples / SR;

// ── 10ms RMS envelope ────────────────────────────────────────────────────────
const nFrames = Math.floor(nSamples / HOP);
const rms = new Float64Array(nFrames);
for (let f = 0; f < nFrames; f++) {
  let acc = 0;
  const base = f * HOP;
  for (let i = 0; i < HOP; i++) { const v = x[base + i]; acc += v * v; }
  rms[f] = Math.sqrt(acc / HOP);
}

// ── onset strength: positive flux of the smoothed log envelope ───────────────
// The ±30ms mean before differencing is not cosmetic: see the note in the
// header. Without it the frame-scale noise floor of this kind of material wins
// the autocorrelation and the reported tempo is wrong by an octave-ish ratio
// that no phase-lock table can rescue.
const logEnv = Float64Array.from(rms, (v) => Math.log10(v + 1e-6));
const SMOOTH = 3;
const smoothed = new Float64Array(nFrames);
for (let f = 0; f < nFrames; f++) {
  let acc = 0, n = 0;
  for (let k = -SMOOTH; k <= SMOOTH; k++) {
    const j = f + k;
    if (j >= 0 && j < nFrames) { acc += logEnv[j]; n++; }
  }
  smoothed[f] = acc / n;
}
const flux = new Float64Array(nFrames);
for (let f = 1; f < nFrames; f++) flux[f] = Math.max(0, smoothed[f] - smoothed[f - 1]);

// ── tempo: autocorrelation of the onset envelope, 60–200 BPM ─────────────────
const mean = flux.reduce((a, b) => a + b, 0) / nFrames;
const centred = Float64Array.from(flux, (v) => v - mean);
const results = [];
let best = { bpm: 0, score: -Infinity };
/*
 * Fractional lag with linear interpolation. Rounding the lag to whole 10ms
 * frames makes several neighbouring BPM values share one lag, which turns the
 * curve into plateaus and hides every local peak.
 */
for (let bpm = 60; bpm <= 200; bpm += 0.05) {
  const lag = (60 / bpm) * 100;
  const l0 = Math.floor(lag);
  const frac = lag - l0;
  let s = 0, count = 0;
  for (let f = 0; f + l0 + 1 < nFrames; f++) {
    const shifted = centred[f + l0] * (1 - frac) + centred[f + l0 + 1] * frac;
    s += centred[f] * shifted;
    count++;
  }
  s /= count;
  results.push({ bpm: Number(bpm.toFixed(2)), score: s });
  if (s > best.score) best = { bpm: Number(bpm.toFixed(2)), score: s };
}

/*
 * Autocorrelation peaks at the bar as readily as at the beat, so the raw
 * maximum is often a half or quarter of the real tempo. Print the distinct
 * local peaks and let the shape of the list decide.
 */
const peaksBpm = results
  .filter((c, i) => i > 1 && i < results.length - 2 && c.score > results[i - 1].score && c.score > results[i + 1].score)
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);

/*
 * Decide between octave/sidelobe candidates.
 *
 * A correct tempo holds phase across the whole track: the best beat phase found
 * in the first third and the last third agree. A tempo that is off by even a
 * fraction of a percent drifts, so its two phases disagree and its comb score
 * over the full track is much weaker than over a short span. `drift` is the
 * column to read — the winner is the small one, not the loud one.
 */
const combScore = (bpm, t0, t1) => {
  const beatFrames = (60 / bpm) * 100;
  const a = Math.round(t0 * 100);
  const z = Math.min(nFrames, Math.round(t1 * 100));
  let bestPhase = 0, bestSum = -Infinity;
  for (let p = 0; p < Math.round(beatFrames); p++) {
    let s = 0;
    for (let f = a + p; f < z; f += beatFrames) s += flux[Math.round(f)] ?? 0;
    const norm = s / ((z - a) / beatFrames);
    if (norm > bestSum) { bestSum = norm; bestPhase = p; }
  }
  return { score: bestSum, phase: bestPhase / 100 };
};

// Derive the probe list instead of hand-typing it — she-sharp hard-coded five
// values that only meant anything for that one track.
//
// Two sets, and the distinction matters. The *octave family* of the raw best
// (x0.25 .. x4) is what this test is actually for: the question the phase lock
// answers is "did autocorrelation lock onto the beat, the half-beat or the
// bar?". Other local peaks are printed for context but are NOT eligible to
// win, because an unrelated tempo can score a low drift by luck — an earlier
// draft of this file let one do exactly that and confidently reported a tempo
// that was not in the top autocorrelation peak's family at all.
const probeArg = flagStr("probe", null);
const family = new Set();
const context = new Set();
if (probeArg) {
  for (const v of probeArg.split(",").map(Number)) family.add(Number(v.toFixed(2)));
} else {
  for (const m of [0.25, 0.5, 1, 2, 4]) {
    const v = Number((best.bpm * m).toFixed(2));
    if (v >= 60 && v <= 200) family.add(v);
  }
  for (const p of peaksBpm.slice(0, 6)) {
    const v = Number(p.bpm.toFixed(2));
    if (!family.has(v)) context.add(v);
  }
}
const probes = [...new Set([...family, ...context])].sort((a, b) => a - b).map((bpm) => {
  const full = combScore(bpm, 0, duration);
  const p1 = combScore(bpm, 0, duration / 3);
  const p3 = combScore(bpm, (2 * duration) / 3, duration);
  const beatLen = 60 / bpm;
  let drift = Math.abs(p1.phase - p3.phase);
  drift = Math.min(drift, beatLen - drift);
  return { bpm, family: family.has(bpm), full: full.score, phaseFull: full.phase, first: p1.score, last: p3.score, phase1: p1.phase, phase3: p3.phase, drift };
});
// The phase-locked winner: least drift wins; full-track comb score breaks ties.
// Only the raw best's octave family is eligible — see the note above.
const locked = probes.filter((p) => p.family).sort((a, b) => a.drift - b.drift || b.full - a.full)[0] ?? null;

// ── peak picking, with a musical minimum spacing ─────────────────────────────
const gridBpm = locked?.bpm ?? best.bpm;
const beatFrames = Math.max(4, Math.round((60 / gridBpm) * 100));
const MIN_GAP = Math.max(beatFrames * 2, 60); // never two accents inside ~2 beats / 0.6s
const rawPeaks = [];
for (let f = 1; f < nFrames - 1; f++) {
  if (flux[f] <= flux[f - 1] || flux[f] < flux[f + 1]) continue;
  rawPeaks.push({ frame: f, t: f / 100, strength: flux[f] });
}
rawPeaks.sort((a, b) => b.strength - a.strength);
const onsets = [];
for (const p of rawPeaks) {
  if (onsets.every((c) => Math.abs(c.frame - p.frame) >= MIN_GAP)) onsets.push(p);
  if (onsets.length >= 200) break;
}

// ── arrangement profile ──────────────────────────────────────────────────────
// Peak picking alone chooses a window by one accent; it says nothing about
// whether that window OPENS quietly and SETTLES at the end, which is the whole
// requirement for a film that is one unbroken breath.
const BUCKET = 2; // seconds
const buckets = [];
for (let start = 0; start < duration; start += BUCKET) {
  const a = Math.floor(start * 100);
  const b = Math.min(nFrames, Math.floor((start + BUCKET) * 100));
  let acc = 0;
  for (let f = a; f < b; f++) acc += rms[f];
  buckets.push({ t: start, level: b > a ? acc / (b - a) : 0 });
}
const loudest = Math.max(...buckets.map((b) => b.level)) || 1;
const profile = buckets.map((b) => ({ t: b.t, rel: Number((b.level / loudest).toFixed(3)) }));

// ── window candidates ────────────────────────────────────────────────────────
const rmsBetween = (t0, t1) => {
  const a = Math.max(0, Math.round(t0 * 100));
  const z = Math.min(nFrames, Math.round(t1 * 100));
  let s = 0;
  for (let f = a; f < z; f++) s += rms[f];
  return s / Math.max(1, z - a);
};

/*
 * Two scorings, because the two reference tools each answered half the question.
 *
 * (a) accent-led — she-sharp/archcanvas both do this: for every strong onset,
 *     the window that puts it at LAND seconds into the cut.
 * (b) shape-led — this film's actual requirement. Score a window on: how quiet
 *     its first 10s are, how much louder the LAND moment is than the open, and
 *     whether it settles again by the end. A film with no cuts cannot hide a
 *     window that merely contains a good accent in the middle of a wall.
 */
const accentLed = onsets
  .filter((p) => p.t - LAND >= 0 && p.t - LAND + VIDEO_S <= duration)
  .map((p) => ({ windowStart: Number((p.t - LAND).toFixed(3)), accentAt: Number(p.t.toFixed(3)), strength: Number(p.strength.toFixed(4)) }))
  .sort((a, b) => b.strength - a.strength)
  .slice(0, 8);

const beat = 60 / gridBpm;
const bar = beat * 4;
const barPhase = locked?.phaseFull ?? 0;
const shapeLed = [];
for (let m = 0; ; m++) {
  // Bar-aligned starts. It matters even with no cuts: a bed that starts
  // mid-bar sounds like it resumed from somewhere, and the film's first
  // second is meant to feel like the beginning of something.
  const start = barPhase + m * bar;
  if (start < 0) continue;
  if (start + VIDEO_S > duration) break;
  const open = rmsBetween(start, start + 10);
  const atLand = rmsBetween(start + LAND - 2, start + LAND + 4);
  const tail = rmsBetween(start + VIDEO_S - 8, start + VIDEO_S);
  const body = rmsBetween(start, start + VIDEO_S);
  const lift = atLand / (open + 1e-9);
  // Quiet open (relative to the take's loudest block) and a settle at the end
  // are both rewarded; body level keeps us off a window that is merely quiet
  // throughout and then slightly less quiet.
  const quietOpen = 1 - Math.min(1, open / loudest);
  const settle = 1 - Math.min(1, tail / (atLand + 1e-9));
  const score = lift * (0.5 + quietOpen) * (0.5 + settle) * Math.pow(body / loudest, 0.75);
  shapeLed.push({
    start: Number(start.toFixed(3)),
    open: Number((open / loudest).toFixed(3)),
    land: Number((atLand / loudest).toFixed(3)),
    tail: Number((tail / loudest).toFixed(3)),
    lift: Number(lift.toFixed(2)),
    score: Number(score.toFixed(3)),
  });
}
shapeLed.sort((a, b) => b.score - a.score);

const report = {
  file: AUDIO,
  durationSec: Number(duration.toFixed(3)),
  rawBpm: best.bpm,
  bpm: gridBpm,
  secondsPerBeat: Number((60 / gridBpm).toFixed(4)),
  barSec: Number(bar.toFixed(4)),
  beatPhaseSec: Number(barPhase.toFixed(4)),
  window: VIDEO_S,
  landAt: LAND,
  tempoCandidates: peaksBpm.map((p) => ({ bpm: p.bpm, score: p.score })),
  phaseLock: probes.map((p) => ({ bpm: p.bpm, family: p.family, full: Number(p.full.toFixed(4)), first: Number(p.first.toFixed(4)), last: Number(p.last.toFixed(4)), phase1: Number(p.phase1.toFixed(3)), phase3: Number(p.phase3.toFixed(3)), drift: Number(p.drift.toFixed(3)) })),
  strongestOnsets: onsets.slice(0, TOP).sort((a, b) => a.t - b.t).map((p) => ({ t: Number(p.t.toFixed(2)), strength: Number(p.strength.toFixed(4)) })),
  strongestAccent: onsets.length ? { t: Number(onsets[0].t.toFixed(2)), strength: Number(onsets[0].strength.toFixed(4)) } : null,
  profile,
  windowsAccentLed: accentLed,
  windowsShapeLed: shapeLed.slice(0, 8),
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log(`\n  ${AUDIO}`);
console.log(`  ${report.durationSec}s · raw autocorrelation peak ${report.rawBpm} BPM`);
console.log(`  phase-locked ${report.bpm} BPM · beat ${report.secondsPerBeat}s · bar ${report.barSec}s · phase ${report.beatPhaseSec}s\n`);

console.log("  Tempo candidates (autocorrelation local peaks)");
for (const p of report.tempoCandidates) {
  console.log(`    ${p.bpm.toFixed(2).padStart(7)} BPM   score ${p.score.toExponential(3)}   x2 = ${(p.bpm * 2).toFixed(2)}`);
}

console.log("\n  Tempo disambiguation (beat-grid phase lock — least drift wins within the octave family)");
console.log("    bpm      full-track   first-third   last-third   phase(1st)  phase(3rd)     drift");
for (const p of report.phaseLock) {
  const mark = locked && p.bpm === locked.bpm ? " <- locked" : p.family ? "" : "   (context only)";
  console.log(
    `    ${p.bpm.toFixed(2).padStart(6)}  ${p.full.toFixed(4).padStart(11)}  ${p.first.toFixed(4).padStart(12)}  ${p.last.toFixed(4).padStart(11)}  ${p.phase1.toFixed(3).padStart(9)}s  ${p.phase3.toFixed(3).padStart(9)}s  ${p.drift.toFixed(3).padStart(7)}s${mark}`,
  );
}

console.log(`\n  Arrangement (relative RMS, ${BUCKET}s blocks)`);
for (const b of report.profile) {
  const n = Math.round(b.rel * 44);
  console.log(`    ${String(b.t).padStart(5)}s |${"#".repeat(n)}${" ".repeat(44 - n)}| ${b.rel.toFixed(2)}`);
}

console.log("\n  Strongest onsets (source time)");
for (const o of report.strongestOnsets) {
  const bar_ = "|".repeat(Math.max(1, Math.round(o.strength * 60)));
  console.log(`    ${String(o.t).padStart(7)}s  ${bar_} ${o.strength}`);
}
if (report.strongestAccent) {
  console.log(`\n  Strongest accent in the take: ${report.strongestAccent.t}s (strength ${report.strongestAccent.strength})`);
}

console.log(`\n  Accent-led windows — put a strong onset at ${LAND}s of a ${VIDEO_S}s cut`);
console.log("    window start   accent at   strength");
for (const c of report.windowsAccentLed) {
  console.log(`    ${c.windowStart.toFixed(3).padStart(11)}s  ${c.accentAt.toFixed(2).padStart(9)}s   ${c.strength}`);
}

console.log(`\n  Shape-led windows — quiet open, lift at ${LAND}s, settled tail (bar-aligned)`);
console.log("    start        open   at-land   tail    lift   score");
for (const c of report.windowsShapeLed) {
  console.log(
    `    ${c.start.toFixed(3).padStart(9)}s  ${c.open.toFixed(3).padStart(5)}  ${c.land.toFixed(3).padStart(7)}  ${c.tail.toFixed(3).padStart(5)}  ${c.lift.toFixed(2).padStart(6)}x  ${c.score.toFixed(3).padStart(6)}`,
  );
}
console.log("");
