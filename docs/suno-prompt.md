# SUNO brief — «Zoom Out»

The founder generates this in SUNO and drops the mp3 into `audio/source/`. Nothing in
this repo generates music. Keep this file so a regeneration starts from the brief rather
than from memory.

**Use Custom mode with Instrumental ON.** SUNO reads the section tags in the Lyrics box
even with Instrumental on, and that is what puts the lift where the film needs it.

---

## Do not reuse the old film's prompt — and do not reuse this file's first draft

`../archcanvas-promo-video/docs/suno-prompt.md` asked for warm felt piano, "a drafting
studio at work", A major at 92 BPM. It worked **for a silent 92-second film made of eleven
cuts**, and it is the wrong brief here.

**The first draft of this file was also wrong, in the opposite direction, and it is worth
saying why so nobody re-derives it.** It asked for "slow ambient… 68 BPM… no pulse…
resolved, not triumphant", and it produced exactly that: something calm, flat and quiet.
The reasoning that got there was sound in each step and wrong in sum — the first film was
restrained, this film has a narrator so the mid-range must stay clear, therefore restraint
everywhere. But restraint is a *texture* decision, not an *energy* decision, and the two
got conflated.

**This is a product promo.** Someone finishes watching it and wants to go and try the
thing. A track that is merely tasteful fails that job completely, and a beautiful bed
nobody remembers is worse than a slightly obvious one that moves.

| | Old film | First draft here | **What this film needs** |
|---|---|---|---|
| Edit | 11 cuts | one continuous move | one continuous move |
| Energy | patient | **calm, flat — the mistake** | **coiled, then released** |
| Pulse | light, steady | **none** | **present from ~8s and driving** |
| Tempo | 92 BPM | **68 BPM** | **108–116 BPM** |
| Arrival | none | "a lift, not a hit" | **a real arrival at 72s** |
| Job | inform | inform | **make someone want to try it** |

Two things from the first draft survive, because they are still true:

1. **The mid-range stays hollow.** There is a narrator. A speaking voice occupies roughly
   200–2000 Hz, and a melodic lead in that band becomes a second voice arguing with the
   first. Energy comes from the **low end and the percussion**, not from a tune in the
   middle. This is what lets the track be driving *and* stay out of the way.
2. **No seams.** The film has no cuts, so a sectioned arrangement is audible as a join
   with nothing on screen to hide behind. It must build *continuously*.

Those two constraints are compatible with drive. They were never a reason to be quiet.

---

## The prompt

**Use Custom mode with Instrumental ON.** SUNO reads the section tags in the Lyrics box
even with Instrumental on, and that is what puts the arrival where the film needs it.

### Style of Music

```
Propulsive minimal electronic instrumental for a product film. Momentum from the
first bar. A tight muted pulse and a warm analog sub bass drive it forward the
whole way through, steady and confident, never frantic.
Built low and high with the middle left open: sub bass and kick underneath,
bright glass bells, plucked harmonics and airy synth above. No lead melody and
nothing melodic in the vocal range.
It starts dark, close and coiled -- filtered, contained, like something about to
move -- and opens continuously into bright daylight, adding layers and widening
the stereo field as it goes. Never resets, never restarts, no seams.
The biggest moment is at 1:12: everything opens at once and the track arrives.
Confident and modern, clean and precise rather than epic. Optimistic ending.
D minor into F major, 112 BPM, instrumental only.
```

### Lyrics box — structure tags

```
[Intro - 8 bars, dark and filtered, muted pulse enters immediately, sub bass, tension, no melody]
[Continuous - 16 bars, pulse opens up, add crisp percussion and analog sub, forward motion, mid-range stays empty, no section break]
[Continuous - 16 bars, first light above, glass bells and plucked harmonics enter high, energy still climbing, no section break]
[Continuous - 16 bars, fuller and brighter, layers stacking, widening, still climbing, no section break]
[Arrival - 8 bars, the peak of the track, everything opens at once, bright and full and moving, major, no vocal, no braam]
[Continuous - 8 bars, hold the energy, resolve into the major, confident]
[Outro - 4 bars, land it cleanly on a downbeat, no long fade]
```

The repeated `[Continuous … no section break]` tags are doing real work: SUNO answers a
**change of tag name** with a change of arrangement, which is the seam a cutless film
cannot have. Same tag name, incremental instructions. `[Arrival]` is named differently on
purpose — that is the one place a change is wanted.

### Exclude Styles

```
vocals, singing, vocal chops, choir, rap, cinematic trailer braam, orchestral
swell, sidechain pumping, aggressive, distorted, lo-fi hiss, prominent lead
melody, busy midrange, melodic lead in vocal range, sectioned arrangement, hard
section change, key change, tempo change, ambient, drone, sleepy, sparse, slow,
new age, meditation, long fade out
```

Note what is **no longer excluded**, and deliberately so: `build-up`, `drop`, `riser`,
`triumphant`, `anthemic`. The first draft banned all of those and that is how it talked
itself into a lullaby. They are not wanted as *EDM cliché* — that is what
`sidechain pumping` and `cinematic trailer braam` are still excluding — but the film's
72-second reversal is a genuine arrival and the music is allowed to arrive with it.

