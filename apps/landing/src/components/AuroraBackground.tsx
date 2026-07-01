"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode, useEffect, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  colors?: string[];
  distortion?: number;
  swirl?: number;
  speed?: number;
  offsetX?: number;
  veilOpacity?: string;
}

export const AuroraBackground = ({
  className,
  children,
  colors = ["#f3e8ff", "#e9d5ff", "#d8b4fe", "#c7d2fe", "#a5b4fc", "#ddd6fe"], // Qampi soft purple, violet, indigo theme
  distortion = 0.8,
  swirl = 0.6,
  speed = 0.42,
  offsetX = 0.08,
  veilOpacity = "bg-white/15 dark:bg-black/25", // Soft white veil to ensure text readability remains premium
  ...props
}: AuroraBackgroundProps) => {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      className={cn(
        "relative flex flex-col min-h-screen bg-white dark:bg-slate-950 text-slate-900 transition-colors duration-300 overflow-clip",
        className
      )}
      {...props}
    >
      {/* Fixed WebGL MeshGradient Backdrop */}
      <div className="fixed inset-0 w-screen h-screen pointer-events-none z-0">
        {mounted && (
          <>
            <MeshGradient
              width={dimensions.width}
              height={dimensions.height}
              colors={colors}
              distortion={distortion}
              swirl={swirl}
              grainMixer={0}
              grainOverlay={0}
              speed={speed}
              offsetX={offsetX}
            />
            <div className={cn("absolute inset-0 pointer-events-none", veilOpacity)} />
          </>
        )}
      </div>

      {/* Content wrapper */}
      <div className="relative z-10 w-full flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
};
