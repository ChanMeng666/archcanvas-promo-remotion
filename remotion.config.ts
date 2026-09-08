import { Config } from "@remotion/cli/config";

// This film is hairlines, 10px dimension labels and captured product UI at small
// type. JPEG frames ring around exactly that, so it pays for PNG frames: slower
// to render, materially crisper. Same call the two shipped Remotion films make.
Config.setVideoImageFormat("png");

Config.setOverwriteOutput(true);

// Windows + headless Chrome: "angle" is the renderer both shipped films use.
Config.setChromiumOpenGlRenderer("angle");

// Fonts are fetched at module scope and Remotion re-executes module scope in
// every render worker it spins up. A long render brings workers up late and the
// default 30s delayRender budget is shared with whatever else that first frame
// is doing -- chan-meng-promo-video died at frame 892 of 1078 on exactly that.
// 120s is not a real wait, it is headroom against a cold worker.
Config.setDelayRenderTimeoutInMilliseconds(120_000);
