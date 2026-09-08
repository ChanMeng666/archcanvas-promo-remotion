# Copy clearance

Every word this film speaks or shows, with the approved source it came from and the
banned-claims check it passed.

**Why this file exists.** ArchCanvas takes real card payments, and "architect" is a
protected professional title in two jurisdictions. Its positioning went through four
rounds and produced a standing banned-claims card (B1–B14), a banned-words list, and — in
the 2026-09-01 external risk audit — a fifteenth ban that is not on that card and is a
legal one. Every one of those is grounded in a specific property of the shipped code or a
specific statute. Several live assets, **and several files in the growth repo itself**,
still carry wording that is now banned, so "copy what we already say" is not a safe
default. A line that sounds better and clears nothing is a regression, not an improvement.

**This film has a voiceover, and the voiceover is copy.** The first film
(`../archcanvas-promo-video`) was silent, so its text cards carried the whole argument.
Here the spoken lines carry the argument and the screen carries the evidence, which means
the gate has to read `vo[].text` exactly as hard as it reads `cards[].lines[]`. It does.

`capture/verify-copy.mjs` enforces this file mechanically. It harvests every phrase from
`src/data/script.json` (both arrays) plus every visible string in `src/**/*.tsx`, and fails
on a banned phrase, a banned word, non-English characters, a bare dollar figure, or a
phrase with no row here. **A missing clearance file is itself a violation** — the gate
does not pass by having nothing to check against.

`capture/verify-numbers.mjs` is the other half: it stops the film crossing the numbers of
the two drawings and the one filmed session it shows.

Sources, in the order they were read: `archcanvas-promo-remotion/CLAUDE.md` §Copy law ·
`archcanvas-growth/investor/founder-brief.md` §7 · `archcanvas-growth/strategy/positioning.md` ·
`archcanvas-growth/strategy/category.md` §6 · `archcanvas-growth/marketing/content/voice.md` ·
`archcanvas-growth/marketing/copy/messaging-library.md` ·
`archcanvas-growth/research/red-team/2026-09-01-external-risk-audit.md` §1.10 ·
`archcanvas/tests/marketingNoCode.test.ts` · and the shipped product copy on archcanvas.uk.

---

## The film is silent — and these are its words

**The voiceover was removed on 2026-09-08.** Eight ElevenLabs takes existed and were
cleared; the key they were generated on turned out to be a **free tier**, and ElevenLabs'
free plan carries no commercial licence, with the clause that content created outside a
paid subscription — *before or after* — cannot be used commercially. Upgrading afterwards
would not have licensed what already existed. All twelve ElevenLabs assets were deleted.
See `docs/decisions.md` **D11**.

So the argument moved back onto the screen. **These lines are read, not heard**, and that
changed how they had to be written: a sentence that reads well aloud is usually too long
to take in at a glance while a camera is moving past it. Every line below is **shorter
than the spoken line it came from**, and the longer halves were cut rather than wrapped.

Each `lines[]` entry is registered separately, because a line is the unit the gate checks.
The clearance argument is unchanged — every one is a fragment of a sentence already cleared
in the table below, or a verbatim shipped string in its own right.

