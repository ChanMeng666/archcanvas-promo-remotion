# CLAUDE.md — ArchCanvas «Zoom Out»

An ~85-second film for ArchCanvas (https://archcanvas.uk), built in Remotion.
Four aspect ratios out of one edit. English, with a voiceover.

This is deliberately the **second** solution. A first film already exists at
`../archcanvas-promo-video` (HyperFrames, 92s, silent, ivory paper, centred text
cards, chronological demo loop, 16:9 only). **Do not port it.** This one is one
continuous camera move across one infinite canvas, told backwards, on a ground
that washes from graphite night to the brand's ivory. Read `docs/decisions.md`
for what was deliberately not repeated.

---

## The three laws

**1. Every word on screen or in the voiceover is cleared, or it does not ship.**
`docs/copy-clearance.md` holds every phrase with the approved source it came
from. `capture/verify-copy.mjs` enforces it and is a gate. A phrase with no
clearance row fails the build — deliberately: the line nobody cleared is exactly
the line that slips.

**2. Nothing on screen is mocked up.** Every drawing, every rendering, every
number and every interface came out of the real product. `src/data/assets.json`
is the ledger: path, bytes, sha256, native pixel size. A rendering is only ever
shown beside **its own** drawing, and a drawing's numbers are only ever that
drawing's numbers. `capture/verify-numbers.mjs` enforces the second half.

**3. The timeline is derived, never typed.** Intent lives in **seconds** in
`src/stations.ts`. `src/timeline.ts` is the only file that does arithmetic.
Never write a frame literal in a `from={}` or `durationInFrames={}` anywhere
else — `capture/verify-timeline.mjs` greps for it and fails.

---

## Copy law — read before writing a single word

The authority is `../archcanvas-growth`: `strategy/positioning.md`,
`investor/founder-brief.md` §7 (bans 1–14), `marketing/content/voice.md`
(banned words), `strategy/category.md` §6 (the clearance table).

**A promo video is the consumer room. Layer 1 and Layer 2 only, never Layer 3.**

Five that will bite:

- **"AI architect" is banned on legal grounds and is NOT in the B1–B14 card.**
  UK Architects Act 1997 s.20 (fine to £2,500 per offence; ARB's misuse policy
  names "websites (including URLs and metadata)" specifically) and NZ Registered
  Architects Act 2005 s.7 (to NZ$10,000 — and NZ is the law the Terms chose).
  Write **"AI architectural designer"**. The product repo already enforces
  `/\bAI architect(?!ural)/i`; **the growth repo has not been updated**, so
  `positioning.md`, `messaging-library.md` (tagline #7, all boilerplate, the
  founder bio) and `category.md` still contain the banned phrase. Do not copy
  from them verbatim.
- **B11 — only three things may be called measurement:** reachability (a real
  modeled access graph), exact areas (shoelace / πR²), and byte-identical
  determinism. Clear widths, walk distances and furniture clearances are
  **advisory**, always. The safe verb where "measured" is not is **"checked"**.
- **B12 — never say the gate blocks a defective plan.** `SHIP_RESIDUAL = true`:
  out of budget with defects left, it charges and ships. It is a **governor, not
  a gate**.
- **B4 — no "as code", no DSL jargon, no `.arch` source on screen.** ArchLang is
  not named anywhere in this film. That is a different room and a different
  funnel.
- **B3 — no permit or buildability overclaim.** Not "build from", not
  "buildable", not "permit-ready", not "code-compliant".

Also: **do not open on "AI"** — open on the plan and the help. **No traction
number appears, ever** (every figure available is either zero or unquotable
without its n). **No bare dollar price on screen** (USD on a `.uk` domain is
DMCCA drip-pricing exposure). **Any AI rendering carries the product's own
AI-generated pill** (EU AI Act Art 50; grace period ends 2026-12-02).

---

## Structure — stations, not scenes

There are no cuts. The narrative unit is a **station**: a rectangle in world
coordinates plus an intent, declared in seconds in `src/stations.ts`. The camera
interpolates between them.

**Zoom interpolates on `log(scale)`, never on `scale`.** Linear scale
interpolation reads as an ease that speeds up and then stalls; log scale reads
as constant-velocity zoom, which is what a camera does.

The film exhales from station 0 to station 6 (one continuous pull-back), then
inhales once on station 7 (a fast push back to the origin). That shape is the
edit; do not add cuts to it.

---

## Traps already paid for

Carried over from `../chan-meng-promo-video/TODO.md` §7 and its
`docs/decisions.md` §7b, and from `../a11y-loop-promo-video`. Every one of these
cost real time somewhere. Do not rediscover them.

- **Measure layout only after `document.fonts.ready`.** An effect runs before
  the webfonts are applied, so text is sized in fallback metrics — and the
  fallback layout can be *shorter*. An overflow guard once reported a
  comfortable fit on a frame overflowing by 507px. `<Stage>` takes a
  `delayRender` handle, waits on `document.fonts.ready`, and only then measures.
  **Any layout assertion in this repo must do the same.**
- **Remotion shows only the first line of a `cancelRender` message.** Keep every
  diagnostic on one line or you will not see it.
- **Remotion fails *softly* on a missing `staticFile()`** — you get a blank
  region in the render, not an error, so a long render can complete and ship
  with a hole in it. `verify:assets` runs first for exactly this reason.
- **Don't probe audio durations in `calculateMetadata`.** It runs in Studio
  *and* in every render worker, and a catch-block that substitutes a default is
  how a film ships at placeholder timing with nobody noticing. Probe once with
  ffprobe in `scripts/measure-vo.mjs`, commit the numbers to `src/data/vo.json`,
  read them synchronously.
- **Use the core `remotion` `<Audio>`, not `@remotion/media`'s.** The latter
  previewed fine and rendered a silent track (−91 dB across the file) in
  a11y-loop-promo-video. Worth retrying on a future release; not on this one.
- **Always clamp `interpolate`** — `extrapolateLeft` *and* `extrapolateRight`.
- **Nothing inside a `<Stage>` may shrink.** Flex items shrink by default and a
  frame that does not fit should fail, not silently compress. Enforced with
  `[data-stage] * { flex-shrink: 0 }`.
- **Scenes never read `useVideoConfig().width`.** They read `useLayout()`.
  A component inside a `<Sequence>` also must take its length as a `dur` prop —
  `useVideoConfig().durationInFrames` reports the *composition* length there.
- **Authored line breaks, rendered `nowrap`.** The same string breaks in
  different places at 1080 and 1920 wide; a bad break must show up as an
  overflow failure, not a silent reflow.
- **The camera's maximum zoom is bounded by the largest asset's native pixels**,
  which is a measured number in `src/data/assets.json`, not a guess. The
  renderings are roughly 1024–1536px wide.
- **ffmpeg on Windows/PowerShell:** wrap it in `$ErrorActionPreference =
  "Continue"` (ffmpeg writes progress to stderr, which PowerShell turns into
  error records); put `-ss` **after** `-i` (output seeking is sample-accurate;
  input seeking on an mp3 can land ~26ms out); pass `-vn` when touching a SUNO
  file (embedded mjpeg cover art becomes a video stream otherwise).

---

## Commands

```bash
npm install
cp .env.example .env              # ELEVENLABS_API_KEY (TTS + SFX scopes)
npm run sync:assets               # stage assets from ../archcanvas-promo-video
npm run dev                       # Remotion Studio

npm run vo                        # ElevenLabs narration
npm run vo:measure                # ffprobe -> src/data/vo.json (the film's clock)
npm run sfx
npm run captions                  # out/*.srt + out/*.vtt

npm run lint                      # tsc
npm run verify                    # assets -> timeline -> copy -> numbers
npx remotion still Zoom-Landscape-16x9 out/check.png --frame=<n>
pwsh -File ./render.ps1           # all four formats
npm run verify:flash out/<master>.mp4
```

## Don'ts

- Don't commit the masters. ~90MB each, four of them. GitHub Release assets.
- Don't commit `.env`, `public/`, or `audio/source/`.
- Don't add a cut. The film is one camera move; that is the whole idea.
- Don't name ArchLang, show `.arch` source, or write "as code".
- Don't put a number on screen that isn't in `src/data/`.
- Don't hand-place a music duck window — derive it from where the voice is.
