import script from "../data/script.json";
import { TYPE, RADIUS, STROKE, WEIGHT, SPACE } from "../tokens";
import { Mono, Sans, type WorldObjectComponent } from "./primitives";

/**
 * The film's honesty beat — and the only thing on screen the film did not write.
 *
 * ── Read this before changing a character ─────────────────────────────────
 *
 * The text is the PRODUCT'S OWN, transcribed from
 * `c06-review-pins.mp4` (t=20.0s, re-read at 26.0s and 36.0s) and confirmed
 * against the 1828x1016 still cut from the raw take at t=286s. It lives in
 * `script.json` under `quotes`, not `cards`, because it is a quotation rather
 * than copy we authored. Transcribe, never rewrite.
 *
 * It belongs to ONE drawing: the filmed session's own 4-room, 108.00 m2 state.
 * It is FALSE of both staged plans — `plan-family-house.svg` has a Bath *and* a
 * Laundry, `plan-hero.svg` has a Bathroom — so hanging it beside either would
 * put a visible falsehood on screen at the exact moment the film makes its one
 * honesty claim. `capture/verify-numbers.mjs` fails the build on it, and
 * `verify-timeline.mjs` separately asserts the pin's rect never overlaps the
 * showcase sheet. Both gates exist because the mistake is so easy to make.
 *
 * ── Why it is typeset rather than a crop ──────────────────────────────────
 *
 * The pin card occupies roughly 555x240 of the source frame. The camera's
 * framing here wants it about 1500 world units wide, which is a ~2.7x upscale —
 * far past the 1.5x ceiling in `world.ts`, and this is the one beat in the film
 * where the text MUST be readable in passing. An unreadable receipt is not a
 * receipt. So the words are set in type, matched to the product's own pin, and
 * `reviewPin` registers no raster.
 *
 * ── Why it has no entrance ────────────────────────────────────────────────
 *
 * There is no reveal, no highlight, no pulse. The camera crosses this object
 * and does not stop; you read it in passing or you don't. Announcing it would
 * make the film's own candour into a claim the film is making about itself,
 * which is the thing docs/decisions.md D1 exists to prevent. Do not add motion.
 */

type Quote = {
  id: string;
  category: string;
  body: string;
  actions: string[];
  counter: string;
};

const PIN = (script.quotes as Quote[]).find((q) => q.id === "reviewPin");

export const ReviewPin: WorldObjectComponent = ({ width, height, palette }) => {
  if (!PIN) {
    throw new Error(
      'ReviewPin: no quotes[] row "reviewPin" in src/data/script.json — the pin is a transcription and must not be inlined here',
    );
  }

  const pad = Math.round(Math.min(width, height) * 0.07);
  const body = Math.round(height * 0.155);

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "flex-start",
        gap: pad,
      }}
    >
      {/* The counter, as the product draws it: a small flag chip. */}
      <div
        style={{
          flex: "none",
          width: body * 1.5,
          height: body * 1.5,
          borderRadius: 999,
          background: palette.spot,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sans size={body * 0.72} tone="#ffffff" weight={WEIGHT.medium}>
          {PIN.counter}
        </Sans>
      </div>

      <div
        style={{
          flex: "none",
          width: width - body * 1.5 - pad,
          background: palette.card,
          borderRadius: RADIUS.card,
          border: `${STROKE.hair}px solid ${palette.line}`,
          padding: pad,
          display: "flex",
          flexDirection: "column",
          gap: pad * 0.55,
        }}
      >
        <Mono size={TYPE.caption} tone={palette.inkMuted} caps>
          {PIN.category}
        </Mono>

        {/* Not `nowrap`: this is a quotation of a fixed length that must fit
            its card, and wrapping it is how the product itself sets it. */}
        <Sans size={body} tone={palette.ink} weight={WEIGHT.regular} nowrap={false}>
          {PIN.body}
        </Sans>

        <div style={{ display: "flex", gap: pad * 0.6, marginTop: SPACE.xs }}>
          {PIN.actions.map((action, i) => (
            <div
              key={action}
              style={{
                padding: `${pad * 0.34}px ${pad * 0.7}px`,
                borderRadius: 999,
                background: i === 0 ? `${palette.spot}22` : "transparent",
                border: i === 0 ? "none" : `${STROKE.hair}px solid ${palette.line}`,
              }}
            >
              <Sans
                size={body * 0.74}
                tone={i === 0 ? palette.spot : palette.inkMuted}
                weight={WEIGHT.medium}
              >
                {action}
              </Sans>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
