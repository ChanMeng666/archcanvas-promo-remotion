#!/usr/bin/env node
/**
 * The numbers gate. Fails the build when the film crosses one drawing's numbers with
 * another's.
 *
 * CLAUDE.md law 2: nothing on screen is mocked up, a rendering is only ever shown beside
 * ITS OWN drawing, and a drawing's numbers are only ever that drawing's numbers. That law
 * has teeth here because this film shows THREE different pieces of real material, and two
 * of them look almost identical to a viewer:
 *
 *   1. `plan-family-house.svg` - the showcase plan, 9 rooms, 121.5 m2, 11 windows, single
 *      storey. Its three renderings (`render-family-house-*.webp`) were generated from a
 *      raster of THIS drawing and belong to it and to no other. Stations interior -> facts.
 *
 *   2. `plan-hero.svg` - the first film's hero drawing, 6 rooms, 109.8 m2, with a room
 *      schedule of its own. Station lineage.
 *
 *   3. THE FILMED SESSION (`c01-brief-typing.mp4` ... `c13-timeline.mp4`) - a live capture
 *      whose plan is NEITHER of the above. Its own on-screen room schedule reads 4 rooms
 *      totalling 108.00 m2, and the brief typed into it says "about 110 m2". Stations note
 *      and sentence.
 *
 * THE TRAP THIS FILE EXISTS FOR. The review pin the camera pans past at station `note` is
 * the product's own words, read off c06-review-pins.mp4: "The 110m2 plan provides no
 * bathroom, laundry, or dedicated storage." That sentence is TRUE of the session's own
 * 4-room drawing and FALSE of both staged plans - plan-family-house.svg has a Bath AND a
 * Laundry, and plan-hero.svg has a Bathroom. Showing that pin over either of them would put
 * a visible falsehood on screen while the voiceover is making the film's one honesty claim.
 * Check D below is the tripwire for exactly that.
 *
 * Four checks:
 *
 *   A. drift        - every staged drawing still contains its own room names and areas.
 *   B. crossed      - every area-shaped numeral in a station's copy is owned by a drawing
 *                     that station is allowed to show, and by no other.
 *   C. mispaired    - no component references a rendering alongside a plan that is not its own.
 *   D. pin          - the review pin never appears beside a plan it was not written about.
 *
 * Usage:  node capture/verify-numbers.mjs [--json]
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");

// ── the record ───────────────────────────────────────────────────────────────
// Machine-measured, from the product's own data and from the footage itself - never a
// guess and never a round number. `plan-family-house` traces to SHOWCASE_PLANS in
// archcanvas/src/lib/showcase.generated.ts (slug "family-house"); `plan-hero` traces to the
// first film's own verify-assets.mjs RECORD; `session-2026-08` was read off the capture,
// frame by frame, at the timestamps named below. Changing a figure here without changing
// the artwork it came from is a bug, which is the whole point of writing it down.

const RECORD = {
  "plan-family-house": {
    file: "plans/plan-family-house.svg",
    alsoStagedAs: ["plans/plan-family-house-sheet.svg", "plans/plan-family-house-annotated.svg"],
    source: "archcanvas SHOWCASE_PLANS['family-house'].facts",
    rooms: 9,
    areaM2: "121.5",
    windows: 11,
    storeys: 1,
    /** Label -> area, exactly as the drawing prints them. */
    schedule: {
      "Living / Dining": "19.4",
      "Bedroom 1": "15.0",
      "Bedroom 2": "10.6",
      "Bedroom 3": "9.7",
      Kitchen: "17.3",
      Hall: "13.8",
      Bath: "10.9",
      Laundry: "9.4",
      "Entry / Study": "15.6",
    },
    /** These renderings were generated from a raster of THIS drawing. */
    renders: [
      "render-family-house-aerial",
      "render-family-house-exterior",
      "render-family-house-interior",
    ],
    /** Numerals that identify this drawing on screen. Shared tokens are resolved below. */
    numerals: ["121.5", "19.4", "15.0", "10.6", "9.7", "17.3", "13.8", "10.9", "9.4", "15.6", "12400", "9800"],
  },

  "plan-hero": {
    file: "plans/plan-hero.svg",
    alsoStagedAs: [],
    source: "archcanvas-promo-video/capture/verify-assets.mjs RECORD",
    rooms: 6,
    areaM2: "109.8",
    storeys: 1,
    schedule: {
      "Open Kitchen / Living Room": "48.0",
      Hall: "18.0",
      "Bedroom 1": "10.9",
      "Bedroom 2": "10.9",
      Bathroom: "10.9",
      "Bedroom 3": "10.9",
    },
    renders: [],
    numerals: ["109.8", "48.0", "18.0", "10.9", "12200", "9350"],
  },

  "session-2026-08": {
    /** Not a staged SVG - a filmed screen. There is nothing on disk to parse. */
    file: null,
    alsoStagedAs: [],
    source:
      "read off archcanvas-promo-video/capture/assets/videos/: the brief at c01-brief-typing.mp4 t=44.0s, the room schedule and the review pin at c06-review-pins.mp4 t=8.30s and t=20.0s",
    rooms: 4,
    areaM2: "108.00",
    schedule: {
      "Open Kitchen / Living Room": "54.00",
      "Bedroom 1": "18.00",
      "Bedroom 2": "18.00",
      "Bedroom 3": "18.00",
    },
    renders: [],
    /** "110" is the brief's own "about 110 m2" and the pin's own "110m2" - same session. */
    numerals: ["108.00", "110", "54.00", "18.00"],
  },
};

