#!/usr/bin/env node
/**
 * Generate the film's sound effects with ElevenLabs, and measure what came back.
 *
 * Eight of the twelve cues below already exist: they were generated for
 * ../archcanvas-promo-video and are staged into `public/audio/` by
 * `scripts/sync-assets.mjs`. Their prompts are reproduced here verbatim from
 * that project's `audio/sfx-manifest.json` so this file is the whole record and
 * so a regeneration reproduces the same sound rather than a new one. They are
 * skipped as "exists"; nothing re-buys them.
 *
 * Four are new, because this film is one continuous camera move rather than a
 * sequence of cuts, and a continuous move needs sounds a cut film does not. The
 * argument for each is in `docs/sfx-brief.md`.
 *
 * Three behaviours carried from ../archcanvas-promo-video/scripts/generate-sfx.mjs,
 * each of which exists because its absence cost something:
 *
 *   1. **`--dry` is free.** Prints exactly what would be requested and stops.
 *      Generation costs credits; previewing the prompts should not.
 *   2. **Never overwrites silently.** An existing file is skipped unless
 *      `--force`. Use `--only <id>` to regenerate one cue after a prompt change.
 *   3. **Measures what came back, not what was asked for.** `duration_seconds`
 *      is a request, not a contract; the mix needs the real length. Every file
 *      is probed with ffprobe and the measured duration written to the
 *      manifest. An estimate that drifts from the file is how a cue lands late.
 *
 * Everything is written to `public/audio/` and nowhere else. An earlier version
 * of this file also kept a copy at the repo root, reasoning that `public/` is
 * gitignored and these cues cost credits. That was wrong twice over: the root
 * `audio/` is only gitignored at `audio/source/*`, so the copies would have
 * been committed as tracked binaries — the exact thing the ignore policy
 * exists to prevent — and the manifest below already records every prompt, so
 * the *recipe* is durable even though the bytes are not. `audio/source/` stays
 * what it is for: the SUNO drop point.
 *
 * Usage:
 *   node --env-file=.env scripts/generate-sfx.mjs --dry
 *   node --env-file=.env scripts/generate-sfx.mjs
 *   node --env-file=.env scripts/generate-sfx.mjs --only sfx-paper-rush --force
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(PROJECT, "public", "audio"); // the only place cues are written
const MANIFEST = join(OUT_DIR, "sfx-manifest.json");
const BASE = "https://api.elevenlabs.io/v1";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const FORCE = argv.includes("--force");
const onlyIdx = argv.indexOf("--only");
const ONLY = onlyIdx === -1 ? null : argv[onlyIdx + 1];

/**
 * The cue list. `station` is where it lands and is documentation, not wiring —
 * the mix is authored in the composition. Prompts are deliberately terse and end
 * in a negative clause: the model reaches for reverb and "cinematic" tails
 * unless told not to, and this film is close, dry and small.
 *
 * `origin: "inherited"` means the file came from the older film and its prompt
 * is transcribed here for the record. `origin: "new"` means this film needs it.
 */
const CUES = [
  // ── inherited from ../archcanvas-promo-video ───────────────────────────────
  { id: "sfx-pencil-line", origin: "inherited", station: "drawing", seconds: 1.6,
    prompt: "A single graphite pencil line drawn quickly across heavy paper. Close, dry, small. No reverb, no room tone, no music." },
  { id: "sfx-ui-click", origin: "inherited", station: "facts", seconds: 0.6,
    prompt: "One soft muted mechanical key press. Very close, dry, short, low. No reverb, no click echo, no music." },
  { id: "sfx-tick", origin: "inherited", station: "facts", seconds: 0.5,
    prompt: "A single faint mechanical clock tick, small and distant, dry. No reverb, no music, no ticking loop." },
  { id: "sfx-paper-settle", origin: "inherited", station: "pair", seconds: 1.5,
    prompt: "A large sheet of drafting paper settling onto a wooden desk: one soft slap, then a brief rustle as it flattens. Close, dry. No reverb, no music." },
  { id: "sfx-paper-sweep", origin: "inherited", station: "lineage", seconds: 0.9,
    prompt: "A short soft sweep of a paper sheet moving past the microphone. Air only. No crinkle, no metallic tone, no reverb, no music." },
  { id: "sfx-instrument", origin: "inherited", station: "note", seconds: 0.9,
    prompt: "A small brass drafting compass set down on a wooden desk. One clean click and a tiny settle. Close, dry. No reverb, no music." },
  { id: "sfx-warm-swell", origin: "inherited", station: "wall", seconds: 2.6,
    prompt: "A soft low warm air swell rising smoothly and stopping. No impact, no hit, no reverb tail, no music, no whoosh sweep." },
  { id: "sfx-stamp", origin: "inherited", station: "mark", seconds: 1.0,
    prompt: "A rubber stamp pressed once onto paper on a hard desk. One dry thud with a short wooden knock. Close. No reverb, no room, no music." },

  // ── new, because this film is one continuous move ──────────────────────────
  //
  // The sound-generation endpoint accepts 0.5-30s, and the film is 85s, so this
  // one is designed to loop: 30s (the ceiling, so three passes cover the film
  // instead of five) and deliberately featureless, with no arrival anywhere in
  // it, so a crossfade seam has nothing to expose.
  { id: "sfx-room-air", origin: "new", station: "(under the whole film)", seconds: 30,
    prompt: "A very low continuous air tone in a large empty quiet room. Almost inaudible, flat and even from beginning to end, no movement and no shape. Close and warm. No hum, no drone note, no pitch, no hiss sweep, no rise, no reverb tail, no music." },
  // 0.5s is the endpoint's floor, not a choice — the sound wanted is ~150ms and
  // the tail is trimmed in the mix.
  { id: "sfx-detent", origin: "new", station: "(each zoom threshold)", seconds: 0.5,
    prompt: "One small sprung mechanical detent, a dial passing a single notch. Very close, dry, tiny, low. One event only. No reverb, no echo, no rattle, no spring ring, no music." },
  { id: "sfx-paper-rush", origin: "new", station: "sentence", seconds: 1.4,
    prompt: "A large sheet of paper rushing past the microphone in one fast pass. Grain and air, accelerating and then stopping cleanly. Close, dry. No crinkle, no tearing, no synth whoosh sweep, no reverb tail, no music." },
  { id: "sfx-final-settle", origin: "new", station: "mark", seconds: 1.2,
    prompt: "A single sheet of paper coming to rest on a wooden desk and going completely still. One soft contact, then nothing. Close, dry, small. No rustle loop, no second contact, no reverb, no music." },
];

