#!/usr/bin/env node
/**
 * Generate the film's narration with ElevenLabs Text to Speech.
 *
 * The script is `src/data/script.json`, owned by whoever writes the copy, and
 * cleared line by line in `docs/copy-clearance.md` (law #1). This file does not
 * invent, edit, shorten or "improve" a line. If the script is missing it stops;
 * a placeholder read is how a film ships saying something nobody approved.
 *
 * Three behaviours carried from ../archcanvas-promo-video/scripts/generate-sfx.mjs,
 * each of which exists because its absence cost something:
 *
 *   1. **Never overwrites silently.** An existing take is skipped unless
 *      `--force`. Regenerating costs credits, and a regenerated take has a
 *      different duration — which changes the film's clock (`src/data/vo.json`),
 *      which changes every station after it.
 *   2. **`--only <id>`** so one re-read after a copy fix does not re-buy eight.
 *   3. **No fallback, ever.** If the key lacks the Text to Speech scope this
 *      exits non-zero with one line saying so. It does not quietly fall back to
 *      a different model, a different provider, or silence.
 *
 * What it deliberately does NOT do: bake `leadInSec` / `tailSec` into the audio
 * as silence. Those are timeline intent and belong in the timeline. Silence
 * inside the mp3 becomes part of the measured duration, and
 * `scripts/measure-vo.mjs` exists precisely to strip it back off — writing it in
 * only to strip it out is a round trip through a lie.
 *
 * Usage:
 *   node --env-file=.env scripts/generate-vo.mjs --audition
 *   node --env-file=.env scripts/generate-vo.mjs
 *   node --env-file=.env scripts/generate-vo.mjs --only sentence --force
 *   node --env-file=.env scripts/generate-vo.mjs --dry
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_JSON = join(PROJECT, "src", "data", "script.json");
const OUT_DIR = join(PROJECT, "public", "audio");
const AUDITION_DIR = join(PROJECT, "out", "audition");
const BASE = "https://api.elevenlabs.io/v1";

const argv = process.argv.slice(2);
const AUDITION = argv.includes("--audition");
const DRY = argv.includes("--dry");
const FORCE = argv.includes("--force");
const onlyIdx = argv.indexOf("--only");
const ONLY = onlyIdx === -1 ? null : argv[onlyIdx + 1];

/**
 * The stations, in film order. `wall` carries no line on purpose — it is the
 * film's one deliberate silence, the only place the bed plays alone. A missing
 * or empty entry for it is correct, not an error.
 */
const STATIONS = ["interior", "pair", "drawing", "facts", "note", "lineage", "wall", "sentence", "mark"];
const SILENT_BY_DESIGN = new Set(["wall"]);

/**
 * Audition candidates: calm, unhurried, low-register, documentary rather than
 * announcer, and British-leaning because the product lives on a .uk domain and
 * an American announcer read would make it sound like an ad for something else.
 * All three are ElevenLabs premade voices, so they are available on every plan.
 *
 * The names below are what the library called them; `--audition` re-fetches
 * each id from /v1/voices and prints what the API actually says, so a stale id
 * shows up as a mismatch instead of as a mystery take.
 */
const CANDIDATES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", why: "warm, low, British; the reference documentary narrator. The safe default." },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", why: "British, clear and level, no announcer gloss. A woman's read for a product with a woman's name on it." },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", why: "British, softer and closer than Alice; the option if George reads as too authoritative for a film that ends on a small mark." },
];

/**
 * CHOSEN 2026-09-08: George, `JBFqnCBsd6RMkjVDRZzb`. The id lives in `.env`;
 * the decision lives here and in `.env.example`, because a bare id in a
 * gitignored dotfile is not something anyone can review later.
 *
 * The deciding argument was a mix argument, not a casting one. The music brief
 * (`docs/suno-prompt.md`) asks SUNO for a bed that is "deliberately hollow in
 * the middle" — weighted low and high, with 200–2000 Hz left empty because
 * that is where a speaking voice lives. George is the low-register read of the
 * three, so he sits in that gap rather than fighting the glass bells above it.
 * He is also close and unhurried on the graphite-night opening, where the first
 * line lands on near-black over near-silence and a brighter read would
 * announce rather than begin.
 *
 * Alice and Lily stay in the list because the choice is revisitable: if the
 * finished bed turns out warmer than briefed, Lily is the closer read, and
 * Alice is the one to try if George reads as institutional.
 */

const MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const OUTPUT_FORMAT = "mp3_44100_128";