/**
 * The review pin, verbatim, and the plans it was NOT written about. It says there is no
 * bathroom; both staged plans have one.
 */
const PIN = {
  text: "The 110m² plan provides no bathroom, laundry, or dedicated storage.",
  needle: /provides no bathroom, laundry, or dedicated storage/i,
  belongsTo: "session-2026-08",
  read: "c06-review-pins.mp4 t=20.0s (card open from t~12s to the end of the 44s clip)",
};

/**
 * Which drawing each station is allowed to show. `wall` and `mark` show no drawing at all,
 * so no area figure may appear at either.
 *
 * NOTE ON `note`: the brief for this film assigned stations `interior` through `note` to
 * plan-family-house. The footage says otherwise - a review pin only exists inside the
 * product, and the only real one available is the c06 one, which is about the session's own
 * 4-room drawing. `note` is therefore the session's, not the family house's. See the trap
 * note at the top of this file.
 */
const STATIONS = {
  interior: ["plan-family-house"],
  pair: ["plan-family-house"],
  drawing: ["plan-family-house"],
  facts: ["plan-family-house"],
  note: ["session-2026-08"],
  lineage: ["plan-hero", "session-2026-08"],
  wall: [],
  sentence: ["session-2026-08"],
  mark: [],
};

// ── owner index ──────────────────────────────────────────────────────────────
/** token -> the drawings that use it. A token used by more than one is not diagnostic. */
const OWNERS = new Map();
for (const [id, rec] of Object.entries(RECORD)) {
  for (const n of rec.numerals) {
    if (!OWNERS.has(n)) OWNERS.set(n, new Set());
    OWNERS.get(n).add(id);
  }
}
const ownerOf = (token) => {
  const set = OWNERS.get(token);
  if (!set) return { known: false, owners: [] };
  return { known: true, owners: [...set] };
};

const problems = [];
const notes = [];
const fail = (kind, where, detail) => problems.push({ kind, where, detail });

// ── A. the drawings still say what the record says ───────────────────────────
for (const [id, rec] of Object.entries(RECORD)) {
  if (!rec.file) {
    notes.push(`${id}: filmed material, no SVG to parse (${rec.source})`);
    continue;
  }
  for (const rel of [rec.file, ...rec.alsoStagedAs]) {
    const p = join(PROJECT, "public", rel);
    if (!existsSync(p)) {
      fail("not staged", `public/${rel}`, `named by the record for ${id} but not on disk - run \`npm run sync:assets\``);
      continue;
    }
    const svg = readFileSync(p, "utf8");
    const missingRooms = Object.keys(rec.schedule).filter((r) => !svg.includes(r));
    const missingAreas = [...new Set(Object.values(rec.schedule))].filter((a) => !svg.includes(a));
    if (missingRooms.length) {
      fail("drift", `public/${rel}`, `no longer contains room name(s): ${missingRooms.join(", ")} - the record and the artwork have diverged`);
    }
    if (missingAreas.length) {
      fail("drift", `public/${rel}`, `no longer prints area(s): ${missingAreas.join(", ")} m2 - the record and the artwork have diverged`);
    }
    if (!missingRooms.length && !missingAreas.length) {
      notes.push(`public/${rel} still carries all ${Object.keys(rec.schedule).length} recorded rooms and their areas`);
    }
  }
}

