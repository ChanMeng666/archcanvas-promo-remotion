#!/usr/bin/env node
/**
 * The copy gate. Fails the build on a claim this project is not allowed to make.
 *
 * ArchCanvas takes real card payments and "architect" is a protected professional title in
 * two jurisdictions, which makes this the most claim-sensitive surface in the project. Its
 * positioning produced a standing banned-claims card (B1-B14), a banned-words list, and a
 * FIFTEENTH ban that is not on that card and is a legal one. Each is grounded in a specific
 * property of the shipped code or a specific statute:
 *
 *   B4   "as code" and DSL jargon turn the product repo's own CI red on a consumer surface,
 *        and ArchLang is not named anywhere in this film.
 *   B11  clear widths are a constant 60 mm subtraction on a coarse, eroded nav grid; only
 *        reachability, exact areas and byte-identical determinism may be called measurement.
 *        The safe verb everywhere else is "checked".
 *   B12  SHIP_RESIDUAL = true. Out of budget with defects left it charges and ships. The
 *        ship gate is a GOVERNOR, not a gate, and no line may say otherwise.
 *   B15  "AI architect" breaches UK Architects Act 1997 s.20 (to GBP 2,500 per offence; ARB's
 *        Misuse of Title Policy names websites specifically) and NZ Registered Architects
 *        Act 2005 s.7 (to NZD 10,000) - and NZ is the law ArchCanvas's own Terms choose.
 *        The approved substitute is "AI architectural designer". This one is a REGEX, not a
 *        substring: the lookahead is the whole point.
 *
 * THIS FILM HAS A VOICEOVER, WHICH THE FIRST ONE DID NOT. The spoken lines carry the
 * argument and the screen carries the evidence, so `vo[].text` is scanned exactly as hard
 * as `cards[].lines[]`. A voiceover is the worst possible place to discover a banned claim:
 * it is baked into an audio master, four aspect ratios deep, and nobody can edit it after.
 *
 * Checks, in order of how much they would cost to discover late:
 *
 *   1. banned-phrase    a claim we may not make, as a case-insensitive substring.
 *   2. banned-word      hype, or a vague quality claim with no evidence attached. Matched
 *                       with a hand-built boundary, `(^|[^a-z0-9-])...([^a-z0-9-]|$)`,
 *                       because the list contains hyphens and spaces and \b will not do.
 *   3. banned-pattern   the things a substring cannot express: the B15 lookahead, the three
 *                       B11 tripwires lifted from archcanvas/tests/marketingNoCode.test.ts,
 *                       the bare-dollar-price rule, and the English-only rule.
 *   4. unregistered     a phrase with no row in docs/copy-clearance.md. Hard fail: the point
 *                       of the table is that every line has a traceable source, and the line
 *                       nobody cleared is exactly the line that slips.
 *
 * A MISSING CLEARANCE FILE IS ITSELF A VIOLATION. This gate does not pass by having nothing
 * to check against - an empty cleared set would silently turn check 4 into "fail everything"
 * or, worse in a refactor, into "check nothing".
 *
 * Two surfaces are read: `src/data/script.json` (the plan, and the only place copy is
 * authored) and the visible strings of every `src/**\/*.tsx` (what actually renders,
 * because a component can introduce copy the script never authorised).
 *
 * THE COMPONENT HALF IS PARSED, NOT GREPPED, and that is not a preference. The first film
 * harvested `>text<` out of BUILT HTML, where it is a sound assumption. In a `.tsx` file it
 * is not, and never will be: `Record<string, X>`, `React.FC<Props>` and
 * `useRef<HTMLDivElement>(null)` all look exactly like on-screen prose to that regex, and
 * the gate reported seven of them as uncleared copy the moment real components landed. So
 * this walks the TypeScript AST and collects exactly two things:
 *
 *   - `JsxText` nodes with non-empty trimmed text. That IS the on-screen prose and nothing
 *     else - a generic, an import and a comment are all different node kinds and cannot be
 *     mistaken for it.
 *   - string literals in `JsxAttribute` position for `alt`, `aria-label`, `title` and
 *     `aria-description`. Scanned for banned terms, but NOT registration-gated: an
 *     accessible name is metadata derived from the asset ledger, not authored copy, and
 *     gating it would make the accessible names unwritable.
 *
 * Only `.tsx` is read. A `.ts` file has no JSX in it and therefore nothing that reaches a
 * screen.
 *
 * PLACEHOLDERS ARE SCAFFOLDING, NOT COPY, and get their own class. While the station
 * components are being built, `Film.tsx` wires a labelled `<Placeholder>` per world object.
 * Those are listed on every run as `[placeholder]` but are fatal only under `--strict`, so
 * the gate stays honest about them without holding the whole build red - and the film still
 * cannot ship with one on screen, because `npm run ship` passes `--strict`. Text inside the
 * `Placeholder` component's own body is likewise never registration-gated.
 *
 * Usage:  node capture/verify-copy.mjs [--json] [--strict]
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");
const STRICT = process.argv.includes("--strict");

// ── the lists ────────────────────────────────────────────────────────────────

/** Case-insensitive substrings. The first film's list, plus this film's additions. */
const BANNED_PHRASES = [
  // B4 - the DSL stays invisible, and this film never names it.
  "as code", "as a dsl",
  // B12 - the gate is a governor. It does not block.
  "checked before you see it", "before you see it", "nothing ships",
  // B11 - clearances and routes are advisory, always.
  "every door measured", "every route walked", "every clearance",
  // B3 - concept plan, not a permit set. "build-ready" is live product copy and still banned.
  "build from", "buildable", "build-ready", "permit-ready", "permit ready",
  "code-compliant", "code compliant",
  // B5 - the job is to shrink the professional spend, not replace it.
  "architect in your pocket", "replaces your architect", "no architect needed",
  // B8 - permanently retired, audited against ~60 prior-art items.
  "first and only", "the only tool", "missing primitive", "no checkable text substrate",
  // B1 - false for the market leader; retired twice on evidence.
  "we export cad", "structured geometry",
  // B13 - no traction number, ever.
  "250 visitors", "100% activation",
  // B2 - refuted competitor free-tier figure.
  "four plans in 45", "4 plans in 45",
];

