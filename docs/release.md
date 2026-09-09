# Release — shipping the masters

Four masters, and **none of them is committed**. The landscape master measures 27.1 MB;
the other three are the same 75s at the same codec and settings, so expect the same order.
Git keeps every version of a binary forever, and four formats times a few review renders
is a permanent gigabyte in a repo people clone to read a few thousand lines of
TypeScript. They ship as **GitHub Release assets** on
`ChanMeng666/archcanvas-promo-remotion` (private), which is what `.gitignore`'s `out/*`
rule is for.

`gh` is installed and authenticated as `ChanMeng666`. **Nothing here creates a release on
its own — the founder decides when it ships.**

---

## 1. Gates, in order

```bash
npm run lint                 # tsc
npm run verify:strict        # assets -> timeline -> copy (strict) -> numbers
pwsh -File ./render.ps1      # all four
```

Then the flash gate on **every** format, not just the landscape one — the four
compositions frame the world differently, so how much dark ground and how much bright
drawing is in shot differs, and a whole-frame luminance measure taken on one is not
evidence about the others:

```powershell
Get-ChildItem out/archcanvas-zoom-out-2026-09_*.mp4 |
  Where-Object { $_.Name -notlike "*_proof*" } |
  ForEach-Object { node capture/check-flash.mjs $_.FullName; if ($LASTEXITCODE -ne 0) { break } }
```

It exits non-zero on a failing second. It is a **screening test against WCAG SC 2.3.1**,
not a certification and not PEAT; its own output says so, and the release notes should not
claim more than it measured.

Measured on 2026-09-09, all formats, 2190 frames each (73.00s at 30fps). Every one
passes with **zero** transitions over the 10% threshold in the whole film:

| format | largest single frame-to-frame swing | at |
|---|---|---|
| landscape 1920x1080 | **5.2%** | 36.30s |
| portrait 1080x1350 | **2.4%** | 36.33s |
| vertical 1080x1920 | **1.6%** | 36.33s |
| square 1080x1080 | **3.1%** | 36.30s |

**That spread is the reason this is run per format rather than once.** It is the same
film at the same frame, and the measure differs threefold — the tall frames simply hold
more dark ground and less bright drawing. A whole-frame luminance number taken on one
composition is not evidence about another.

## 2. Check what is actually on disk

The four filenames come from `render.ps1` and are the shipped names:

```
archcanvas-zoom-out-2026-09_landscape_1920x1080.mp4    YouTube / LinkedIn / the website
archcanvas-zoom-out-2026-09_vertical_1080x1920.mp4     Reels / Stories / TikTok / Shorts
archcanvas-zoom-out-2026-09_portrait_1080x1350.mp4     Instagram + Facebook feed
archcanvas-zoom-out-2026-09_square_1080x1080.mp4       LinkedIn + Instagram feed
```

```bash
ls -l out/*.mp4
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of csv=p=0 out/<file>.mp4
```

Anything named `*_proof*.mp4` is a `-Scale` proof render, not a master. Do not upload one.

## 3. Tag

The tag is the provenance anchor: it is what says *which commit these bytes came out of*.
Tag the commit the masters were rendered from, not whatever `main` has drifted to.

```bash
git tag -a zoom-out-2026-09 -m "«Zoom Out» — 75s, four formats"
git push origin zoom-out-2026-09
```

## 4. Create the release, draft first

Draft first, always. A published release on a private repo is still a link that can be
shared by anyone with repo access, and a draft can be deleted without leaving a tag-shaped
hole.

```bash
gh release create zoom-out-2026-09 \
  --repo ChanMeng666/archcanvas-promo-remotion \
  --title "«Zoom Out» — 2026-09" \
  --notes-file docs/release-notes.md \
  --draft \
  out/archcanvas-zoom-out-2026-09_landscape_1920x1080.mp4 \
  out/archcanvas-zoom-out-2026-09_vertical_1080x1920.mp4 \
  out/archcanvas-zoom-out-2026-09_portrait_1080x1350.mp4 \
  out/archcanvas-zoom-out-2026-09_square_1080x1080.mp4
```

Review it in the browser, then publish:

```bash
gh release view zoom-out-2026-09 --repo ChanMeng666/archcanvas-promo-remotion --web
gh release edit zoom-out-2026-09 --repo ChanMeng666/archcanvas-promo-remotion --draft=false
```

Re-uploading one format later (`--clobber` replaces an asset of the same name):

```bash
gh release upload zoom-out-2026-09 out/<file>.mp4 --clobber \
  --repo ChanMeng666/archcanvas-promo-remotion
```

**The repo is private, so the asset URLs are private too** — they need a GitHub login with
access. Handing the film to someone outside means sending them the file, or putting it
somewhere public on purpose. The release is the archive, not the distribution channel.

## 5. What to write in the notes

Short. What the film is, what changed since the last cut, and the provenance that would be
expensive to reconstruct later. A template:

```markdown
75s, silent, four formats. One continuous camera move across one canvas, told backwards,
on a ground that washes from graphite to ivory. English, carried by text in world space
and one music bed.

Rendered from <short sha> · h264, crf 18, yuv420p, 30 fps.

**Music.** The bed is cut from the founder's own SUNO take
`audio/source/confident-arrival.mp3` (134.97s) at window **37.897s**, 75.000s long, so the
track's biggest energy jump lands on the camera's reversal. Both vendors were confirmed on
**paid commercial tiers on 2026-09-08**.

**Copy.** Every phrase on screen has a clearance row in `docs/copy-clearance.md`
(`npm run verify:copy:strict`). Nothing on screen is mocked up: every drawing, rendering
and number came out of the real product, ledgered in `src/data/assets.json`.

**Flash.** Screened against WCAG SC 2.3.1 with `capture/check-flash.mjs`: no second
exceeds three flashes, largest frame-to-frame luminance swing 5.2%. A screening test, not
a certification.
```

The music line is the one that matters and the one nobody will be able to reconstruct in
six months. `37.897s` is not a round number because it was not chosen by ear — it is the
window that puts the take's biggest energy jump on the reversal, and losing it means
re-deriving it with `tools/analyze-music.mjs`.

## 6. Do not

- Do not `git add out/`. If a master ever gets committed, it is in the history forever.
- Do not upload a `-Scale` proof render.
- Do not publish before every format has been through the flash gate.
- Do not describe the flash gate as certification, PEAT, or an accessibility guarantee.
