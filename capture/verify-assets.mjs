#!/usr/bin/env node
/**
 * verify-assets.mjs — prove that every byte the film loads is the byte the ledger recorded.
 *
 * WHY THIS EXISTS: Remotion fails SOFTLY on a missing `staticFile()`. You do not get an
 * error — you get a blank region in the render. A 90-minute render of an 85-second film
 * can therefore complete, report success, and ship with a hole in it that nobody sees
 * until it is on a landing page. There is no runtime signal to catch; the only defence is
 * to check the asset tree before the render starts, which is why `npm run verify` runs
 * this first.
 *
 * It checks three things:
 *
 *   1. `src/data/assets.json` exists (the ledger is the whole contract).
 *   2. Every ledger row's file is present, is the recorded byte count, and hashes to the
 *      recorded sha256 — so a truncated, half-copied or hand-swapped asset is caught.
 *   3. Every `staticFile("...")` in `src/**` names a ledger row. An unregistered
 *      `staticFile` is the exact failure described above, so it is a hard failure here.
 *
 * Reports EVERY violation, not just the first. Exits non-zero on any. `--json` for CI.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const SRC_DIR = path.join(ROOT, "src");
const LEDGER = path.join(ROOT, "src", "data", "assets.json");
const AS_JSON = process.argv.includes("--json");

const violations = [];
const notes = [];

// Declared up front, not where they are computed: `report()` can be called before the
// checks run (a missing ledger is fatal immediately) and would otherwise hit the TDZ.
let ledgerRows = [];
let tsFiles = [];
let staticFileCalls = 0;
let dynamic = [];
let checkedBytes = 0;

const fail = (kind, subject, detail) => violations.push({ kind, subject, detail });

// ---------------------------------------------------------------------------
// 1. The ledger must exist and parse
// ---------------------------------------------------------------------------

if (!fs.existsSync(LEDGER)) {
  report([
    {
      kind: "ledger-missing",
      subject: "src/data/assets.json",
      detail: "the ledger is missing. Run `npm run sync:assets`.",
    },
  ]);
}

let ledger;
try {
  ledger = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
} catch (err) {
  report([
    {
      kind: "ledger-unparseable",
      subject: "src/data/assets.json",
      detail: `not valid JSON: ${String(err.message).split("\n")[0]}`,
    },
  ]);
}

/**
 * Flatten the ledger's three shapes into one list of checkable rows.
 * `base` says which root the `src` is relative to: `public/` for anything the film loads
 * with `staticFile()`, the repo root for raw inputs staged outside it.
 */
function rows(l) {
  const out = [];
  for (const a of l.assets ?? []) {
    out.push({ id: a.id, src: a.src, base: "public", bytes: a.bytes, sha256: a.sha256, group: a.role });
  }
  for (const f of l.wall?.files ?? []) {
    out.push({
      id: `wall/${f.name}`,
      src: `${l.wall.dest}/${f.name}`,
      base: "public",
      bytes: f.bytes,
      sha256: f.sha256,
      group: "wall",
    });
  }
  for (const s of l.sources ?? []) {
    out.push({ id: s.id, src: s.src, base: "repo", bytes: s.bytes, sha256: s.sha256, group: "source" });
  }
  return out;
}

ledgerRows = rows(ledger);
if (ledgerRows.length === 0) {
  fail("ledger-empty", "src/data/assets.json", "the ledger has no rows. Run `npm run sync:assets`.");
}

// ---------------------------------------------------------------------------
// 2. Every row: present, right size, right bytes
// ---------------------------------------------------------------------------

const rootFor = (base) => (base === "public" ? PUBLIC_DIR : ROOT);
const displayPath = (row) => (row.base === "public" ? `public/${row.src}` : row.src);

