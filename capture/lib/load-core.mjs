// Bundle the film's React-free core and execute it in Node, so the gates test
// the real code.
//
// `stations.ts`, `timeline.ts`, `world.ts`, `tokens.ts`, `palette.ts` and
// `layout-core.ts` import no React and no Remotion for exactly this reason.
// The alternative — a gate that re-derives the timeline in its own JavaScript
// — eventually disagrees with the film, and a gate that disagrees with what it
// checks is worse than no gate: it goes green on a broken cut and red on a
// good one, and you learn to ignore it.
//
// Run it directly to print the derived timeline:
//     node capture/lib/load-core.mjs

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..");
export const SRC = path.join(ROOT, "src");

/** The modules the gates are allowed to reach. Each one must stay React-free. */
const ENTRY = `
export * as stations from "./stations";
export * as timeline from "./timeline";
export * as world from "./world";
export * as tokens from "./tokens";
export * as palette from "./palette";
export * as layout from "./layout-core";
`;

let cached = null;

/** Bundle + evaluate the core. Cached, so a gate can call it freely. */
export async function loadCore() {
  if (cached) return cached;

  const built = await esbuild.build({
    stdin: { contents: ENTRY, resolveDir: SRC, sourcefile: "core-entry.ts", loader: "ts" },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node22",
    // If any of these modules ever grows a React or Remotion import, the
    // bundle pulls in a DOM library and this blows up in Node. That failure is
    // the point: it is the tripwire on "the core stays React-free".
    external: ["react", "react-dom", "remotion"],
    logLevel: "silent",
  });

  const code = built.outputFiles[0].text;
  const url = "data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64");
  cached = await import(url);
  return cached;
}

/* ── run directly ─────────────────────────────────────────────────────────── */

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const core = await loadCore();
  const { timeline, layout, world } = core;

  console.log("\nDerived timeline (seconds are intent; frames are derived)\n");
  console.log(timeline.describe());

  console.log("\nCamera keyframes\n");
  console.log(
    "  " +
      ["frame".padStart(6), "station".padEnd(9), "kind".padEnd(6), "fit".padEnd(8), "ease".padEnd(7), "rect (cx, cy, w, h)"].join(
        " "
      )
  );
  for (const k of timeline.cameraKeyframes) {
    console.log(
      "  " +
        [
          String(k.frame).padStart(6),
          k.station.padEnd(9),
          k.kind.padEnd(6),
          k.fit.padEnd(8),
          k.ease.padEnd(7),
          `${Math.round(k.rect.cx)}, ${Math.round(k.rect.cy)}, ${Math.round(k.rect.w)}, ${Math.round(k.rect.h)}`,
        ].join(" ")
    );
  }

  console.log("\nPer-format framing (scale, and the hero's cost)\n");
  for (const d of layout.DELIVERABLES) {
    const L = layout.deriveLayout(d.width, d.height);
    const scales = timeline.stations.map((s) => {
      const f = world.STATION_FRAMES[s.id];
      return `${s.id} ${L.viewportFit(f.rect, f.fit).scale.toFixed(3)}`;
    });
    console.log(
      `  ${d.id.padEnd(20)} ${String(d.width).padStart(4)}x${String(d.height).padEnd(4)} ` +
        `${L.format.padEnd(9)} heroFullBleed=${String(L.heroFullBleed).padEnd(5)} ` +
        `cover would cost ${L.heroCoverUpscale.toFixed(3)}x`
    );
    console.log(`    ${scales.join("  ")}`);
  }

  if (timeline.warnings.length) {
    console.log(`\n${timeline.warnings.length} warning(s):`);
    for (const w of timeline.warnings) console.log(`  ! ${w}`);
  } else {
    console.log("\nNo warnings.");
  }
  console.log("");
}
