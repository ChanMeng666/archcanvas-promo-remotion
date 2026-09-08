import React, { useEffect, useRef } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

import { FONT } from "../fonts";
import { useLayout } from "../layout";

/**
 * A box that clips, and — this is the point — FAILS THE RENDER when its
 * content does not fit.
 *
 * Ported from `chan-meng-promo-video`, where the safe box clipped silently:
 * the right layout law with the wrong failure mode. The first dense frame that
 * film rendered lost the top of a headline and the bottom of three cards, and
 * both looked deliberate. Overflow is now a failed render with the numbers in
 * the message.
 *
 * ── Measured only after `document.fonts.ready`, and that is the whole trick ──
 *
 * An effect runs before the webfonts have been applied, so text is still laid
 * out in fallback metrics — and the fallback can be SHORTER than the real
 * face. That guard once reported a comfortable fit on a frame overflowing by
 * 507px: it measured, the fonts swapped in, the column grew by hundreds of
 * pixels, and the frame was captured clipped. Chasing individual flex children
 * never converged, because none of those was this bug.
 *
 * **Any layout assertion in this repo must wait on `document.fonts.ready`.**
 *
 * ── World-space use ────────────────────────────────────────────────────────
 *
 * In this film most content lives inside the camera transform, so pass the
 * object's WORLD width and height and the guard measures against those. CSS
 * `offsetHeight` is pre-transform, so a world-space measurement is exact and
 * independent of where the camera happens to be. With no width/height it falls
 * back to the screen-space safe box, which is what a full-frame overlay wants.
 */
export const Stage: React.FC<{
  children: React.ReactNode;
  /** World (or screen) width to clip to. Defaults to the safe box. */
  width?: number;
  /** World (or screen) height to clip to. Defaults to the safe box. */
  height?: number;
  align?: "center" | "top";
  /** Named in the failure message, so you know WHICH box overflowed. */
  label?: string;
  style?: React.CSSProperties;
}> = ({ children, width, height, align = "center", label = "stage", style }) => {
  const layout = useLayout();
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  const boxW = width ?? layout.width - layout.safe.side * 2;
  const boxH = height ?? layout.height - layout.safe.top - layout.safe.bottom;

  useEffect(() => {
    const el = box.current;
    const inner = content.current;
    if (!el || !inner) return;

    const handle = delayRender(`Stage overflow check: ${label} (waiting for fonts)`);
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };

    document.fonts.ready.then(() => {
      if (done) return;
      measure(el, inner, label, finish);
    });

    return finish;
  });

  return (
    <>
      {/**
       * Nothing inside a Stage may shrink.
       *
       * Flex items shrink by default, and in a film that is always wrong: a
       * column that does not fit should FAIL, not quietly compress its gaps
       * until the numbers say it fits while the frame clips its top off. Text
       * still wraps — that is not flex shrinking — and `flex: 1` still shares
       * width in a row, because grow and basis are untouched.
       */}
      <style>{`[data-stage] * { flex-shrink: 0; }`}</style>
      <div
        ref={box}
        data-stage={label}
        style={{
          position: "relative",
          width: boxW,
          height: boxH,
          // The law, in one line.
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: align === "center" ? "center" : "flex-start",
          fontFamily: FONT.sans,
          ...style,
        }}
      >
        {/* A content wrapper, purely so overflow is measurable. `flex: none`
            stops it being squashed to the box height, which would make the
            check trivially always pass. */}
        <div
          ref={content}
          style={{
            flex: "none",
            display: "flex",
            flexDirection: "column",
            minHeight: "min-content",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

/**
 * Measured off a content wrapper, not the box's `scrollHeight` — in a
 * centre-justified flex column the top overflow is unreachable, so
 * `scrollHeight` only ever sees what spills past the bottom.
 *
 * 2px of tolerance: sub-pixel line-height rounding reports one or two, and
 * anything more than that is a visibly clipped descender.
 */
function measure(
  el: HTMLDivElement,
  inner: HTMLDivElement,
  label: string,
  finish: () => void
) {
  const overY = inner.offsetHeight - el.clientHeight;
  const overX = inner.offsetWidth - el.clientWidth;
  if (overY <= 2 && overX <= 2) {
    finish();
    return;
  }
  cancelRender(
    new Error(
      // ONE line. Remotion shows only the first line of a cancelRender message
      // in the CLI headline, so a diagnostic that wraps is a diagnostic you
      // will not read. Naming the tallest child turns "it doesn't fit" into
      // "THIS doesn't fit", which is the difference between a guess and a fix.
      `Stage "${label}" overflows by ${Math.max(overY, 0)}px vertically, ${Math.max(overX, 0)}px horizontally (box ${el.clientWidth}x${el.clientHeight}, content ${inner.offsetWidth}x${inner.offsetHeight}) — the frame would render silently clipped; use a smaller type role, cut content, or split the beat. Tallest children: ` +
        Array.from(inner.children)
          .map((c, i) => ({
            i,
            h: (c as HTMLElement).offsetHeight,
            text: (c.textContent ?? "").trim().slice(0, 24) || "(no text)",
          }))
          .sort((a, b) => b.h - a.h)
          .slice(0, 4)
          .map((c) => `[${c.i}] ${c.h}px "${c.text}"`)
          .join(" - ")
    )
  );
}