/** Word-ish terms, matched with the hand-built boundary. voice.md's list plus the first film's. */
const BANNED_WORDS = [
  "revolutionary", "game-changing", "game changer", "game-changer", "insane", "crazy",
  "mind-blowing", "magic", "magical", "seamless", "seamlessly", "effortless", "unleash",
  "supercharge", "next-level", "cutting-edge", "world-class", "disrupt", "disruptive",
  "10x", "paradigm", "best-in-class", "state-of-the-art",
  // The vague-quality class: voice.md bans these by the rule "replace the adjective with
  // the evidence". `benchmark` is B10 - the offline eval is never presented as one.
  "powerful", "robust", "blazing fast", "high quality", "benchmark",
];

/**
 * The things a substring cannot express. The first five are the product repo's own needles
 * (archcanvas/tests/marketingNoCode.test.ts) - kept byte-identical so the two gates cannot
 * drift, and so a fix in one is a fix in both.
 */
const BANNED_PATTERNS = [
  {
    re: /\bAI architect(?!ural)/i,
    why: "B15 - 'architect' is a protected title in the UK and NZ; write 'AI architectural designer'",
  },
  { re: /\bevery clearance\b/i, why: "B11 - clear widths are estimated, never measured" },
  { re: /\bclearances? (is |are )?measured\b/i, why: "B11 - no clearance is measured" },
  { re: /\broutes? (is |are )?walked\b/i, why: "B11 - circulation is coarse, and null on the broken plans" },
  { re: /\bas code\b/i, why: "B4 - the banned 'as code' pitch" },
  { re: /\b(ArchLang|DSL)\b/i, why: "B4 - ArchLang is not named anywhere in this film" },
  { re: /\.arch\b/i, why: "B4 - no .arch source on a consumer surface" },
  {
    re: /\b(door|wall|clearance|route|width|distance)s?\s+(is\s+|are\s+)?measured\b/i,
    why: "B11 - broadened past the three shipped needles; the safe verb is 'checked'",
  },
  {
    re: /\bblocks?\s+(a|any|the)\s+(defective|broken|bad|unsound)\s+plan/i,
    why: "B12 - SHIP_RESIDUAL = true; the gate is a governor, not a gate",
  },
  {
    re: /\$\s*[\d,]/,
    why: "no bare dollar price on screen - USD on a .uk surface is DMCCA drip-pricing exposure",
  },
  {
    re: /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/,
    why: "English only - the positioning notes ban CJK outright",
  },
];