const selected = ONLY ? CUES.filter((c) => c.id === ONLY) : CUES;
if (ONLY && !selected.length) {
  console.error(`generate-sfx: no cue named "${ONLY}". Known: ${CUES.map((c) => c.id).join(", ")}`);
  process.exit(1);
}

const probe = (file) => {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file], { encoding: "utf8" });
  const d = Number(r.stdout?.trim());
  return Number.isFinite(d) ? Number(d.toFixed(3)) : null;
};
// A cue is "present" if it sits where the composition reads it. The inherited
// eight are put there by sync:assets; the four new ones by this script.
const cueFile = (id) => join(OUT_DIR, `${id}.mp3`);

if (DRY) {
  console.log(`\n  generate-sfx (dry run — nothing requested, nothing charged)\n`);
  let would = 0;
  for (const c of selected) {
    const here = existsSync(cueFile(c.id)) ? cueFile(c.id) : null;
    const state = here ? `exists, ${probe(here) ?? "?"}s (would skip without --force)` : "would generate";
    if (!here || FORCE) would++;
    console.log(`  ${c.id.padEnd(18)} ${c.origin.padEnd(10)} ${String(c.seconds).padStart(4)}s  ${c.station.padEnd(24)} ${state}`);
    console.log(`    ${c.prompt}\n`);
  }
  console.log(`  ${would} request${would === 1 ? "" : "s"} would be charged. Rationale for the new cues: docs/sfx-brief.md\n`);
  process.exit(0);
}

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("generate-sfx: ELEVENLABS_API_KEY is not set.\n  Run with: node --env-file=.env scripts/generate-sfx.mjs");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { sfx: {} };
manifest.sfx ??= {};

let generated = 0, skipped = 0, failed = 0;

for (const cue of CUES) {
  const chosen = !ONLY || cue.id === ONLY;
  const present = existsSync(cueFile(cue.id));

  if (present && (!chosen || !FORCE)) {
    const d = probe(cueFile(cue.id));
    manifest.sfx[cue.id] = { file: `${cue.id}.mp3`, origin: cue.origin, station: cue.station, requested: cue.seconds, duration: d, prompt: cue.prompt };
    console.log(`  · ${cue.id.padEnd(18)} skipped (exists, ${d}s)${chosen ? " — pass --force to regenerate" : ""}`);
    skipped++;
    continue;
  }
  if (!chosen) continue;

  const res = await fetch(`${BASE}/sound-generation`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: cue.prompt, duration_seconds: cue.seconds, prompt_influence: 0.45 }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint = res.status === 401 || res.status === 403 ? "  (the key needs the Sound Effects scope)" : "";
    console.error(`  x ${cue.id.padEnd(18)} HTTP ${res.status} ${res.statusText}${hint}\n      ${body.replace(/\s+/g, " ").slice(0, 300)}`);
    failed++;
    continue;
  }

  writeFileSync(cueFile(cue.id), Buffer.from(await res.arrayBuffer()));
  const d = probe(cueFile(cue.id));
  const drift = d != null ? d - cue.seconds : null;
  manifest.sfx[cue.id] = { file: `${cue.id}.mp3`, origin: cue.origin, station: cue.station, requested: cue.seconds, duration: d, prompt: cue.prompt };
  console.log(`  + ${cue.id.padEnd(18)} ${cue.station.padEnd(24)} ${d}s` +
    (drift != null && Math.abs(drift) > 0.25 ? `  <- ${drift > 0 ? "+" : ""}${drift.toFixed(2)}s vs requested` : ""));
  generated++;
}

manifest.generatedAt = new Date().toISOString();
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n  ${generated} generated · ${skipped} skipped · ${failed} failed`);
console.log(`  manifest: public/audio/sfx-manifest.json · durable copies: audio/\n`);
process.exit(failed ? 1 : 0);
