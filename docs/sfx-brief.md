# Sound effects brief

Twelve cues. Eight are inherited from `../archcanvas-promo-video` and cost nothing; four
are new and exist because **this film has no cuts**. `scripts/generate-sfx.mjs` is the
whole implementation — the prompts live in its `CUES` array, this file is the argument for
them, and `public/audio/sfx-manifest.json` is the record of what was actually generated.

---

## House style — read before writing a prompt

Every prompt in this film is built the same way, and the shape is not decoration:

```
<one physical event, named concretely>. <Distance and character>. <Explicit negatives>.
```

- **One event, not a soundscape.** "A rubber stamp pressed once onto paper", not "office
  ambience". The model will happily give you a scene; a scene cannot be placed on a frame.
- **Close, dry, small.** Every cue in this film is at arm's length on a desk. The moment
  something has a room around it, it stops being a drafting table and starts being a
  location.
- **A negative clause, always.** The model reaches for reverb, a "cinematic" tail and a
  whoosh sweep unless it is told not to. Every prompt ends in a list of nos, and the nos
  are the difference between a sound and a sound effect.
- **Physical objects only.** Paper, graphite, brass, wood, a key, a stamp. Never a UI
  sound, never a synth. The film's visual thesis is ink on paper and a generic interface
  "whoosh" breaks it faster than a wrong colour would.

## Why this film needs four more

The old film was eleven frames with cuts between them. A cut is itself a piece of
punctuation — it tells the ear that something changed — so its sound design only had to
*mark* the beats the cuts already made.

This film is one 85-second camera move. There is nothing to mark. What the sound design
has to do instead is make continuous motion *legible*: give the move a floor to travel
over, give the eye a small confirmation when detail resolves, and give the one direction
change in the film an edge you can hear. Three of the four new cues are that, one each.
The fourth is the landing.

### 1. `sfx-room-air` — a floor for the whole move

**30.0s · −48.2 LUFS · peak −30.3 dBFS · designed to loop**

> A very low continuous air tone in a large empty quiet room. Almost inaudible, flat and
> even from beginning to end, no movement and no shape. Close and warm. No hum, no drone
> note, no pitch, no hiss sweep, no rise, no reverb tail, no music.

A continuous camera move over silence reads as a still image being scaled. Something has
to be *present* the whole way so the move has a medium to happen in. But the moment that
something has a pitch it becomes a drone, and a drone under an 85-second film is a mood
the film did not ask for — which is why "no drone note, no pitch" is in the prompt and
"almost inaudible" is the first instruction.

**It is designed to loop.** 30s is the sound-generation endpoint's ceiling, so three
passes cover the film rather than five. "Flat and even from beginning to end, no movement
and no shape" is the loop requirement stated as a character note: a clip with an arrival
anywhere in it produces an audible pulse every 30 seconds. Measured after generation, the
delivered take varies **3.3 dB across its whole length** in 1-second blocks — flat enough
that a short crossfade hides the seam completely.

At −48 LUFS it sits roughly 30 dB under the narration. That is correct. It is not meant
to be heard; it is meant to be missed when it stops.

### 2. `sfx-detent` — detail resolving

**0.48s · −22.8 LUFS · peak −9.8 dBFS**

> One small sprung mechanical detent, a dial passing a single notch. Very close, dry,
> tiny, low. One event only. No reverb, no echo, no rattle, no spring ring, no music.

The film's zoom crosses thresholds where a thing that was a grey rectangle becomes a
drawing with rooms in it. Visually that is a gradual dissolve; the eye may not notice the
moment it happened. A tiny mechanical detent at the crossing is the difference between "it
got bigger" and "it came into focus" — the same reason a good camera lens has a click stop
and a bad one does not.

It has to be *tiny*. Every negative in that prompt exists to stop it becoming a click
track: "one event only" against a repeat, "no spring ring" and "no rattle" against a tail
that would still be sounding when the next threshold arrives. The requested 0.5s is the
endpoint's floor, not a design choice — the sound wanted is nearer 150 ms, and the mix
trims the rest.

### 3. `sfx-paper-rush` — the reversal at ~72s

**1.36s · −28.7 LUFS · peak −12.3 dBFS**

> A large sheet of paper rushing past the microphone in one fast pass. Grain and air,
> accelerating and then stopping cleanly. Close, dry. No crinkle, no tearing, no synth
> whoosh sweep, no reverb tail, no music.

This is the only fast move in 85 seconds. The camera stops pulling back and rushes home to
the sentence that started everything, and it is the one moment where the film could
plausibly take a sound that has some force in it.

