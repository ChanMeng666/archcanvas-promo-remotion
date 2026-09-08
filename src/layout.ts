/**
 * The layout every component imports.
 *
 * All the arithmetic is in `layout-core.ts`, which is React-free so the gates
 * can execute it in Node; this file is the thin hook that hands it the
 * viewport. Splitting them is what lets `capture/verify-timeline.mjs` check
 * the real per-format numbers instead of a copy that drifts.
 *
 * **Scenes never read `useVideoConfig().width`.** They read `useLayout()`.
 * A component inside a `<Sequence>` also must take its length as a prop —
 * `useVideoConfig().durationInFrames` reports the COMPOSITION length there,
 * not the sequence's.
 */

import { useMemo } from "react";
import { useVideoConfig } from "remotion";

import { deriveLayout, type Layout } from "./layout-core";

export {
  DELIVERABLES,
  cameraAt,
  deriveLayout,
  formatOf,
  type CameraEaseName,
  type Format,
  type Framing,
  type Layout,
} from "./layout-core";

export const useLayout = (): Layout => {
  const { width, height } = useVideoConfig();
  return useMemo(() => deriveLayout(width, height), [width, height]);
};
