import React from "react";
import { Composition } from "remotion";

import { Film } from "./Film";
import { DELIVERABLES } from "./layout";
import { FPS, totalFrames } from "./timeline";

/**
 * Four sizes, one edit. Short edge 1080 in all four.
 *
 * ── There is no `calculateMetadata`, and that is deliberate ────────────────
 *
 * `calculateMetadata` runs in Studio AND in every render worker. `gavigo-ire-
 * video` probed audio durations over HTTP inside one, wrapped in a catch-block
 * that returned a default on failure — so a 404 shipped the whole film at
 * placeholder length and nobody noticed until the master was cut. The clock is
 * measured once by `scripts/measure-vo.mjs`, committed to `src/data/vo.json`,
 * and read synchronously by `timeline.ts`. `durationInFrames` below is that
 * derivation and nothing else.
 *
 * All four compositions read the SAME `totalFrames`. `verify-timeline.mjs`
 * checks that: four formats that disagree on length is how a vertical cut ends
 * up a second short of its voiceover.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {DELIVERABLES.map((d) => (
      <Composition
        key={d.id}
        id={d.id}
        component={Film}
        durationInFrames={totalFrames}
        fps={FPS}
        width={d.width}
        height={d.height}
      />
    ))}
  </>
);