The negatives are the whole cue. **"No synth whoosh sweep"** is the important one: a
whoosh is the default sound for a fast camera move and it would make this a transition in
a product video. What is wanted is the *material* moving — paper grain and air, the sound
of the film's own substance being crossed at speed. **"Accelerating and then stopping
cleanly"** matters because a rush that decays past the arrival keeps moving after the
camera has stopped, and the ear hears that as the camera overshooting.

Deliberately quieter than the inherited `sfx-warm-swell` it is heard next to. The reversal
is a change of mind, not an impact.

### 4. `sfx-final-settle` — the landing

**1.20s · −25.9 LUFS · peak −8.0 dBFS**

> A single sheet of paper coming to rest on a wooden desk and going completely still. One
> soft contact, then nothing. Close, dry, small. No rustle loop, no second contact, no
> reverb, no music.

The film ends on a hold. The inherited `sfx-stamp` marks the mark, but a stamp is a
*period* and the film needs something after the period — the sound of everything stopping.

"One soft contact, then nothing" and "no second contact" are the same instruction twice
because the model will give you paper settling, which is naturally two or three contacts,
and two contacts read as an accident rather than an ending.

Optional in the sense that the film works without it; kept because the last three seconds
of an 85-second continuous move are otherwise the only place with no sound design at all,
and silence there reads as a file that ran out.

---

## The inherited eight

Unchanged prompts, reproduced verbatim in `scripts/generate-sfx.mjs` so this repo is the
whole record. Their `station` mapping is new — the old film had eleven frames, this one
has nine stations — and it is documentation, not wiring; the mix is authored in the
composition.

| Cue | Station | Measured |
|---|---|---|
| `sfx-pencil-line` | `drawing` | 1.600s |
| `sfx-ui-click` | `facts` | 0.600s |
| `sfx-tick` | `facts` | 0.480s |
| `sfx-paper-settle` | `pair` | 1.480s |
| `sfx-paper-sweep` | `lineage` | 0.880s |
| `sfx-instrument` | `note` | 0.880s |
| `sfx-warm-swell` | `wall` | 2.560s |
| `sfx-stamp` | `mark` | 1.000s |

`sfx-warm-swell` is placed at `wall` on purpose. `wall` is the film's deliberate silence —
the one station with no narration — so it is the only place the sound design gets the
frame to itself.

---

## Where the files live

`public/audio/<id>.mp3`, and nowhere else. That is where `staticFile()` can reach them and
where `src/data/assets.json` covers them.

An earlier version of `generate-sfx.mjs` also kept a copy at the repo root, on the
reasoning that `public/` is gitignored and rebuilt by `scripts/sync-assets.mjs` while
these four cues cost credits. That was wrong twice over. The root `audio/` is only
gitignored at `audio/source/*`, so the copies would have been **committed as tracked
binaries** — precisely what the ignore policy exists to prevent, and 528 KB of it that git
would keep forever. And it was solving the wrong problem: what is worth preserving is the
*recipe*, not the bytes. Every prompt is in `scripts/generate-sfx.mjs` and in the manifest,
so a regeneration starts from the same brief.

It does mean a cleared `public/audio/` costs credits to refill. That is the honest trade,
and it is small: four requests. `audio/source/` stays what it is for — the SUNO drop point.

**The four new cues are not sync's to produce.** The eight inherited ones are copied in
from `../archcanvas-promo-video/audio/`; these four come only from
`node --env-file=.env scripts/generate-sfx.mjs`. Sync should be additive over
`public/audio/` rather than clean-and-copy.

`public/audio/sfx-manifest.json` records, per cue: file, origin, station, requested
duration, **measured** duration, prompt, and a generation timestamp. Requested and measured
are separate columns because `duration_seconds` is a request and not a contract — the
detent came back at 0.48s against a 0.5s request, and a mix built on the request rather
than the measurement lands late.

---

## Licensing — the same open gate as the music

Everything here was generated on the founder's ElevenLabs account. Checked on
**2026-09-08** via `GET /v1/user/subscription`, that account is on the **`free`** tier
(1,615 of 10,000 characters used at the time of checking).

**The free tier does not carry commercial use rights.** Both the eight inherited cues and
the four new ones were generated under it, and the conservative reading of ElevenLabs'
terms is that the licence attaches at the moment of generation — so upgrading later may
not retroactively license audio already made. **Confirm this directly with ElevenLabs
before the film ships publicly**; if it does not apply retroactively, every cue has to be
regenerated on a paid plan, and regenerating gives twelve *different sounds*, which is a
re-mix, not a re-render. Budget for that, or upgrade first.

The same gate covers the narration (a second ElevenLabs product with its own entitlement)
and SUNO. The checklist is in `docs/suno-prompt.md` § Licensing; the boxes in
`../archcanvas-promo-video/docs/suno-prompt.md` are **still unticked**, so this is one open
gate across two films, not two.
