import React, { useEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

/**
 * Inline SVG loading, for the two drawings the film animates INSIDE.
 *
 * `<img src={...svg}>` renders a drawing as one opaque picture. This film has
 * to reach into the artwork — the plan's eight CAD layers arrive in draw
 * order, the dimension strings draw themselves on, the room labels fade up
 * one at a time — so the markup has to be in the document, where CSS can
 * address it.
 *
 * ── Why the parse is a parse and not a regex ──────────────────────────────
 *
 * Three things have to happen to a staged drawing before it can be animated,
 * and every one of them is a DOM operation:
 *
 * 1. **Every top-level `<g>` gets a `data-layer`.** Seven of the eight groups
 *    in `plan-family-house-annotated.svg` are named (`A-FLOR`, `A-FURN`,
 *    `A-WALL`, `A-DOOR`, `A-GLAZ`, `A-ANNO-TEXT`, `A-ANNO-DIMS`; `plan-hero`
 *    adds `A-ANNO`), but the north arrow, the scale bar and the title block
 *    are three ANONYMOUS groups at the end. They are part of the sheet and
 *    have to arrive with it, so they are numbered rather than skipped.
 *
 * 2. **Every `id` is prefixed.** Both drawings define a hatch pattern called
 *    `poche`, at different pitches (163.8 for the family house, 60 for the
 *    hero), and both are on screen at once for part of the film. Duplicate
 *    ids in one document mean `url(#poche)` silently resolves to whichever
 *    came first in the DOM — so the hero's walls would be hatched at the
 *    family house's pitch. Prefixing by file basename fixes it once, in the
 *    cache, for every instance.
 *
 * 3. **The artwork's own background rect is lifted out.** Each drawing paints
 *    a white rectangle over its whole viewBox. A component wants that colour
 *    (it is the drawing's paper, not a colour this film chose) but usually
 *    not that rectangle, because the sheet it sits on is a different size.
 *    It is returned as `paper` and removed from the markup.
 *
 * ── Loading, and the delayRender it needs ─────────────────────────────────
 *
 * `delayRender` is taken during the first render, not inside the effect, so a
 * `remotion still` cannot capture the frame before the fetch resolves. The
 * parse is cached per URL as a PROMISE, so the three `plan-hero` instances on
 * the lineage trail share one fetch and one parse.
 */

export type InlineSvg = {
  /** The artwork's own viewBox, verbatim. */
  viewBox: string;
  /** viewBox width and height, for aspect maths. */
  vbWidth: number;
  vbHeight: number;
  /** Markup for the inside of an `<svg>`, with `data-layer` on every group. */
  inner: string;
  /** Layer names in DRAW order — that is the order they must arrive in. */
  layers: readonly string[];
  /** The fill of the background rect the artwork painted, if it painted one. */
  paper: string | null;
};

const cache = new Map<string, Promise<InlineSvg>>();

/** `plans/plan-hero.svg?v=1` -> `plan-hero`. Used as the id prefix. */
const basenameOf = (url: string): string => {
  const last = url.split("?")[0].split("#")[0].split("/").pop() ?? "svg";
  return last.replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-");
};

const parseSvg = (text: string, prefix: string): InlineSvg => {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName === "parsererror" || root.nodeName.toLowerCase() !== "svg") {
    throw new Error(`not an SVG document`);
  }

  const viewBox = root.getAttribute("viewBox") ?? "0 0 100 100";
  const [minX, minY, vbWidth, vbHeight] = viewBox.trim().split(/[\s,]+/).map(Number);

  // 2. every id namespaced by file, so two drawings cannot share a pattern.
  for (const el of Array.from(doc.querySelectorAll("[id]"))) {
    const old = el.getAttribute("id");
    if (old) el.setAttribute("id", `${prefix}-${old}`);
  }

  // 3. lift the artwork's own paper out of the markup.
  let paper: string | null = null;
  for (const el of Array.from(root.children)) {
    if (el.tagName.toLowerCase() !== "rect") continue;
    const covers =
      Math.abs(Number(el.getAttribute("x")) - minX) < 1 &&
      Math.abs(Number(el.getAttribute("y")) - minY) < 1 &&
      Math.abs(Number(el.getAttribute("width")) - vbWidth) < 1 &&
      Math.abs(Number(el.getAttribute("height")) - vbHeight) < 1;
    if (!covers) continue;
    paper = el.getAttribute("fill");
    el.remove();
    break;
  }

  // 1. name every top-level group, anonymous ones included.
  const layers: string[] = [];
  Array.from(root.children).forEach((el, i) => {
    if (el.tagName.toLowerCase() !== "g") return;
    const raw = el.getAttribute("id") ?? "";
    // The id was just prefixed; strip it back off so callers address the
    // layer by the name the drawing uses (`A-WALL`), not by `plan-hero-A-WALL`.
    const named = raw.startsWith(`${prefix}-`) ? raw.slice(prefix.length + 1) : raw;
    const name = named || `sheet-${i}`;
    el.setAttribute("data-layer", name);
    layers.push(name);
  });

  // 4. every stroke that does not already carry a dash pattern is normalised
  //    to unit length, so `stroke-dasharray: 1; stroke-dashoffset: 1 - p`
  //    draws ANY element on proportionally — a 300-unit dimension tick and a
  //    12,400-unit wall run finish together instead of the tick popping in the
  //    first two per cent of the animation. Elements that dash themselves
  //    (the door swings, the openings) are skipped: `pathLength` would rescale
  //    their own pattern and redraw the product's output.
  for (const el of Array.from(root.querySelectorAll("*"))) {
    const stroke = el.getAttribute("stroke");
    if (!stroke || stroke === "none") continue;
    if (el.hasAttribute("stroke-dasharray")) continue;
    el.setAttribute("pathLength", "1");
  }

  // `url(#poche)` has to follow the id rename, and it lives in a fill/stroke
  // attribute rather than in a node, so this last pass is textual.
  const serialised = new XMLSerializer().serializeToString(root);
  const openTag = serialised.indexOf(">");
  const closeTag = serialised.lastIndexOf("</");
  const body = serialised.slice(openTag + 1, closeTag);
  const inner = body.replace(/url\(\s*#([^)\s]+)\s*\)/g, (_m, id: string) =>
    id.startsWith(`${prefix}-`) ? `url(#${id})` : `url(#${prefix}-${id})`
  );

  return { viewBox, vbWidth, vbHeight, inner, layers, paper };
};

const loadSvg = (url: string): Promise<InlineSvg> => {
  const hit = cache.get(url);
  if (hit) return hit;
  const p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then((text) => parseSvg(text, basenameOf(url)));
  cache.set(url, p);
  return p;
};

/**
 * Fetch + parse an SVG, holding the render until it lands.
 *
 * Returns null on the first render only. A component MUST handle that — draw
 * the sheet it sits on and nothing else — rather than returning null itself,
 * or the world object flickers out of existence for one frame in Studio.
 */
export const useInlineSvg = (url: string): InlineSvg | null => {
  const [doc, setDoc] = useState<InlineSvg | null>(null);
  const [handle] = useState(() => delayRender(`inline svg: ${url}`));

  useEffect(() => {
    let live = true;
    loadSvg(url)
      .then((parsed) => {
        if (live) setDoc(parsed);
        continueRender(handle);
      })
      .catch((err: unknown) => {
        // ONE line: Remotion prints only the first line of a cancelRender.
        cancelRender(
          new Error(
            `could not inline ${url}: ${err instanceof Error ? err.message : String(err)} — every drawing this film animates inside must be a ledger row staged under public/; run \`npm run sync:assets\``
          )
        );
      });
    return () => {
      live = false;
    };
  }, [url, handle]);

  return doc;
};

/**
 * The `<svg>` element itself, sized in WORLD units and fitted to a box.
 *
 * `preserveAspectRatio` is left at its default `xMidYMid meet`: the drawings
 * carry a negative viewBox origin (`-2569.6 -2569.6 …` for the family house),
 * so the artwork's own 0,0 is inset from the corner and any attempt to place
 * it with a transform of one's own gets the offset wrong. Handing the whole
 * viewBox to the browser is both simpler and correct.
 */
export const InlineSvgLayer: React.FC<{
  doc: InlineSvg;
  width: number;
  height: number;
  /** Scopes the generated CSS. Use the world object's id. */
  scope: string;
  /** Rules addressing `[data-layer="…"]`, regenerated every frame. */
  css: string;
  style?: React.CSSProperties;
}> = ({ doc, width, height, scope, css, style }) => {
  // Every rule is re-emitted under `[data-svg-scope="<id>"]`. Two world
  // objects share one drawing — `planSheet` and `dimStrings` are the same
  // sheet, drawn twice — so an unscoped `[data-layer="A-WALL"]` rule written
  // by one of them would reach into the other's copy.
  const scoped = useMemo(
    () =>
      css
        .split("}")
        .map((part) => {
          const brace = part.indexOf("{");
          if (brace < 0) return "";
          const sel = part.slice(0, brace).trim();
          const body = part.slice(brace + 1).trim();
          if (!sel || !body) return "";
          const prefixed = sel
            .split(",")
            .map((s) => `[data-svg-scope="${scope}"] ${s.trim()}`)
            .join(", ");
          return `${prefixed} { ${body} }`;
        })
        .filter(Boolean)
        .join("\n"),
    [css, scope]
  );

  return (
    <>
      <style>{scoped}</style>
      <svg
        data-svg-scope={scope}
        viewBox={doc.viewBox}
        width={width}
        height={height}
        style={{ display: "block", ...style }}
        dangerouslySetInnerHTML={{ __html: doc.inner }}
      />
    </>
  );
};

/**
 * How wide a `contain`-fitted drawing actually comes out inside a box.
 *
 * Components need this to centre a sheet's paper on the drawing rather than
 * on the box, which is not the same rectangle when the sheet is A-series and
 * the drawing is nearly square.
 */
export const fitInside = (
  doc: InlineSvg,
  boxW: number,
  boxH: number
): { w: number; h: number } => {
  const s = Math.min(boxW / doc.vbWidth, boxH / doc.vbHeight);
  return { w: doc.vbWidth * s, h: doc.vbHeight * s };
};
