# Decisions

What was decided on purpose, and what was deliberately **not** repeated from the first
film. Written so that the next person — or the next agent — does not spend a day
rediscovering an argument that was already had.

The first film is `../archcanvas-promo-video`: HyperFrames, 92 s, **silent**, ivory paper
throughout, centred full-screen text cards, a chronological demo loop, 16:9 only. This one
is one continuous camera pull-back across one infinite canvas, told **backwards**, on a
ground that washes from graphite night to the brand's ivory, in four aspect ratios, at
75 s. Read that film's `STORYBOARD.md` before arguing with anything below.

**Both films are silent, and that is a coincidence rather than a shared decision.** This
one was built around an ElevenLabs voiceover, and lost it on 2026-09-08 to a licensing
finding, not a creative one — see **D11**. What survived the removal is a different film
from the first in every other respect, and in one respect it is now *more* different: the
first film's words are centred cards that interrupt the picture, and this film's words
live in world space and are passed by the camera.

---

## D1. The honesty beat is not announced. You read it in passing.

**The first film made it the penultimate hero card**, stamped full-screen and centred:
*"And a written list of / everything it couldn't get right."* It is the film's one
differentiated claim (Layer 2, the receipt frame) and it was staged as such.

**This film does not restage it.** At station `note` the camera simply pans past a real
review pin sitting on the drawing and you read the product's own sentence in passing, and
the camera does not stop.

When the voiceover went (**D11**) the spoken Layer 2 line went with it, and it was
deliberately **not** replaced with a card. The pin says it better, in the product's own
words, and a card would have restaged exactly the thing this decision exists to avoid.

**Why.** Two reasons, and the second is the load-bearing one.

1. Re-treading the other film's hero beat in its own hero framing makes the second film
   read as a remake with a voiceover.
2. **A claim about candour, stamped and centred, is an advertisement about candour.** The
   same claim demonstrated — an artifact the camera happens to cross, in the product's own
   words, unglamorously — is candour. The pin is more persuasive precisely because it is
   not being presented. This also keeps the beat inside B12: the honest statement is
   "here is what survived", never "nothing survived", and a pin the camera passes says the
   former by construction.

## D2. The voiceover is copy, and goes through the same gate.

The first film was silent, so its text cards were the entire argument and
`verify-copy.mjs` only had to read `STORYBOARD.md`. Here the spoken lines carry the
argument and the screen carries the evidence.

**A voiceover is the worst possible place to discover a banned claim.** It is baked into
an audio master, four aspect ratios deep, and cannot be edited afterwards without
re-rendering everything. So `capture/verify-copy.mjs` scans `vo[].text` exactly as hard as
`cards[].lines[]`, and every spoken line has a row in `docs/copy-clearance.md` with the
approved source it came from.

## D3. Only two text cards, and both are quotations.

Because the voiceover carries the argument, the screen does not need to repeat it. The
film has **two** cards where the first had eleven:

- `sentence` — the brief a person actually typed, verbatim off the capture.
- `mark` — the price frame, the permit disclaimer and the domain.

Neither card is a claim written by this project. One is a user's input, the other is two
already-shipped strings plus a URL. That is deliberate: **the fewer sentences this film
invents, the less surface there is to clear.**

## D4. `wall` is silent, and no line may be written for it.

Station 6 is a wall of sixty plan rasters. It has **no voiceover, no card and no number**.

The rasters are output from the offline designer eval. **B10** forbids presenting that
eval as a public benchmark or putting a score on it, and **B9** forbids claiming or
denying a model-loop gain in any room. A caption there would be a number, a rate or a
comparison — all three are banned. Showing the volume and saying nothing is the only
honest treatment, and it also gives the film its one long silence before the rush back in.

The rasters are montage-only for a second reason: they are not showcase plans and must
never be shown as one. At wall scale no individual plan is legible, which is the point.

`src/data/script.json` therefore has **no `wall` row in either array**. That is the design,
not an omission — the `$comment` in that file says so, and this row exists so nobody
"fixes" it.

## D5. The film never says "AI", and never opens on it.

