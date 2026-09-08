import { useMemo } from "react";

import script from "../data/script.json";
import { INK, WEIGHT } from "../tokens";
import { Reveal, Sans, type WorldObjectComponent } from "./primitives";
import { worldObject } from "../world";
import type { WorldObjectId } from "../world";

/**
 * The film's words, living in the world.
 *
 * There is no voiceover — there was one for about four hours on 2026-09-08 and
 * it was deleted over licensing (docs/decisions.md D11) — so these lines carry
 * the argument. They are drawn INSIDE the world layer, which means they scale
 * and parallax with the drawing they sit beside, the way an annotation does,
 * rather than floating over it like a subtitle. That is the whole reason the
 * film reads as one continuous space instead of a slideshow with captions.
 *
 * Two consequences worth stating, because both are easy to undo by accident:
 *
 * 1. **The type is sized in WORLD units, from the box, not in screen pixels.**
 *    A card whose rect is a fraction of its station's frame (see `cardIn` in
 *    world.ts) therefore renders at the same apparent size in all four aspect
 *    ratios, without any per-format branching here. Hard-code a pixel size and
 *    that stops being true the moment the camera moves.
 *
 * 3. **A card takes its ink from what it is drawn ON, declared in world.ts.** A card
 *    is placed in world space, so it can land on the dark ground at one station
 *    and on a white drawing sheet at the next — while its ink is chosen from
 *    the ground ramp, which knows nothing about what happens to be underneath.
 *    The `drawing` station proved it: pale ink, chosen correctly for a graphite
 *    ground, rendered white-on-white over the sheet and the line simply was not
 *    there. The plate makes legibility a property of the card rather than a
 *    coincidence of where the camera stopped. A plate behind the text would
 *    also have solved it, and was tried — it looked like a subtitle box sitting
 *    on a drawing, which is precisely the thing this film is not. Declaring the
 *    backing instead lets a card on the sheet use the drawing's own dark ink
 *    and no plate at all, so it reads as something written on the paper.
 *
 * 2. **Lines are authored in script.json and rendered `nowrap`.** A bad break
 *    must surface as an overflow, not reflow silently into something nobody
 *    chose. `Sans` already sets `nowrap`; do not switch it off to make a long
 *    line fit — shorten the line in `script.json` and re-register it.
 */

type Card = { id: string; lines: string[] };

const CARDS: Card[] = script.cards as Card[];

/** Which card each card-object draws. Exhaustive by construction below. */
const CARD_FOR: Partial<Record<WorldObjectId, string>> = {
  cardInterior: "interior",
  cardPair: "pair",
  cardDrawing: "drawing",
  cardFacts: "facts",
  cardLineage: "lineage",
};

export const StationCard: WorldObjectComponent = ({
  id,
  width,
  height,
  localFrame,
  palette,
}) => {
  const cardId = CARD_FOR[id];

  const lines = useMemo(() => {
    if (!cardId) return null;
    const found = CARDS.find((c) => c.id === cardId);
    return found ? found.lines : null;
  }, [cardId]);

  // Not a silent empty render: a card object with no row in script.json is a
  // wiring mistake, and the film would simply show nothing there — the same
  // soft failure as a missing staticFile(). Fail loudly in the one place that
  // can see it.
  if (!lines || lines.length === 0) {
    throw new Error(
      `StationCard "${id}" has no lines: add a cards[] row to src/data/script.json (and a backticked clearance row) or remove the object from world.ts`,
    );
  }

  // Sized off the box's short edge so the card reads the same at every aspect
  // ratio. The divisor is the number of lines the tallest card carries plus
  // leading, not a magic number: three lines at 1.32 leading plus a little air.
  const size = Math.min(height / (lines.length * 1.5), width / 18);

  // Declared in world.ts, never guessed. See the `surface` field there.
  const surface = worldObject(id).surface ?? "ground";
  const tone =
    surface === "sheet" ? INK.day : surface === "photo" ? "#FFFFFF" : palette.ink;
  const toneMuted =
    surface === "sheet" ? INK.dayMuted : surface === "photo" ? "rgba(255,255,255,0.86)" : palette.inkMuted;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: size * 0.24,
        }}
      >
        {lines.map((line, i) => (
          <Reveal
          key={line}
          frame={localFrame}
          // Laddered, not simultaneous. The camera is still settling when the
          // first line lands, so the second arriving a beat later reads as the
          // sentence completing rather than as a block appearing.
          delay={6 + i * 5}
          mask={false}
          distance={size * 0.5}
        >
          <Sans
            size={size}
            tone={i === 0 ? tone : toneMuted}
            weight={i === 0 ? WEIGHT.medium : WEIGHT.regular}
          >
            {line}
          </Sans>
        </Reveal>
        ))}
      </div>
    </div>
  );
};
