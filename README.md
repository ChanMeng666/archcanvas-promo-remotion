<div align="center">

# ArchCanvas «Zoom Out»

**A silent film for [ArchCanvas](https://archcanvas.uk), the AI architectural designer: one continuous zoom across the product's infinite canvas, told backwards, made in code with Remotion and cut into four aspect ratios from one edit.**

</div>

## The film

### ArchCanvas «Zoom Out»

<!-- FILM: archcanvas-zoom-out · 16:9 · 73 s — Chan uploads the video here in GitHub's web editor -->

▶ Watch on YouTube: https://youtu.be/KuCYju-jY0w

16:9, 9:16, 4:5 and 1:1. No voiceover: text set in the canvas and one music bed carry it.

## How it's made

- **One camera, one world.** Drawings, renderings and product clips are placed as objects in a single world space, and one camera move travels across them; `src/stations.ts` holds the intent in seconds and `src/timeline.ts` is the only file that does frame arithmetic.
- **Four formats from one edit.** Each composition frames the same world differently, so nothing is cropped.
- **Nothing on screen is mocked up.** Every drawing, rendering and number came out of the live product, and `src/data/assets.json` is the ledger of the exact bytes the film was cut from.
- **Every word on screen is cleared:** `capture/verify-copy.mjs` fails on a phrase with no row in `docs/copy-clearance.md`, and `npm run verify:flash` screens each master for flashes (WCAG 2.3.1).
- **Music:** one SUNO take made by Chan Meng, windowed and levelled with ffmpeg (`tools/`).

## Make your own

```bash
npm install                      # Node 22+
npm run sync:assets              # stage clips and artwork from ../archcanvas-promo-video
npm run dev                      # Remotion Studio
npm run verify:strict            # assets, timeline, copy, numbers
pwsh -File ./render.ps1          # all four masters into out/
```

The music take and the cut bed are committed. The staged pictures in `public/` are not: clone [archcanvas-promo-video](https://github.com/ChanMeng666/archcanvas-promo-video) beside this repo for `sync:assets`. A few clips are cut from raw OBS takes that are not in either repo (`npm run cut:clips`); bring your own footage to make a new film.

## Licence

- **Code:** MIT, see [`LICENSE`](LICENSE).
- **Films, music, images and other media made by Chan Meng:** CC BY 4.0, see [`LICENSE-MEDIA.md`](LICENSE-MEDIA.md).
- **Not covered:** the ArchCanvas name, logo and brand assets; the fonts (Space Grotesk and Geist Mono, under the SIL Open Font License); and the libraries, under their own licences (Remotion has its own licence).

More detail: [docs/overview.md](docs/overview.md)