// ── harvest ──────────────────────────────────────────────────────────────────

const violations = [];
const note = (where, kind, detail, line) => violations.push({ where, kind, detail, line });

/** Every phrase authored in the script: BOTH arrays, because the voiceover is copy. */
const scriptPath = join(PROJECT, "src", "data", "script.json");
if (!existsSync(scriptPath)) {
  console.error("verify-copy: src/data/script.json not found - the film has no script");
  process.exit(1);
}
const script = JSON.parse(readFileSync(scriptPath, "utf8"));
const scriptPhrases = [];
for (const row of script.vo ?? []) {
  if (typeof row?.text === "string" && row.text.trim()) {
    scriptPhrases.push({ phrase: row.text, where: `src/data/script.json vo[${row.id}]` });
  }
}
for (const card of script.cards ?? []) {
  for (const [i, l] of (card.lines ?? []).entries()) {
    if (typeof l === "string" && l.trim()) {
      scriptPhrases.push({ phrase: l, where: `src/data/script.json cards[${card.id}].lines[${i}]` });
    }
  }
}

/** Every visible string in the compositions. Empty is a legitimate state while they are written. */
const tsxFiles = [];
const walkDir = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules") continue;
    if (statSync(full).isDirectory()) walkDir(full);
    // .tsx only. A .ts file has no JSX in it and therefore nothing that reaches a screen.
    else if (/\.tsx$/.test(entry)) tsxFiles.push(full);
  }
};
walkDir(join(PROJECT, "src"));

/** The attributes whose value is read aloud or shown on hover. */
const TEXT_ATTRS = new Set(["alt", "aria-label", "title", "aria-description"]);

/**
 * Reads like a sentence, as opposed to the one- or two-token glue between two
 * interpolations (the ` x ` in `{width} x {height}`). The AST already guarantees this is
 * JSX text and not syntax, so the bar can be low - it exists only to keep punctuation and
 * single connectors out of the registration gate, never out of the banned-term scan.
 */
const isProse = (s) => {
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return false;
  return tokens.filter((t) => /^[A-Za-z][A-Za-z'’-]{1,}[.,!?;:]?$/.test(t)).length >= 2;
};

const componentText = [];
const placeholders = [];

for (const file of tsxFiles) {
  const rel = relative(PROJECT, file).replace(/\\/g, "/");
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  /** `scaffold` is true anywhere inside the `Placeholder` component's own body. */
  const visit = (node, scaffold) => {
    let inScaffold = scaffold;
    if (
      (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === "Placeholder"
    ) {
      inScaffold = true;
    }

    if (ts.isJsxText(node)) {
      const t = node.text.replace(/\s+/g, " ").trim();
      if (t) componentText.push({ phrase: t, where: rel, line: lineOf(node), gated: !inScaffold });
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (TEXT_ATTRS.has(name) && node.initializer) {
        const init = node.initializer;
        const expr = ts.isJsxExpression(init) ? init.expression : init;
        if (expr && (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))) {
          const t = expr.text.replace(/\s+/g, " ").trim();
          // Scanned for banned terms, never registration-gated: an accessible name is
          // metadata derived from the asset ledger, not copy someone authored.
          if (t) componentText.push({ phrase: t, where: `${rel} (${name})`, line: lineOf(node), gated: false });
        }
      }
    } else if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(sf);
      if (/(^|\.)Placeholder$/.test(tag)) placeholders.push({ where: rel, line: lineOf(node), what: `<${tag}>` });
    } else if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === "Placeholder"
    ) {
      // The registry shape in Film.tsx: `briefLine: Placeholder,`
      placeholders.push({ where: rel, line: lineOf(node), what: `${node.name.getText(sf)}: Placeholder` });
    }

    ts.forEachChild(node, (child) => visit(child, inScaffold));
  };
  visit(sf, false);
}

