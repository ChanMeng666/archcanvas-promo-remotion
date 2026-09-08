import { Img, staticFile } from "remotion";

import script from "../data/script.json";
import { TYPE, WEIGHT } from "../tokens";
import { Reveal, Sans, type WorldObjectComponent } from "./primitives";

/**
 * The mark, and the terms.
 *
 * ── The permit line is not optional and not paraphrasable ─────────────────
 *
 * `A concept plan to take to a professional — not a permit set.` is the
 * product's own disclaimer, carried verbatim on every marketing page
 * (`archcanvas/src/components/layout/marketing-footer.tsx:67`). B3 forbids any
 * permit or buildability overclaim, and the strongest way to clear a ban is to
 * discharge it rather than merely avoid it — so the film's last frame says the
 * limit out loud. It is broken across two authored lines for the 1080-wide
 * master and both halves are separately registered in docs/copy-clearance.md.
 *
 * ── No price ──────────────────────────────────────────────────────────────
 *
 * `Pay only when you get a plan worth keeping.` is the pricing message and the
 * only one. No dollar figure appears anywhere in this film: prices display in
 * USD on a .uk domain, which is DMCCA drip-pricing exposure, and no traction
 * number may appear either (B13). If you are tempted to add "$10", don't.
 *
 * The camera has stopped by now — `world.ts` gives this station zero drift on
 * purpose. A film that has been moving for seventy seconds should come to a
 * full stop, not drift to a halt.
 */

type Card = { id: string; lines: string[] };

const LINES = (script.cards as Card[]).find((c) => c.id === "mark")?.lines ?? null;

export const EndCard: WorldObjectComponent = ({
  width,
  height,
  localFrame,
  palette,
}) => {
  if (!LINES) {
    throw new Error('EndCard: no cards[] row "mark" in src/data/script.json');
  }

  // The last line is the domain and is set apart; the two before it are the
  // permit disclaimer; the rest is the offer.
  const url = LINES[LINES.length - 1];
  const body = LINES.slice(0, -1);

  const size = Math.min(height / 9, width / 34);
  const markW = Math.min(width * 0.42, height * 1.6);

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: size * 0.9,
      }}
    >
      <Reveal frame={localFrame} delay={0} mask={false} distance={size * 0.6}>
        <Img
          src={staticFile("brand/archcanvas-wordmark.svg")}
          style={{ width: markW, height: "auto", display: "block" }}
        />
      </Reveal>

      <div style={{ display: "flex", flexDirection: "column", gap: size * 0.3 }}>
        {body.map((line, i) => (
          <Reveal
            key={line}
            frame={localFrame}
            delay={10 + i * 4}
            mask={false}
            distance={size * 0.4}
          >
            <Sans
              size={size}
              tone={i === 0 ? palette.ink : palette.inkMuted}
              weight={i === 0 ? WEIGHT.medium : WEIGHT.regular}
            >
              {line}
            </Sans>
          </Reveal>
        ))}
      </div>

      <Reveal frame={localFrame} delay={10 + body.length * 4 + 4} mask={false} distance={size * 0.4}>
        <Sans size={size * 1.25} tone={palette.spot} weight={WEIGHT.medium}>
          {url}
        </Sans>
      </Reveal>
    </div>
  );
};

export const END_MAX = TYPE.caption;
