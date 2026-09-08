# SUNO brief — «Zoom Out»

The founder generates this in SUNO and drops the mp3 into `audio/source/`. Nothing in
this repo generates music. Keep this file so a regeneration starts from the brief rather
than from memory.

**Use Custom mode with Instrumental ON.** SUNO reads the section tags in the Lyrics box
even with Instrumental on, and that is what puts the lift where the film needs it.

---

## Do not reuse the old film's prompt

`../archcanvas-promo-video/docs/suno-prompt.md` asked for warm felt piano, "a drafting
studio at work", A major at 92 BPM, in a sectioned arrangement. It worked, and it is the
wrong brief for this film. Four differences, and each one changes the music:

| | Old film | This film |
|---|---|---|
| Edit | 11 frames, hard cuts | **One continuous 85s camera pull-back, no cuts** |
| Shape | Sectioned arrangement hitting 11 frame boundaries | **One breath.** The track must swell once, not resume eleven times |
| Ground | Ivory paper throughout | **Graphite night washing to ivory daylight** |
| Voice | Silent | **There is a narrator.** The bed has to live under speech for 85 seconds |

The old film's music had to hit boundaries. This one has to *breathe once*. A sectioned
arrangement is audible as seams, and a seam in a film with no cuts is a mistake with
nothing on screen to hide behind.

---

## The prompt

### Style of Music

```
Slow ambient instrumental for a design documentary. One continuous swell over
two minutes, no sections and no seams. Starts almost silent and very close:
low bowed double bass, a soft sub pad, one sparse low piano note with long
decay, faint paper and graphite texture. Dark, contained, night.
It opens outward gradually and never stops opening: air and light come in from
above as high glass bells, bowed harmonics and soft strings enter, while the
low end stays warm and holds the floor. Dark to daylight, one long inhale.
Deliberately hollow in the middle: keep the arrangement low and high, leave
the mid-range empty. No lead melody, no melodic instrument in the vocal range.
The strongest lift arrives at 1:12 into the track, then resolves and settles.
Resolved, not triumphant. Patient, unhurried, human.
D minor opening resolving into F major, 68 BPM, instrumental only.
```

**Why "deliberately hollow in the middle" is in the prompt and not an afterthought.**
There is a narrator. A speaking voice occupies roughly 200–2000 Hz, and anything melodic
in that band becomes a second voice arguing with the first. The mix that works is
weighted low and high — a warm floor and an airy ceiling with the middle left open. This
is also why there is no lead melody: a lead is a narrator with nothing to say.

### Lyrics box — structure tags

```
[Intro - 16 bars, near silence, low bowed bass and one sparse piano note, very dark, no pulse]
[Continuous - 16 bars, same idea opening slightly, add sub pad and paper texture, no section break]
[Continuous - 16 bars, first light, high glass bells enter above, mid-range stays empty, no section break]
[Continuous - 16 bars, warmth arrives underneath, bowed strings swell slowly, still no arrival, no section break]
[Lift - 8 bars, the strongest moment of the piece, full and open, light rather than loud, no drum hit and no drop]
[Resolve - 8 bars, settle, thin back toward the opening but in the major, calm]
[Outro - 4 bars, one long held low note fading to nothing, clean, no long tail]
```

The repeated `[Continuous ... no section break]` tags are doing the real work: SUNO
answers a change of tag name with a change of arrangement, which is exactly the seam this
film cannot have. Same tag name, incremental instructions.

### Exclude Styles

```
vocals, singing, vocal chops, choir, rap, EDM, trap, dubstep, drum and bass,
cinematic trailer braams, orchestral swell, riser into a drop, drop, build-up,
sidechain pumping, side-chained pad, triumphant, anthemic, victorious,
aggressive, distorted, lo-fi hiss, arpeggiated synth lead, prominent lead
melody, busy midrange, sectioned arrangement, hard section change, key change,
tempo change, fade in, long fade out
```

Four of these are about this brand rather than about this film, and they were on the old
prompt for the same reason:

- **vocals / vocal chops** — the old film had no narrator, so a vocal line would have
  *become* the narrator. This film has one, and a vocal line competes with them. Banned
  either way, for opposite reasons.
- **riser into a drop** — the film's biggest moment is a drawing and a sentence. A drop
  makes it a product launch, and this product is not launched, it is used.
- **sidechain pumping** — audible pumping is a ducking system announcing itself. The
  narration duck in this film is derived from `src/data/vo.json` and applied in the
  composition; it must be inaudible as a process.
- **triumphant ending** — the film closes on a mark and a hold, not on a win.

### Length

Ask for **2 minutes** and trim. Asking for the film's exact 85 seconds produces a rushed
ending — the model spends its last bars getting somewhere instead of arriving. Two minutes
also gives `tools/analyze-music.mjs` more than one usable window to choose between.

---

## Where the music has to do work

Times are from the start of the film. **The station times below are approximate** — the
authority is `src/stations.ts`, which declares them in seconds, and this table should be
re-checked against it once the picture is locked. The one number that is not
approximate is **the reversal at ~72s**.

