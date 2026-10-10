"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { NeatConfig, NeatGradient } from "@firecms/neat";

type NeatModule = typeof import("@firecms/neat");

// Animated WebGL gradient behind the hero (https://neat.firecms.co).
// Without a license key Neat draws a small "NEAT" watermark on the canvas;
// set NEXT_PUBLIC_NEAT_LICENSE_KEY (bought at neat.firecms.co, tied to the
// qampi.com domain) to remove it.
const CONFIG: NeatConfig = {
  colors: [
    { color: "#F7F6FE", enabled: true },
    { color: "#F4A1FF", enabled: true },
    { color: "#894FED", enabled: true },
    { color: "#C4BFD9", enabled: true },
    { color: "#EAEFFF", enabled: true },
    { color: "#B8D4E6", enabled: false },
  ],
  speed: 2,
  horizontalPressure: 5,
  verticalPressure: 6,
  waveFrequencyX: 1,
  waveFrequencyY: 2,
  waveAmplitude: 10,
  shadows: 0,
  highlights: 7,
  colorBrightness: 1.05,
  colorSaturation: 0,
  wireframe: false,
  colorBlending: 9,
  backgroundColor: "#003FFF",
  backgroundAlpha: 1,
  grainScale: 0,
  grainSparsity: 0,
  grainIntensity: 0,
  grainSpeed: 0,
  resolution: 1,
  yOffset: 279273.6880245209,
  yOffsetWaveMultiplier: 6.5,
  yOffsetColorMultiplier: 5,
  yOffsetFlowMultiplier: 3,
  flowDistortionA: 3.1,
  flowDistortionB: 2.4,
  flowScale: 1.5,
  flowEase: 0.31,
  flowEnabled: false,
};

// Same palette as a static CSS gradient: shown before the canvas mounts, when
// WebGL is unavailable, and for visitors who prefer reduced motion.
const FALLBACK =
  "radial-gradient(60% 70% at 20% 30%, #F4A1FF 0%, transparent 60%), radial-gradient(55% 60% at 80% 40%, #894FED 0%, transparent 65%), radial-gradient(70% 70% at 50% 90%, #C4BFD9 0%, transparent 70%), linear-gradient(#EAEFFF, #F7F6FE)";

export function NeatBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || !canvasRef.current) return;
    let gradient: NeatGradient | null = null;
    let cancelled = false;
    const startY = CONFIG.yOffset ?? 0;
    const onScroll = () => {
      if (gradient) gradient.yOffset = startY + window.scrollY;
    };

    // Loaded on demand so the WebGL code never competes with the hero's first
    // paint — and from public/vendor rather than the bundle: Next's production
    // minifier re-minifies Neat's own minified build and breaks it (the canvas
    // clears to the background colour but the gradient never draws). The file
    // is copied there by scripts/copy-neat.mjs before every dev/build.
    const url = "/vendor/neat.js";
    (import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<NeatModule>).then(({ NeatGradient }) => {
      if (cancelled || !canvasRef.current) return;
      try {
        gradient = new NeatGradient({
          ref: canvasRef.current,
          ...CONFIG,
          licenseKey: process.env.NEXT_PUBLIC_NEAT_LICENSE_KEY,
        });
        window.addEventListener("scroll", onScroll, { passive: true });
      } catch {
        // No WebGL: the CSS fallback underneath stays visible.
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      gradient?.destroy();
    };
  }, [reduceMotion]);

  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`} style={{ background: FALLBACK }}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