`ambient`, `drone`, `sleepy`, `sparse`, `slow`, `meditation` and `new age` are now on the
exclude list. They are there because the first take came back as all seven.

## Where the music has to do work

Times are from the start of the film. **The station times below are approximate** — the
authority is `src/stations.ts`, which declares them in seconds, and this table should be
re-checked against it once the picture is locked. The one number that is not
approximate is **the reversal at ~72s**.

| Time | On screen | What the music does |
|---|---|---|
| 0s | Graphite dark. One interior, very close, filling the frame | The pulse is already there, filtered and contained. Not quiet — **coiled**. Something is about to move |
| ~9s | The camera starts to leave. A drawing resolves beside the rendering | The filter opens. Sub bass arrives, the pulse gets its low end, the frame starts moving |
| ~19s | A drawing, whole, and the first ground lightening | Percussion sharpens, momentum builds. No new *section* — the film has no cuts and the music must not imply one |
| ~30s | Numbers and facts around the drawing | Keep driving, but hold the middle clear: this is the densest narration in the film and the voice needs that band |
| ~40s | The note. The design is about to change | First light above — glass bells, plucked harmonics. Energy keeps climbing; nothing steps back |
| ~50s | The lineage: many versions of one thing, and a defect being fixed | Widen hard. Layers stack. This is the run-up and it should feel like one |
| ~60s | **The wall. No narration — deliberate silence** | **The music's only solo.** Everything held back so far comes forward. Nobody is speaking; this stretch is the track's to own |
| **~72s** | **The camera stops, reverses, and rushes back in to the sentence that started it** | **The arrival.** Everything opens at once — bright, full, moving. The film's biggest move gets the track's biggest moment |
| ~80s | The sentence, held. Ivory daylight | Hold the energy and resolve into the major. Confident and arrived — not a wind-down |
| 85s | The mark | Land it cleanly on a downbeat |

**Say it once more, because it is the single instruction that matters:** the strongest
moment of the track is at **1:12 of the film**. If SUNO puts its biggest moment somewhere
else, `tools/analyze-music.mjs --land 72` finds the window of the 2-minute take that moves
it there. That is what the window-cutting tools are for, and it is why the brief asks for
two minutes rather than eighty-eight seconds.

**The lift must not land on a spoken line.** The `wall` station carries no narration by
design, and the reversal into `sentence` is the gap the lift is aimed at. Once
`src/data/vo.json` exists, check the lift against it: `scripts/measure-vo.mjs` writes the
usable duration of every take, so the gaps are a measured fact rather than a guess.

---

## What to reject on listen-back

Every "no" above is doing work. These are the failures to listen for, in the order they
are likely to happen.

- **No momentum.** The first question is not "is this beautiful", it is **"do I want to go
  and try the thing"**. A take that is merely tasteful has failed. This is the failure the
  first draft of this brief actively caused, so check it first.
- **Seams.** Play it once with your eyes shut and count the moments where you hear the
  arrangement *change* rather than *grow*. More than one and it is the wrong take. Hardest
  failure to hear on a second listen, because by then you know where they are.
- **Anything in the middle.** Solo 200–2000 Hz if you can. A tune in there fights the
  narration for 85 seconds and both lose. Energy belongs in the low end and the percussion.
- **An arrival that does not arrive.** At 1:12 the track should open, not merely continue.
  If you cannot point at the moment, it is not there.
- **Sidechain pumping, or a trailer braam at the arrival.** The reversal is a camera
  changing its mind at speed — it wants *light and width*, not a stadium impact. This is
  the one place where "more" can still be the wrong answer.
- **Vocals or vocal chops of any kind**, including wordless "ahh" pads that read as a voice.
  There is a narrator; a second voice has nothing to say.
- **A tempo or key change.** Either one is a seam by another name.
- **Loudness.** Check true peak before anything else. The old film's take arrived at
  **+0.2 dBFS — already clipping** — and no amount of downward gain un-clips it.
  `tools/prepare-bed.ps1` reports the source's true peak on every run for this reason.

---

## Once the take exists

```bash
# 1. What is it? duration, tempo, phase, arrangement, onsets, window candidates
node tools/analyze-music.mjs "audio/source/<take>.mp3" 85 --land 72

# 2. If the lift needs pinning to the frame, measure its edge, not its middle
node tools/find-window.mjs  "audio/source/<take>.mp3" <bpm> <phase> 72 85
node tools/locate-drop.mjs  "audio/source/<take>.mp3" <from> <to> <bpm> <phase> 72

# 3. Cut and level. One flat gain, never loudnorm's dynamic mode.
pwsh -File tools/prepare-bed.ps1 -Source "audio/source/<take>.mp3" -Start <s> -Length 85
```

`prepare-bed.ps1` targets **−20 LUFS**, not the −16/−17 the silent films used. There is a
narrator now; a bed mastered to speak-level leaves the composition nothing to duck. It
does **not** duck — per `CLAUDE.md`'s last Don't, the duck is derived from where the voice
is (`src/data/vo.json`) and applied in the composition, never hand-placed here.

