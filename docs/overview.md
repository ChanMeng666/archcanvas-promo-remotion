# ArchCanvas «Zoom Out»

A silent [Remotion](https://remotion.dev) film for [ArchCanvas](https://archcanvas.uk): one continuous zoom across the infinite canvas, told backwards. Four aspect ratios out of one edit. English, carried by text in world space and one music bed.

This is deliberately the **second** film. The first lives in [`archcanvas-promo-video`](https://github.com/ChanMeng666/archcanvas-promo-video) (HyperFrames, 92s, centred text cards, chronological demo). Do not port it.

| | |
|---|---|
| Landscape | 1920 × 1080 · YouTube / LinkedIn / the website |
| Vertical | 1080 × 1920 · Reels / Stories / TikTok / Shorts |
| Portrait | 1080 × 1350 · Instagram + Facebook feed |
| Square | 1080 × 1080 · LinkedIn + Instagram feed |
| Clock | 30 fps · ~75s (2190 frames after the end-card trim) |

Rendered masters are **GitHub Release assets**, not repository files. `.gitignore` keeps `out/*.mp4` out on purpose.

---

## If you are an agent

Read **[`CLAUDE.md`](../CLAUDE.md) first.** It is the operating manual: three laws, copy bans, the station/camera model, and a "Traps already paid for" list where every entry is a defect this project actually shipped or nearly shipped.

Then: `docs/decisions.md` (what was deliberately not repeated) → `docs/copy-clearance.md` (every on-screen phrase) → `src/stations.ts` (intent, in seconds).

---

## The three laws

1. **Every word on screen is cleared, or it does not ship.** `capture/verify-copy.mjs` fails a phrase with no row in `docs/copy-clearance.md`.
2. **Nothing on screen is mocked up.** Drawings, renderings and numbers came out of the live product. `src/data/assets.json` is the ledger; `capture/verify-numbers.mjs` enforces it.
3. **The timeline is derived, never typed.** Intent lives in seconds in `src/stations.ts`. `src/timeline.ts` is the only file that does frame arithmetic.

---

## Commands

```bash
npm install
npm run dev                 # Remotion Studio
npm run lint                # tsc
npm run verify:strict       # assets → timeline → copy (strict) → numbers
pwsh -File ./render.ps1     # all four masters into out/
```

Flash screening (WCAG SC 2.3.1, not a certification) is per-format — the four compositions frame the world differently. See `docs/release.md` for the ship checklist, tag, and Release upload.

Requires Node 22+.

## Licence

Code is MIT ([`LICENSE`](../LICENSE)); films, music and other media made by Chan Meng are CC BY 4.0
([`LICENSE-MEDIA.md`](../LICENSE-MEDIA.md)). The ArchCanvas name, logo and brand assets are not licensed for reuse.