| Station | Line (verbatim) | Approved source | Clears |
| --- | --- | --- | --- |
| `interior` | `This room doesn't exist yet.` | Not a claim. It states that the rendering depicts something unbuilt — which is also the honest framing for an AI image, and the film carries the product's own AI-generated pill beside it | **Does not open on "AI"** (do-NOT #2: in the ICP's own spaces, lead with the plan and the help). **B3 clear** — nothing about permits or buildability. |
| `pair` | `The room you picture` `is the room you drew.` | The live landing page's rendering card, verbatim: *"the room you picture is the room you drew — same walls, same light"* (`archcanvas/src/app/(marketing)/page.tsx:37`), under the heading `Renderings grounded in the plan` | Literal and mechanical: the plan is rasterised and passed as `inputImages[0]`. **Law 2 clear** — the frame only ever pairs a rendering with its own drawing, enforced by `verify-numbers.mjs`. |
| `drawing` | `One plan,` `dimensioned to the millimetre.` | The live landing page's outcome copy, verbatim (`BAND_COPY.outcome`, `archcanvas/src/components/landing/CompileScrollBand.tsx:24`), broken across two authored lines | **B11 clear.** Dimensions are compiled geometry, not a clearance figure. |
| `facts` | `Every room reachable.` `Every area exact.` | The live landing page's process copy, verbatim (`BAND_COPY.process`, same file, line 23), split into its own two sentences | **B11 clear by construction.** Reachability (a real modeled access graph) and exact areas (shoelace / πR²) are two of the only three things this company may call measurement. The third, byte-identical determinism, is a developer-room claim and is not used. |
| `note` | *(no card — the product's own review pin is the text)* | — | **The film's one honesty beat is an artifact, not a claim the film makes in its own voice.** The spoken Layer 2 line was cut with the voiceover and deliberately not replaced: the pin says it better, and in the product's own words. See `docs/decisions.md` D1 and D11. |
| `lineage` | `Refine it by talking to it.` `Every edit is free.` | Sentence 1: the Product Hunt gallery shotlist, Shot 3. Sentence 2: the live landing page verbatim (`archcanvas/src/components/landing/StudioSection.tsx:25`) | Factual. Only `generateFloorPlanDSL` charges a credit; edits, quick actions, recompiles, forks and exports are free. |
| `wall` | *(silence — no card, and none may be written)* | — | **B10.** Sixty rasters of the offline designer eval. Presenting that eval as a public benchmark, or putting any score on it, is banned in every room. **B9** bites here too. Showing the volume and saying nothing is the only honest treatment. |
| `sentence` | *(the user's own typed brief — see the cards table)* | — | — |
| `mark` | `Describe your home.` `Get a real, dimensioned floor plan.` | The live H1, verbatim (`HERO_COPY.h1`, `archcanvas/src/components/landing/HeroCompile.tsx:35`), which is authored as three lines and is taken here as two | **Cleared against B3, B4, B5, B7, B11, B12** in `category.md` §6. Hygiene, not differentiation — correct for a closing frame. |

## The cards

Two text cards. `lines` are authored breaks, rendered `nowrap`; each line is registered
separately because that is the unit the gate checks.

| Station | Card lines (verbatim) | Approved source | Clears |
| --- | --- | --- | --- |
| `sentence` | `Three bedrooms, open kitchen and living,` `north-facing, single storey,` `about 110 m2.` | **The user's own typed brief, read off the capture** — `archcanvas-promo-video/capture/assets/videos/c01-brief-typing.mp4`, fully typed and verified at **t = 44.0 s** (clip is 46.0 s, 1786x944, 30 fps) | Not a claim; it is the input a person typed. **Verified against the footage, and the old project's clearance row 01 was wrong**: the brief types ASCII `110 m2`, not `110 m²`. Transcribed as filmed — correcting it would be mocking up the one thing the film says a human wrote. Its `110` is the c01 session's own number and may never be attached to either staged drawing (`verify-numbers.mjs`). |
| `mark` | `Pay only when you get a plan worth keeping.` `A concept plan to take to a professional —` `not a permit set.` `archcanvas.uk` | Line 1: approved tagline #6. Lines 2–3: the live marketing footer's permit disclaimer, verbatim — *"A concept plan to take to a professional — not a permit set."* (`archcanvas/src/components/layout/marketing-footer.tsx:67`). Line 4: the real domain | **B3 clear, and actively discharged.** The film's last frame carries the permit disclaimer the product puts on every marketing page. The disclaimer is broken across two authored lines for the 1080-wide master; both halves are registered. |

## Copy that appears on screen but was written by the product

One string on screen is not ours to author, and must not be paraphrased.

| What | Text (verbatim) | Where it was read | Rule |
| --- | --- | --- | --- |
| The review pin at station `note` | category `PROGRAM`, body `The 110m² plan provides no bathroom, laundry, or dedicated storage.`, actions `Have AI fix` and `Dismiss` | **The product's own words, read off the capture** — `archcanvas-promo-video/capture/assets/videos/c06-review-pins.mp4`, card open and legible from **t ≈ 12 s to the end of the 44 s clip**; transcribed at **t = 20.0 s** and re-read at 26.0 s and 36.0 s to confirm it does not change. The pin counter beside it reads `5`. | **Transcribe, never rewrite.** This is the receipt frame as an artifact rather than a claim — the camera pans past it and you read it in passing. **It belongs to the drawing it was written about and to no other.** That drawing is the c06 session's own 4-room, 108.00 m² state (room schedule on screen: Open Kitchen / Living Room 54.00, Bedroom 1 18.00, Bedroom 2 18.00, Bedroom 3 18.00, TOTAL 108.00) — which is why the pin can truthfully say there is no bathroom. **It is NOT true of `plan-family-house.svg`, which has a Bath and a Laundry, and NOT true of `plan-hero.svg`, which has a Bathroom.** Pairing this pin with either staged plan would put a visible falsehood on screen; `verify-numbers.mjs` fails on it. |

---

## The bans, walked one by one

Bans 1–14 are the standing card in `investor/founder-brief.md` §7. **Ban 15 is not on that
card**, is newer, and is the only one with a fine attached.

| # | The ban | How this film clears it |
| --- | --- | --- |
| B1 | CAD-vs-pixels framing | Never used. The film never contrasts its output against anyone's pixels; that differentiator was retired twice on evidence (Maket exports DXF/DWG/PDF; Synaps generates vectors natively). No competitor is named, shown or implied. |
| B2 | Competitor free-tier figures | No competitor appears, and no figure of that shape is spoken or shown. |
| B3 | Permit / buildability overclaim | Never used, and **actively discharged**: the closing card carries the product's own permit disclaimer verbatim. Nothing says `buildable`, `build from`, `permit-ready` or `code-compliant`. Note that the live site's *"One canvas, from brief to build-ready"* is on the do-not-lift list below. |
| B4 | "as code" / DSL jargon on a consumer surface | Never used. **ArchLang is not named anywhere in this film**, no `.arch` source is shown, and the words `as code` and `DSL` are banned phrases in the gate. A promo video is the consumer room: Layer 1 and Layer 2 only, never Layer 3. The vision line about thirty years of checkers is investor-room and does not appear. |
| B5 | Replaces-your-architect / "an architect in your pocket" | Never used. The closing card hands off to a professional in terms. |
| B6 | Verification value asserted as proven fact | Never asserted. `facts` states what the machine checked; nothing claims buyers value it, or that checking makes the plan correct. A2 stays unproven. |
| B7 | Hype vocabulary | Zero occurrences; mechanically rejected — see the banned-words list. |
| B8 | first / only / missing-primitive / "no checkable text substrate" | Never used. The film makes no claim about the category or about anyone else's product. |
| B9 | Any claim or denial of a model-loop gain | No accuracy, quality, win-rate or comparison figure is spoken or shown. Station `wall` is silent for exactly this reason. |
| B10 | Presenting the offline eval as a public benchmark | No benchmark number appears. The 60 wall rasters are montage only, at a scale where no individual plan is a showcase plan, with no score, no count and no voiceover. |
| **B11** | Clearance or circulation offered as measurement | **A live risk, and the reason `facts` is worded exactly as it is.** Only the two permitted claims are made — every room reachable (a real modeled access graph) and every area exact (shoelace / πR²). The third permitted claim, byte-identical determinism, is a developer-room fact and is left out. The verb everywhere else is **checked**. No clear width, no walk distance, no furniture clearance, and no `every door measured` / `every route walked`. The gate carries the product repo's own three tripwire regexes. |
| **B12** | Any claim that the gate blocks a defective plan | **The other live risk.** `SHIP_RESIDUAL = true`: out of budget with defects left, it charges and ships as `quality: "residual"`. The film's answer is station `note`, which says the opposite of blocking — it says what survived is written down for you. Nothing says `before you see it` or `nothing ships`. |
| B13 | "250 visitors", or any Cloudflare figure as an exact count | **No traction number appears on screen or in the voiceover, ever.** Every figure available is either zero or unquotable without its n. The gate carries needles for the specific ones. |
| B14 | "we have no visitor data" | Not applicable; the film makes no data claim of any kind. |
| **B15** | **`AI architect` — the protected title.** *Not on the B1–B14 card.* | **Never used, and mechanically impossible to reintroduce.** UK Architects Act 1997 s.20 bars carrying on business under any title containing the word unless registered — fine to **£2,500 per offence** — and ARB's Misuse of Title Policy names *"websites (including URLs and metadata)"* as a breach vector. NZ Registered Architects Act 2005 s.7 does the same when building design services are involved, to **NZ$10,000**, and **NZ is the law ArchCanvas's own Terms choose**. The approved substitute is **`AI architectural designer`**, which ARB has said in terms it cannot investigate. The gate carries the product repo's own needle `/\bAI architect(?!ural)/i` as a **regex**, so the substitute passes and the bare title fails. Source: `archcanvas-growth/research/red-team/2026-09-01-external-risk-audit.md` §1.10; enforced in `archcanvas/tests/marketingNoCode.test.ts`. |

### Standing rules, also enforced

| Rule | How this film clears it |
| --- | --- |
| **Do not open on "AI"** | Station `interior` opens on the room and the person: *"This room doesn't exist yet."* The word "AI" is never spoken in the film at all. Documented anti-AI sentiment in the exact communities the ICP gathers in makes it a liability as an opener, not a hook (positioning.md do-NOT #2). |
| **No bare dollar price on screen** | None appears. USD pricing rendered on a `.uk` surface is DMCCA drip-pricing exposure, so the gate fails on any `$`-plus-digit. Tagline #8 (`Your first real floor plan, before the $2,000 bill.`) is cleared copy elsewhere and is deliberately **not used here**. |
| **Every rendering carries the product's own AI-generated pill** | A composition requirement, not a copy one, but it is a legal deadline: EU AI Act Art 50 transparency, grace period ending **2026-12-02**. Stations `interior` and `pair` are the two that show a rendering. The pill is the product's own, captured with the image — it is not drawn by this repo. |
| **English only** | The growth repo bans CJK outright. The gate fails on any CJK codepoint in script or component copy. |
| **Nothing on screen is mocked up** | CLAUDE.md law 2. Both strings in this film that a human or the product wrote — the c01 brief and the c06 review pin — were read off the footage frame by frame and transcribed, not retyped from a doc. The one place the doc and the footage disagreed (`110 m²` vs `110 m2`), the footage won. |

---

## Copy that must NOT be lifted, though it is already published

Reusing any of these would ship a violation into video, where it cannot be edited after
the fact.

**Live brand assets** (carried over from the first film's clearance doc; all three are on
the product repo's own fix list):

- LinkedIn first-post card — **"One plan. Checked before you see it."** → **B12**.
- LinkedIn company banner — **"Floor plans you can actually build from"** → **B3**.
- The live landing page — **"Every route walked, every door measured"** → **B11**. The
  correcting PR is open and unmerged, so the live site currently contradicts
  `positioning.md`. (The two strings this film *does* take from that page — `BAND_COPY.process`
  and `BAND_COPY.outcome` — are the corrected ones, verified in the file on 2026-09-08.)

**Live product copy** carrying a softer version of the same problem:

- `archcanvas/src/components/landing/StudioSection.tsx:20` — **"One canvas, from brief to
  build-ready"** → reads as a **B3** buildability promise. The line beside it,
  `every edit is free`, is fine and is used.

**The growth repository itself has not been updated for B15.** These files still contain
the banned title, and are the most dangerous source in the whole corpus precisely because
they are the approved copy bank. **Do not quote them verbatim:**

- `archcanvas-growth/strategy/positioning.md` — the **positioning statement**:
  *"ArchCanvas is an AI architect that turns a plain-language brief into…"*
- `archcanvas-growth/marketing/copy/messaging-library.md` — **approved tagline #7**
  (*"An AI architect that designs one plan — and gets it right with you."*), **all three
  product boilerplates** (25 / 50 / 100 words), and **both founder bios** (50 / 100 words).
- `archcanvas-growth/strategy/category.md` §6 — the clearance table's own row
  *"An AI architect" (in boilerplate)*, still marked **Clear** on a B5 check alone. That
  verdict predates the 2026-09-01 audit and is now wrong; the row needs re-deciding in the
  growth repo. This film does not rely on it.

Where any of those lines is otherwise useful, the fix is the same one word:
**`AI architectural designer`**, which the product has already shipped on `/about`,
`/features`, `/showcase`, the landing page and the dashboard.

---

## Banned words

Mechanically rejected, case-insensitive, with a hand-built boundary (`(^|[^a-z0-9-])…([^a-z0-9-]|$)`)
because the list contains hyphens and spaces and `\b` will not do. The union of the first
film's list and every word in `voice.md`:

`revolutionary` · `game-changing` · `game changer` · `game-changer` · `insane` · `crazy` ·
`mind-blowing` · `magic` · `magical` · `seamless` · `seamlessly` · `effortless` ·
`unleash` · `supercharge` · `next-level` · `cutting-edge` · `world-class` · `disrupt` ·
`disruptive` · `10x` · `paradigm` · `best-in-class` · `state-of-the-art`

Plus the vague-quality class, which `voice.md` bans by the rule *"replace the adjective
with the evidence"*: `powerful` · `robust` · `blazing fast` · `high quality` · `benchmark`

## Banned phrases

Rejected as case-insensitive substrings:

`as code` · `as a dsl` · `checked before you see it` · `before you see it` ·
`nothing ships` · `every door measured` · `every route walked` · `every clearance` ·
`build from` · `buildable` · `build-ready` · `permit-ready` · `permit ready` ·
`code-compliant` · `code compliant` · `architect in your pocket` ·
`replaces your architect` · `no architect needed` · `first and only` · `the only tool` ·
`missing primitive` · `no checkable text substrate` · `we export cad` ·
`structured geometry` · `250 visitors` · `100% activation` · `4 plans in 45`

## Banned patterns

Regexes, because a substring will not do. The first five are lifted from the product
repo's own tripwire file, `archcanvas/tests/marketingNoCode.test.ts`:

- `/\bAI architect(?!ural)/i` — **B15.** The lookahead is what lets the approved
  substitute through while still catching the bare protected title.
- `/\bevery clearance\b/i` — **B11.** Clear widths are estimated, never measured.
- `/\bclearances? (is |are )?measured\b/i` — **B11.**
- `/\broutes? (is |are )?walked\b/i` — **B11.** Circulation is coarse, and `null` outright
  on a plan with no modeled exterior entrance, so nothing is walked on precisely the
  broken plans.
- `/\bas code\b/i` and `/\b(ArchLang|\.arch|DSL)\b/i` — **B4.** ArchLang is not named in
  this film.
- `/\b(door|wall|clearance|route|width|distance)s?\s+(is\s+|are\s+)?measured\b/i` — **B11**,
  broadened past the three shipped needles.
- `/\bblocks?\s+(a|any|the)\s+(defective|broken|bad|unsound)\s+plan/i` — **B12.**
- `/\$\s*[\d,]/` — the bare-dollar-price rule.
- `/[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/` —
  English only.