---

## Fallback — build the picture before the track exists

Until the new take exists, **`public/audio/bgm.mp3` is the placeholder**: the old film's
92-second bed, copied byte-for-byte by `scripts/sync-assets.mjs`. The picture can be built
and reviewed against it. Measured:

| | Recorded by the old project | Re-measured by `tools/analyze-music.mjs` here |
|---|---|---|
| Source take | `drafting-room-full.mp3`, 203.93s | **203.934s** ✓ |
| Tempo | ~97.75 BPM (0.25 BPM grid) | **98.35 BPM**, phase-locked, drift 0.020s |
| Beat | 0.6138s | **0.6101s** (bar 2.4403s, phase 0.46s) |
| Strongest accent | 112.03s | **112.03s, strength 0.1541** ✓ |
| Source loudness | −14.5 LUFS, true peak **+0.2 dBFS** | **−14.5 LUFS, +0.2 dBFS** ✓ |
| Delivered bed | 92.000s, −16.9 LUFS | 92.000s ✓ |

The 0.6 BPM difference is grid resolution, not disagreement: the old tool searched
60–180 BPM in 0.25 steps with a lag rounded to whole 10ms frames, this one searches
60–200 in 0.05 steps with a fractional interpolated lag and then confirms the octave by
phase lock. Same beat, measured finer.

**It is only a placeholder.** It is 92s against an 85s film, it is a sectioned
arrangement, it was mastered for a film with no voice in it, and its biggest accent is
nowhere near 72s. Do not ship it.

---

## Licensing — CLOSED, 2026-09-08

Confirmed by the founder on **2026-09-08**: both vendors are on **paid tiers that
permit commercial use**. This gate does not block a public ship.

- [x] **ElevenLabs — Text to Speech:** paid tier, commercial use permitted · confirmed 2026-09-08
- [x] **ElevenLabs — Sound Effects:** paid tier, commercial use permitted · confirmed 2026-09-08
- [x] **SUNO:** paid tier, commercial use permitted · confirmed 2026-09-08

The specific plan names were not recorded, only the entitlement. If a vendor's
terms are ever challenged, that is the thing to go and re-check — the older film
at `../archcanvas-promo-video` left both of these boxes **empty**, and its
master shipped anyway, which is exactly how an open gate stops being noticed.

### What is actually covered by these boxes

Two vendors, and **20 generated assets on disk today** plus one not yet made:

| Vendor | Product | Assets | Where |
|---|---|---|---|
| ElevenLabs | Text to Speech | **8** narration takes | `public/audio/vo-*.mp3` |
| ElevenLabs | Sound Effects | **4** new cues | `public/audio/sfx-{room-air,detent,paper-rush,final-settle}.mp3` |
| ElevenLabs | Sound Effects | **8** cues inherited from `../archcanvas-promo-video` | staged into `public/audio/`, generated for that film |
| SUNO | music | **0 so far** — the track this document briefs | will land in `audio/source/` |

That is 12 ElevenLabs Sound Effects assets in total, not 4: the inherited eight came off
the same account, which is why this is one gate across two films rather than two separate
gates. **The equivalent boxes in `../archcanvas-promo-video/docs/suno-prompt.md` are still
unticked**, and that film has already shipped — worth closing there too, since the
confirmation above covers the same assets.

### One measured fact the confirmation does not settle

Recorded because it is evidence and it should not vanish just because the box is ticked:
at **2026-09-08**, while the 8 narration takes and the 4 new effects were being generated,
`GET /v1/user/subscription` on the key in `.env` returned **`tier: "free"`** (1,615 of
10,000 characters used). The key carried the Text to Speech scope and everything generated
normally, so nothing was blocked — but the tier the API reported at generation time was
the free one.

That is not a contradiction of the confirmation above, and it is not a reason to redo
anything. There are ordinary explanations: the plan may have been upgraded after the
check, or the key may belong to a workspace that reports separately from the billed
account. It matters only because commercial rights on both platforms attach to the tier
active **when an asset was generated**, not when it ships — so if a vendor's terms are
ever actually challenged, the question to answer is *what tier was live on 2026-09-08*,
and this paragraph is where to start.

If regeneration on a paid plan ever does turn out to be needed, the two halves are not
equally cheap:

- **The 8 narration takes** are seeded from 2026-09-08 onward
  (`scripts/generate-vo.mjs`), so a re-read on a paid plan is *timing*-identical and the
  edit does not move. The takes on disk pre-date the seeding, so a re-read of those would
  change their lengths — though with every station currently floored by its `minSec`,
  probably not a single frame.
- **The 12 sound effects** cannot be reproduced at all. The same prompt returns a
  different sound. Regenerating them is a **re-mix, not a re-render**.

So the ordering rule, for any audio generated from here on: **be on the paid plan before
generating, not before shipping.** The cost of getting that order wrong is the sound
design, not the money.

That is also why each confirmation above carries a date rather than just a tier, and why
Text to Speech and Sound Effects get their own line even though they are one vendor and
one key: they are separately entitled products, and the assets they produced differ in
whether they could ever be made again.