/**
 * A stable per-station seed, so a re-read is at least *timing*-reproducible.
 *
 * The takes in `public/audio/` are gitignored, have no durable copy, and cost
 * credits — so "what happens if these are lost" is a real question. Measured on
 * 2026-09-08, against this voice and model:
 *
 *   no seed, twice        -> 28465 bytes / 29301 bytes   (different lengths)
 *   seed 4242, twice      -> 30137 bytes / 30137 bytes   (same length)
 *   seed 777, twice       -> 77824 samples / 77824 samples, 1.764717s both,
 *                            but DIFFERENT decoded PCM hashes
 *
 * So the seed buys exactly one thing, and it is the thing that matters most
 * here: **an identical duration, to the sample.** `src/data/vo.json` is the
 * film's clock, and a seeded re-read reproduces that clock exactly — every
 * station lands on the same frame, nothing needs re-cutting. It does NOT
 * reproduce the audio: the same seed gives a sample-level different read, so a
 * regenerated take is a different recording that happens to be the same length.
 * Do not describe seeding as making the takes reproducible; it makes the
 * *timeline* reproducible, which is a weaker and more useful claim.
 *
 * Derived from the station id rather than stored, so there is no seed registry
 * to lose and re-clearing a line does not shuffle it. FNV-1a, 32-bit, which is
 * the range the API accepts.
 *
 * NOTE: the eight takes generated on 2026-09-08 pre-date this and carry NO
 * seed. They are not reproducible even in duration. Regenerating them under
 * seeds costs eight requests and would change every take's measured length.
 */
const seedFor = (id) => {
  let h = 0x811c9dc5;
  for (const ch of id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};
// Higher stability than the default trades expressiveness for an even, unhurried
// read — which is the brief. style 0 keeps the model from performing the line.
const VOICE_SETTINGS = { stability: 0.55, similarity_boost: 0.75, style: 0, use_speaker_boost: true };

// ── the script ───────────────────────────────────────────────────────────────
if (!existsSync(SCRIPT_JSON)) {
  console.error(`generate-vo: src/data/script.json does not exist. The narration is written there, not here — every line has to carry a clearance row in docs/copy-clearance.md before it can be spoken.`);
  process.exit(1);
}
let script;
try {
  script = JSON.parse(readFileSync(SCRIPT_JSON, "utf8"));
} catch (e) {
  console.error(`generate-vo: src/data/script.json is not valid JSON — ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(script?.vo)) {
  console.error(`generate-vo: src/data/script.json has no "vo" array. Expected { vo: [ { id, text, leadInSec, tailSec } ] }.`);
  process.exit(1);
}

const byId = new Map(script.vo.map((l) => [l.id, l]));
const unknown = script.vo.map((l) => l.id).filter((id) => !STATIONS.includes(id));
if (unknown.length) {
  console.error(`generate-vo: src/data/script.json names stations this film does not have: ${unknown.join(", ")}. Known: ${STATIONS.join(", ")}.`);
  process.exit(1);
}

const lines = STATIONS.map((id) => {
  const entry = byId.get(id);
  const text = (entry?.text ?? "").trim();
  return { id, text, leadInSec: entry?.leadInSec ?? 0, tailSec: entry?.tailSec ?? 0 };
});

const missing = lines.filter((l) => !l.text && !SILENT_BY_DESIGN.has(l.id));
if (missing.length && !AUDITION) {
  console.error(`generate-vo: no line for station(s) ${missing.map((l) => l.id).join(", ")}. Only "${[...SILENT_BY_DESIGN].join(", ")}" may be silent.`);
  process.exit(1);
}

const spoken = lines.filter((l) => l.text);
const selected = ONLY ? spoken.filter((l) => l.id === ONLY) : spoken;
if (ONLY && !selected.length) {
  console.error(`generate-vo: no spoken line for station "${ONLY}". Spoken stations: ${spoken.map((l) => l.id).join(", ")}.`);
  process.exit(1);
}

// ── dry run ──────────────────────────────────────────────────────────────────
if (DRY) {
  console.log(`\n  generate-vo (dry run — nothing requested, nothing charged)\n`);
  console.log(`  model ${MODEL}  ·  voice ${process.env.ELEVENLABS_VOICE_ID || "(unset — run --audition and put the winner in .env)"}\n`);
  for (const l of lines) {
    const file = join(OUT_DIR, `vo-${l.id}.mp3`);
    if (!l.text) {
      console.log(`  ${l.id.padEnd(10)} — silent by design`);
      continue;
    }
    const state = existsSync(file) ? "exists (would skip without --force)" : "would generate";
    const chosen = !ONLY || l.id === ONLY;
    console.log(`  ${l.id.padEnd(10)} ${chosen ? state : "not selected"}   lead ${l.leadInSec}s / tail ${l.tailSec}s   seed ${seedFor(l.id)}`);
    console.log(`    "${l.text}"\n`);
  }
  process.exit(0);
}

// ── key ──────────────────────────────────────────────────────────────────────
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("generate-vo: ELEVENLABS_API_KEY is not set. Run with: node --env-file=.env scripts/generate-vo.mjs");
  process.exit(1);
}

/**
 * One place that turns an HTTP failure into a diagnosis. 401/403 on a TTS route
 * with a key that works for sound effects means one thing and only one thing,
 * and saying it in one line is the difference between a five-minute fix and an
 * afternoon of wondering whether the voice id is wrong.
 *
 * Note the deliberate lack of a fallback path. There is no second provider, no
 * cheaper model, no silent placeholder. A film whose narration silently became
 * something else is worse than a film that did not build.
 */
const diagnose = async (res, what) => {
  const body = await res.text().catch(() => "");
  const brief = body.replace(/\s+/g, " ").slice(0, 300);
  if (res.status === 401 || res.status === 403) {
    console.error(`generate-vo: ${what} refused (HTTP ${res.status}). The ELEVENLABS_API_KEY works but does not carry the "Text to Speech" scope — the older archcanvas film only ever used Sound Effects. Add Text to Speech to the key in the ElevenLabs dashboard, or issue a new key with both scopes. No fallback was used. [${brief}]`);
    process.exit(2);
  }
  if (res.status === 402 || res.status === 429) {
    console.error(`generate-vo: ${what} refused (HTTP ${res.status}) — out of credits or rate limited. Nothing was written. [${brief}]`);
    process.exit(3);
  }
  console.error(`generate-vo: ${what} failed (HTTP ${res.status} ${res.statusText}). [${brief}]`);
  process.exit(1);
};

const speak = async (voiceId, text, seed) => {
  const res = await fetch(`${BASE}/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: VOICE_SETTINGS, ...(seed == null ? {} : { seed }) }),
  });
  if (!res.ok) await diagnose(res, `text-to-speech for voice ${voiceId}`);
  return Buffer.from(await res.arrayBuffer());
};