positioning.md do-NOT #2: in the exact communities the ICP gathers in, "AI" is a liability
as an opener, not a hook — r/DesignMyRoom bans AI-tool promotion outright, and
professionals read "AI does the architect's job" as a livelihood threat.

Station `interior` opens on the room and the person: *"This room doesn't exist yet."* As it
turned out, once the argument was written this way the word was not needed anywhere, so it
appears nowhere in the film at all. The renderings still carry the product's own
AI-generated pill, which is the disclosure that legally matters (EU AI Act Art 50, grace
period ending 2026-12-02).

## D6. `AI architect` is treated as a fifteenth ban, above the B1–B14 card.

It is not on the standing banned-claims card in `founder-brief.md` §7, and it is
the only ban in this project with a fine attached: UK Architects Act 1997 s.20 (to £2,500
per offence; ARB's Misuse of Title Policy names *"websites (including URLs and metadata)"*
specifically) and NZ Registered Architects Act 2005 s.7 (to NZ$10,000) — **and NZ is the
law ArchCanvas's own Terms choose.** The approved substitute is **"AI architectural
designer"**.

**The positioning notes have not been updated**, which makes the approved copy bank the single
most dangerous source in the corpus: `positioning.md`'s positioning statement,
`messaging-library.md`'s tagline #7, all three product boilerplates and both founder bios,
and `category.md`'s own clearance row all still contain the banned title. None of them was
quoted verbatim here; the list is in `docs/copy-clearance.md` § *Copy that must NOT be
lifted*.

Enforcement is the product repo's own needle, `/\bAI architect(?!ural)/i`, carried into
`verify-copy.mjs` byte-identically so the two gates cannot drift. It is a **regex, not a
substring**, which is why the gate grew a `BANNED_PATTERNS` list alongside the two string
lists it inherited.

## D7. The film shows THREE pieces of real material, not two, and the third is the trap.

The brief for this work named two drawings — `plan-family-house.svg` (9 rooms, 121.5 m²)
and `plan-hero.svg` (6 rooms, 109.8 m²). Reading the footage frame by frame turned up a
third: **the filmed session's own plan is neither of them.** Its on-screen room schedule
reads **4 rooms totalling 108.00 m²** (`c06-review-pins.mp4` t=8.30 s), and the brief typed
into it says **"about 110 m2"** (`c01-brief-typing.mp4` t=44.0 s).

That matters because of the one string the film takes from the product's own mouth. The
review pin at station `note` reads, verbatim:

> **PROGRAM** — The 110m² plan provides no bathroom, laundry, or dedicated storage.

That sentence is **true of the session's 4-room drawing** — which is exactly why the
product wrote it — and **false of both staged plans**: `plan-family-house.svg` has a Bath
*and* a Laundry, and `plan-hero.svg` has a Bathroom. Putting that pin over either of them
would print a visible falsehood on screen at the precise moment the voiceover makes the
film's one honesty claim.

**Decision:** station `note` shows the session's own material, not the family house. The
record in `capture/verify-numbers.mjs` therefore carries **three** entries, not two, and
check D fails the build if the pin ever appears beside a plan it was not written about.
This is a deliberate departure from the brief, made on the evidence in the footage.

There is a second, quieter reward for getting this right: `plan-hero.svg` has a Bathroom
and a Hall, and the session's earlier state does not. The lineage the film pans across is
the fix actually happening. Nothing in the copy points at it; it is simply true.

## D8. The old clearance doc was wrong about the brief, and the footage won.

The first film's clearance row 01 records the typed brief as `about 110 m².` with a
superscript. **The footage types ASCII `110 m2`.** Verified at `c01-brief-typing.mp4`
t=44.0 s, with the full line reading:

> Three bedrooms, open kitchen and living, north-facing, single storey, about 110 m2.

It is transcribed as filmed. Tidying it to `110 m²` would be mocking up the one thing the
film says a human wrote (CLAUDE.md law 2), and law 2 does not have a small-print exception
for typography.

## D9. The gate fails on on-screen prose a component invents — and it parses, it does not grep.