/** The clearance table. Every backtick-quoted string in the whole file is a cleared phrase. */
const clearancePath = join(PROJECT, "docs", "copy-clearance.md");
if (!existsSync(clearancePath)) {
  note("docs/copy-clearance.md", "missing", "the clearance table does not exist - nothing can be cleared");
}
const clearance = existsSync(clearancePath) ? readFileSync(clearancePath, "utf8") : "";
const cleared = new Set(
  [...clearance.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim().toLowerCase()),
);

// ── checks ───────────────────────────────────────────────────────────────────

const scan = (phrase, where, line) => {
  const low = phrase.toLowerCase();
  for (const p of BANNED_PHRASES) {
    if (low.includes(p)) note(where, "banned-phrase", `"${p}" in ${JSON.stringify(phrase)}`, line);
  }
  for (const w of BANNED_WORDS) {
    const re = new RegExp(
      `(^|[^a-z0-9-])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9-]|$)`,
      "i",
    );
    if (re.test(low)) note(where, "banned-word", `"${w}" in ${JSON.stringify(phrase)}`, line);
  }
  for (const { re, why } of BANNED_PATTERNS) {
    if (re.test(phrase)) {
      note(where, "banned-pattern", `${re} (${why}) in ${JSON.stringify(phrase)}`, line);
    }
  }
};

for (const { phrase, where } of scriptPhrases) {
  scan(phrase, where);
  if (!cleared.has(phrase.trim().toLowerCase())) {
    note(where, "unregistered", `no backticked row in docs/copy-clearance.md for ${JSON.stringify(phrase)}`);
  }
}
for (const { phrase, where, line, gated } of componentText) {
  scan(phrase, where, line);
  if (gated && isProse(phrase) && !cleared.has(phrase.trim().toLowerCase())) {
    note(
      where,
      "unregistered",
      `on-screen prose with no clearance row: ${JSON.stringify(phrase)} - author it in src/data/script.json, or add a backticked row to docs/copy-clearance.md`,
      line,
    );
  }
}

// Scaffolding, not copy. Reported always, fatal only under --strict.
for (const p of placeholders) {
  note(p.where, "placeholder", `${p.what} is still scaffolding - the film cannot ship with one on screen`, p.line);
}

// ── report ───────────────────────────────────────────────────────────────────

const fatal = violations.filter((v) => v.kind !== "placeholder" || STRICT);
const pending = violations.filter((v) => v.kind === "placeholder" && !STRICT);

const summary = {
  strict: STRICT,
  scriptPhrases: scriptPhrases.length,
  voLines: (script.vo ?? []).length,
  cardLines: (script.cards ?? []).reduce((n, c) => n + (c.lines?.length ?? 0), 0),
  componentFiles: tsxFiles.length,
  componentStrings: componentText.length,
  clearedRows: cleared.size,
  violations: fatal,
  placeholders: pending,
};

if (JSON_OUT) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(fatal.length ? 1 : 0);
}

console.log(`\n  verify-copy${STRICT ? " --strict" : ""}`);
console.log(`    ${summary.voLines} voiceover line(s) + ${summary.cardLines} card line(s) in src/data/script.json`);
if (tsxFiles.length === 0) {
  console.log(`    0 component file(s) under src/ - the component half passes vacuously`);
} else {
  console.log(`    ${summary.componentStrings} visible string(s) across ${tsxFiles.length} component file(s), parsed as TSX`);
}
console.log(`    ${cleared.size} phrase(s) cleared in docs/copy-clearance.md`);

if (pending.length) {
  console.log(`\n  ${pending.length} placeholder(s) still on screen - scaffolding, not copy. Fatal under --strict:`);
  for (const p of pending) console.log(`    · ${p.where}:${p.line}  ${p.detail}`);
}

if (!fatal.length) {
  console.log(`\n  ✓ no banned phrase, no banned word, no banned pattern, every line registered\n`);
  process.exit(0);
}
console.log("");
for (const v of fatal) {
  console.log(`  ✗ [${v.kind}] ${v.line ? `${v.where}:${v.line}` : v.where}`);
  console.log(`      ${v.detail}`);
}
console.log(`\n  ${fatal.length} violation(s). See docs/copy-clearance.md.\n`);
process.exit(1);