// ── gather the copy, per station ─────────────────────────────────────────────
const scriptPath = join(PROJECT, "src", "data", "script.json");
if (!existsSync(scriptPath)) {
  console.error("verify-numbers: src/data/script.json not found");
  process.exit(1);
}
const script = JSON.parse(readFileSync(scriptPath, "utf8"));

/** { station, text, where } for everything the film says or shows. */
const copy = [];
for (const row of script.vo ?? []) {
  if (row?.text) copy.push({ station: row.id, text: row.text, where: `src/data/script.json vo[${row.id}]` });
}
for (const card of script.cards ?? []) {
  for (const [i, l] of (card.lines ?? []).entries()) {
    if (l) copy.push({ station: card.id, text: l, where: `src/data/script.json cards[${card.id}].lines[${i}]` });
  }
}

// Components. A file is attributed to a station when it names one; otherwise it is checked
// against the record as a whole (a numeral must at least belong to SOMETHING the film shows).
const tsxFiles = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.tsx$/.test(entry)) tsxFiles.push(full);
  }
};
walk(join(PROJECT, "src"));

const componentFiles = [];
for (const file of tsxFiles) {
  const raw = readFileSync(file, "utf8");
  const rel = relative(PROJECT, file).replace(/\\/g, "/");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const stationHits = Object.keys(STATIONS).filter(
    (s) => new RegExp(`["'\`]${s}["'\`]`).test(src) || basename(rel, ".tsx").toLowerCase() === s,
  );
  const text = [
    ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
    ...[...src.matchAll(/\b(?:alt|aria-label|title)\s*=\s*"([^"]*)"/gi)].map((m) => m[1]),
    ...[...src.matchAll(/["'`]([^"'`\n]{2,200})["'`]/g)].map((m) => m[1]),
  ]
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  componentFiles.push({ rel, src, stationHits, text });
  for (const t of text) {
    copy.push({
      station: stationHits.length === 1 ? stationHits[0] : null,
      text: t,
      where: rel,
    });
  }
}

// ── B. no crossed numbers ────────────────────────────────────────────────────
/** An area figure: a number carrying an m2 / m² unit, or a bare decimal the record knows. */
const AREA_UNIT = /(\d[\d,]*(?:\.\d+)?)\s*m\s?(?:2|²)\b/gi;
const DECIMAL = /\b(\d{1,5}(?:\.\d{1,2})?)\b/g;

let checkedNumerals = 0;
for (const { station, text, where } of copy) {
  const allowed = station && STATIONS[station] ? STATIONS[station] : null;
  // Keyed by the token itself: a figure written "110 m2" also matches the bare-decimal
  // sweep, and checking it twice would double-count and double-report it.
  const tokens = new Map();
  for (const m of text.matchAll(AREA_UNIT)) tokens.set(m[1], true);
  for (const m of text.matchAll(DECIMAL)) if (OWNERS.has(m[1]) && !tokens.has(m[1])) tokens.set(m[1], false);

  for (const [tok, unit] of tokens) {
    checkedNumerals++;
    const { known, owners } = ownerOf(tok);

    if (!known) {
      if (unit) {
        fail("unrecorded number", where, `"${tok} m2" is not in the record for any drawing this film shows - a number on screen must come from src/data/ or from the record here`);
      }
      continue;
    }
    if (!allowed) {
      if (station && STATIONS[station] && STATIONS[station].length === 0) {
        fail("crossed number", where, `station "${station}" shows no drawing, so it may not carry "${tok}" (${owners.join(", ")})`);
      }
      continue; // unattributable component - the token is at least in the record
    }
    if (owners.length > 1) continue; // shared between drawings, not diagnostic
    if (!allowed.includes(owners[0])) {
      fail(
        "crossed number",
        where,
        `station "${station}" shows ${allowed.join(" / ")}, but "${tok}" belongs to ${owners[0]} (${RECORD[owners[0]].source})`,
      );
    }
  }
}
notes.push(`${checkedNumerals} numeral(s) checked across ${copy.length} string(s)`);

// ── C. a rendering only ever appears beside its own drawing ──────────────────
const PLAN_BASENAMES = Object.fromEntries(
  Object.entries(RECORD)
    .filter(([, r]) => r.file)
    .map(([id, r]) => [id, [r.file, ...r.alsoStagedAs].map((f) => basename(f))]),
);
for (const { rel, src } of componentFiles) {
  for (const [id, rec] of Object.entries(RECORD)) {
    const rendersHere = rec.renders.filter((r) => src.includes(r));
    if (!rendersHere.length) continue;
    for (const [otherId, plans] of Object.entries(PLAN_BASENAMES)) {
      if (otherId === id) continue;
      const clash = plans.filter((p) => src.includes(p));
      if (clash.length) {
        fail(
          "mispaired",
          rel,
          `${rendersHere.join(", ")} was generated from ${id}, but this file also loads ${clash.join(", ")} - a rendering is only ever shown beside its own drawing`,
        );
      }
    }
  }
}

// ── D. the review pin never sits on a plan it was not written about ──────────
// One row per place the pin appears. A component's text is harvested several ways, so the
// same file would otherwise be reported two or three times for one mistake.
const pinCarriers = [
  ...new Map(
    [
      ...copy.filter((c) => PIN.needle.test(c.text)).map((c) => [c.where, { where: c.where, station: c.station }]),
      ...componentFiles.filter((f) => PIN.needle.test(f.src)).map((f) => [f.rel, { where: f.rel, station: null }]),
    ],
  ).values(),
];
for (const carrier of pinCarriers) {
  const file = componentFiles.find((f) => f.rel === carrier.where);
  const foreign = Object.entries(PLAN_BASENAMES)
    .filter(([id]) => id !== PIN.belongsTo)
    .flatMap(([, plans]) => plans.filter((p) => file && file.src.includes(p)));
  if (foreign.length) {
    fail(
      "pin mispaired",
      carrier.where,
      `the c06 review pin ("${PIN.text}") is the product's own words about ${PIN.belongsTo}, read off ${PIN.read}. It is FALSE of ${foreign.join(" and ")} — every staged plan has a bathroom. Show the pin on the drawing it was written about, or do not show it.`,
    );
  }
  if (carrier.station && !STATIONS[carrier.station]?.includes(PIN.belongsTo)) {
    fail(
      "pin mispaired",
      carrier.where,
      `the c06 review pin appears at station "${carrier.station}", which shows ${(STATIONS[carrier.station] ?? []).join(" / ") || "no drawing"} - the pin belongs to ${PIN.belongsTo}`,
    );
  }
}
if (pinCarriers.length) {
  notes.push(`${pinCarriers.length} place(s) carry the c06 review pin`);
}

// ── report ───────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({ notes, problems }, null, 2));
  process.exit(problems.length ? 1 : 0);
}
console.log(`\n  verify-numbers`);
console.log(`    ${Object.keys(RECORD).length} drawing(s) in the record, ${Object.keys(STATIONS).length} station(s) mapped`);
if (!tsxFiles.length) console.log(`    0 component file(s) under src/ - the component half passes vacuously`);
for (const n of notes) console.log(`    ${n}`);
if (!problems.length) {
  console.log(`\n  ✓ no crossed numbers, no mispaired rendering, the pin is on its own drawing\n`);
  process.exit(0);
}
console.log("");
for (const p of problems) {
  console.log(`  ✗ [${p.kind}] ${p.where}`);
  console.log(`      ${p.detail}`);
}
console.log(`\n  ${problems.length} problem(s).\n`);
process.exit(1);