for (const row of ledgerRows) {
  const abs = path.join(rootFor(row.base), row.src);

  if (!fs.existsSync(abs)) {
    fail("missing", displayPath(row), "file is in the ledger but not on disk. Run `npm run sync:assets`.");
    continue;
  }

  const size = fs.statSync(abs).size;
  if (size !== row.bytes) {
    fail("size", displayPath(row), `ledger says ${row.bytes} bytes, file is ${size} (${size - row.bytes >= 0 ? "+" : ""}${size - row.bytes}).`);
    continue; // a size mismatch guarantees a hash mismatch; do not report it twice
  }

  const hash = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
  if (hash !== row.sha256) {
    fail("sha256", displayPath(row), `ledger says ${row.sha256}, file hashes to ${hash}.`);
    continue;
  }

  checkedBytes += size;
}

// ---------------------------------------------------------------------------
// 3. Every staticFile() in src/** names a ledger row
// ---------------------------------------------------------------------------

function walkTs(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTs(abs));
    else if (/\.tsx?$/.test(entry.name)) out.push(abs);
  }
  return out;
}

/** Ledger `src` values, normalised the way a `staticFile()` argument would be written. */
const known = new Set(ledgerRows.filter((r) => r.base === "public").map((r) => r.src));
const normalise = (p) => p.replace(/\\/g, "/").replace(/^\.?\//, "");

const STATIC_FILE = /\bstaticFile\s*\(\s*(?:(["'])((?:\\.|(?!\1)[^\\])*)\1|`([^`$\\]*)`)?/g;

tsFiles = walkTs(SRC_DIR);

for (const file of tsFiles) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  for (const m of text.matchAll(STATIC_FILE)) {
    staticFileCalls += 1;
    const literal = m[2] ?? m[3];
    const line = text.slice(0, m.index).split("\n").length;

    if (literal === undefined) {
      // e.g. staticFile(row.src) — reading the ledger IS the safe pattern, so this is a
      // note rather than a failure. It cannot be checked statically; nothing else can be
      // said about it here.
      dynamic.push(`${rel}:${line}`);
      continue;
    }
    const wanted = normalise(literal);
    if (!known.has(wanted)) {
      fail(
        "unregistered-staticFile",
        `${rel}:${line}`,
        `staticFile(${JSON.stringify(literal)}) is not a ledger row. Remotion renders a BLANK REGION for a missing staticFile — add it to scripts/sync-assets.mjs and re-run \`npm run sync:assets\`.`,
      );
    }
  }
}

if (tsFiles.length === 0) {
  notes.push("no .ts/.tsx files under src/ yet — the staticFile() check passed vacuously.");
} else if (staticFileCalls === 0) {
  notes.push(`scanned ${tsFiles.length} file(s) under src/, found no staticFile() calls — that check passed vacuously.`);
}
if (dynamic.length > 0) {
  notes.push(`${dynamic.length} staticFile() call(s) take a non-literal argument and cannot be checked statically: ${dynamic.join(", ")}`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

report(violations);

function report(vs) {
  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  const summary = {
    ok: vs.length === 0,
    ledgerRows: ledgerRows.length,
    bytesVerified: checkedBytes,
    tsFilesScanned: tsFiles.length,
    staticFileCalls,
    dynamicStaticFileCalls: dynamic.length,
    notes,
    violations: vs,
  };

  if (AS_JSON) {
    console.log(JSON.stringify(summary, null, 2));
  } else if (summary.ok) {
    console.log(
      `✓ verify:assets — ${summary.ledgerRows} ledger rows verified (${mb(summary.bytesVerified)}), ` +
        `${summary.staticFileCalls} staticFile() call(s) across ${summary.tsFilesScanned} source file(s) all registered.`,
    );
    for (const n of notes) console.log(`  note: ${n}`);
  } else {
    console.error(`✗ verify:assets — ${vs.length} violation(s):\n`);
    for (const v of vs) console.error(`  [${v.kind}] ${v.subject}\n      ${v.detail}`);
    console.error("");
    for (const n of notes) console.error(`  note: ${n}`);
  }

  process.exit(summary.ok ? 0 : 1);
}