`verify-copy.mjs` inherits the first film's three checks and adds a fourth surface: prose
in JSX **child position** in `src/**/*.tsx` must be registered in the clearance doc, not
merely free of banned words. `src/data/script.json` is the single source of copy, so any
sentence a component holds itself has bypassed the script — which is exactly the path a
banned claim would take.

`alt` / `aria-label` / `title` / `aria-description` are scanned for banned terms but are
**not** registration-gated: they are descriptive metadata derived from the asset ledger
rather than authored copy, and gating them would make the accessible names unwritable.

**The harvester is a TypeScript AST walk, and the regex version is not coming back.** The
first film extracted `>text<` from **built HTML**, where that is a sound assumption. In a
`.tsx` file it is not, and never will be: `Record<string, X>`, `React.FC<Props>` and
`useRef<HTMLDivElement>(null)` all look exactly like on-screen prose to that pattern. The
gate reported **seven** of them as uncleared copy within minutes of the first real
components landing — while passing *vacuously* before that, which is the worse half of the
failure. It now parses each file with `ts.createSourceFile(..., ScriptKind.TSX)` and
collects `JsxText` nodes and the four text-bearing `JsxAttribute` values, and nothing else.
A generic, an import and a comment are different node kinds and cannot be mistaken for
copy. Only `.tsx` is read; a `.ts` file has no JSX and therefore nothing that reaches a
screen.

## D9b. Placeholders are scaffolding, not copy, and have their own class.

While the station components are being built, `Film.tsx` wires a labelled `<Placeholder>`
per world object. Those are neither cleared copy nor a banned claim, and treating them as
either would be wrong: failing on them holds the whole build red for the entire time the
film is being made, and ignoring them lets one ship.

So they are reported on every run as `[placeholder]`, listed with file and line, and are
**fatal only under `--strict`** — which `npm run ship` passes. The gate stays honest about
them without blocking work, and the film still cannot ship with one on screen. Text inside
the `Placeholder` component's own body is likewise never registration-gated, for the same
reason.

## D9c. `src/stations.ts` owns every second. The script owns every word.

A vo row is `{ id, text }` and carries no timing at all. `leadInSec` and `tailSec` live in
`src/stations.ts` and nowhere else.

They were briefly duplicated into `script.json` and were removed on `core`'s call, which is
right: **`leadInSec` does double duty.** It is simultaneously how long the camera takes to
travel to this station and how long the voice waits before starting — the same instant,
which is why the derivation is one expression, `max(minSec, voSec + leadInSec + tailSec)`.
Two copies of one number are two things that can disagree, and CLAUDE.md law 3 exists
precisely to stop timing being typed in more than one place. Nothing read the script's copy
(`generate-vo.mjs` defaulted it to `0` and only logged it; `generate-captions.mjs` reads the
*station's*), so removing it changed no behaviour.

## D9d. The narration is running at 183 wpm against copy written for 140.

The lines were written to a calm documentary pace: 100 words, ~42.9 s of speech inside an
~85 s film, so that roughly half the running time is camera and silence. The measured takes
in `src/data/vo.json` total **32.8 s — about 183 wpm**, with individual stations as fast as
`mark` at 249 and `pair` and `note` at ~220.

That is not a copy problem and no line was changed for it: the film is 88.87 s and every
station except `note` is floor-bound, so the extra 10 s simply becomes more air. It is
recorded because it is a **voice setting, not a script setting**, and because there is
headroom to slow it — `note`, the only voice-bound station, runs 8.87 s against a 14 s
`maxSec`. If the delivery ever reads as brisk against the pull-back, the dial is the TTS
rate, and nobody should reach for the words instead.

## D10. Two standing rules the first film did not have to state.

- **No bare dollar price on screen.** USD rendered on a `.uk` surface is DMCCA
  drip-pricing exposure. Approved tagline #8 (*"Your first real floor plan, before the
  $2,000 bill."*) is cleared copy elsewhere and is deliberately unused here. The gate fails
  on `$` followed by a digit.
- **English only.** The positioning notes ban CJK outright; the gate fails on any CJK codepoint
  in script or component copy. Cheap to enforce, and the failure mode it prevents — a
  stray character surviving into a rendered master — is expensive.