// ── audition ─────────────────────────────────────────────────────────────────
if (AUDITION) {
  // The `pair` line, because it is representative: mid-film, a full sentence,
  // and it has to carry the film's one turn of tone without being the closer.
  const sample = byId.get("pair")?.text?.trim();
  if (!sample) {
    console.error(`generate-vo: --audition needs the "pair" line in src/data/script.json to read; it is the representative line.`);
    process.exit(1);
  }

  mkdirSync(AUDITION_DIR, { recursive: true });
  console.log(`\n  audition — ${CANDIDATES.length} voices, one line, ${MODEL}`);
  console.log(`  "${sample}"\n`);

  for (const c of CANDIDATES) {
    // Confirm the id against the API rather than trusting a hard-coded name.
    let apiName = null;
    const info = await fetch(`${BASE}/voices/${c.id}`, { headers: { "xi-api-key": KEY } });
    if (info.ok) {
      const j = await info.json().catch(() => null);
      apiName = j?.name ?? null;
    } else if (info.status === 401 || info.status === 403) {
      await diagnose(info, `voice lookup for ${c.id}`);
    }

    const audio = await speak(c.id, sample); // unseeded: this is a casting comparison, not a take
    const file = join(AUDITION_DIR, `${c.name.toLowerCase()}-${c.id}.mp3`);
    writeFileSync(file, audio);
    const label = apiName && apiName !== c.name ? `${apiName} (listed here as ${c.name})` : c.name;
    console.log(`  ${label.padEnd(34)} ${c.id}`);
    console.log(`    ${c.why}`);
    console.log(`    ${file}\n`);
  }

  console.log(`  Listen, then put the winner in .env as ELEVENLABS_VOICE_ID= and run:`);
  console.log(`    node --env-file=.env scripts/generate-vo.mjs\n`);
  process.exit(0);
}

// ── the read ─────────────────────────────────────────────────────────────────
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
if (!VOICE_ID) {
  console.error("generate-vo: ELEVENLABS_VOICE_ID is not set. Run --audition first, listen to out/audition/, and put the winner in .env.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
let generated = 0, skipped = 0;

for (const line of selected) {
  const file = join(OUT_DIR, `vo-${line.id}.mp3`);
  if (existsSync(file) && !FORCE) {
    console.log(`  · ${line.id.padEnd(10)} skipped (exists) — pass --force to re-read`);
    skipped++;
    continue;
  }
  const seed = seedFor(line.id);
  const audio = await speak(VOICE_ID, line.text, seed);
  writeFileSync(file, audio);
  console.log(`  ✓ ${line.id.padEnd(10)} ${(audio.length / 1024).toFixed(1)}KB  seed ${seed}  "${line.text.slice(0, 44)}${line.text.length > 44 ? "…" : ""}"`);
  generated++;
}

console.log(`\n  ${generated} read · ${skipped} skipped · voice ${VOICE_ID} · ${MODEL}`);
if (generated) console.log(`  Now run: npm run vo:measure   (the film's clock changes when a take does)\n`);
else console.log("");