| Time | On screen | What the music does |
|---|---|---|
| 0s | Graphite dark. One interior, very close, filling the frame | Almost nothing. Low bass, one piano note, air. The narrator's first line has to sit on silence |
| ~9s | The camera starts to leave. A pair of drawings resolves beside it | Still barely present. A slow pull downward in the low end so the frame feels like it is opening |
| ~19s | A drawing, whole, and the first ground lightening | First warmth underneath. No new rhythm — the film has no cuts, so the music must not imply one |
| ~30s | Numbers and facts, small, around the drawing | Hold. Do not lift here; this is where the narration is densest and needs the room |
| ~40s | A note, a revision, the design changing | The ground is grey now. Let one high element in — the first light — but keep it above the voice |
| ~50s | The lineage: many versions of one thing | Widen. This is the only place before the lift where the music may become noticeably bigger |
| ~60s | **The wall. No narration — deliberate silence** | **The music's only solo.** Everything the bed has been holding back it may show here, because nobody is speaking over it |
| **~72s** | **The camera stops, reverses, and rushes back in to the sentence that started everything** | **The strongest lift in the piece lands here.** Light, not volume. Open, not loud. No impact, no hit, no drum |
| ~80s | The sentence, held. Ivory daylight | Resolve and settle. Warm, arrived, quiet |
| 85s | The mark | One low held note into nothing |

**Say it once more, because it is the single instruction that matters:** the strongest
moment of the track is at **1:12 of the film**, and it must be a *lift*, not a hit. If
SUNO puts its biggest moment somewhere else, `tools/analyze-music.mjs --land 72` will find
the window of the 2-minute take that moves it there — but a take whose biggest moment is a
percussive drop cannot be rescued by a window, and should be regenerated.

**The lift must not land on a spoken line.** The `wall` station carries no narration by
design, and the reversal into `sentence` is the gap the lift is aimed at. Once
`src/data/vo.json` exists, check the lift against it: `scripts/measure-vo.mjs` writes the
usable duration of every take, so the gaps are a measured fact rather than a guess.

---

## What to reject on listen-back

Every "no" above is doing work. These are the failures to listen for, in the order they
are likely to happen.

- **Seams.** Play it once with your eyes shut and count the moments where you can hear the
  arrangement *change* rather than *grow*. More than one, and it is the wrong take. This is
  the failure this film is most exposed to and the hardest one to hear on a second listen,
  because by then you know where they are.
- **Anything in the middle.** Solo the 200–2000 Hz band if you can. If there is a tune in
  there, the narration will fight it for 85 seconds and both will lose.
- **A percussive arrival at the lift.** A kick, a braam, a cymbal swell, a reverse cymbal.
  The reversal is a camera changing its mind, not an impact.
- **A pulse that arrives and then insists.** A light pulse is fine; a groove is not. There
  are no cuts for it to be in time with, so it can only be in time with itself.
- **Vocals or vocal chops of any kind**, including wordless "ahh" pads that read as a voice.
- **A triumphant ending.** Warm and resolved. The film ends on a small mark.
- **A first ten seconds that lurches.** The film opens on near-black with one line of
  narration over it. The music's job there is to be barely there.
- **Loudness.** Check the delivered take's true peak before anything else. The old film's
  take arrived at **+0.2 dBFS — already clipping** — and no amount of downward gain
  un-clips it. `tools/prepare-bed.ps1` reports the source's true peak on every run for
  exactly this reason.

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
the same account and carry the same entitlement question, which is why this is one gate
across two films rather than two separate gates. **The equivalent boxes in
`../archcanvas-promo-video/docs/suno-prompt.md` are still unticked.**

### The ElevenLabs boxes have a measured answer and it is the wrong one

Checked **2026-09-08** via `GET /v1/user/subscription`: the founder's account is on the
**`free`** tier (1,615 of 10,000 characters used at the time of checking). The key does
carry the Text to Speech scope — the narration generated fine — but **the free tier does
not carry commercial use rights.**

The conservative reading of ElevenLabs' terms is that the licence attaches **at the moment
of generation**, so upgrading later may not retroactively cover audio already made. If
that reading is right, all 20 assets need regenerating on a paid plan, and the two halves
are not equally cheap:

- **The 8 narration takes** are seeded from 2026-09-08 onward
  (`scripts/generate-vo.mjs`), so a re-read on a paid plan is *timing*-identical and the
  edit does not move. The takes on disk pre-date the seeding, so a re-read of those would
  change their lengths — though with every station currently floored by its `minSec`,
  probably not a single frame.
- **The 12 sound effects** cannot be reproduced at all. The same prompt returns a
  different sound. Regenerating them is a **re-mix, not a re-render**.

**Confirm the retroactivity question with ElevenLabs directly.** If it is not retroactive,
upgrade *first*; the cost of getting the order wrong is the sound design, not the money.

Commercial rights on both platforms are tied to the tier active **when the asset was
generated**, which is why each blank asks for a date and not just a tier — and why TTS and
Sound Effects get their own line even though they are one vendor and one key.
