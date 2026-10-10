"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

// A real product screenshot — or a short looping screen recording — in a
// light browser frame. Screenshots in public/screens are 2368×1800 (the app at
// 1440×900, 2×, sidebar clipped off; see scripts/capture-screens.mjs).

type Media =
  | { src: string; video?: undefined }
  | { video: { src: string; poster: string; width: number; height: number }; src?: undefined };

export function AppWindow({
  alt,
  url,
  priority = false,
  className = "",
  ...media
}: Media & {
  alt: string;
  url: string;
  priority?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  // The server can't know the visitor's motion preference, so the markup is
  // identical either way and playback is decided here, after hydration.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduceMotion) v.pause();
    else v.play().catch(() => {}); // blocked autoplay just leaves the poster
  }, [reduceMotion]);

  return (
    <figure
      className={`overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-24px_rgba(76,29,149,0.28),0_2px_6px_-2px_rgba(15,23,42,0.06)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50/80 px-3.5 py-2">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </div>
        <div className="mx-auto max-w-[260px] flex-1 truncate rounded-md border border-slate-200/70 bg-white px-3 py-0.5 text-center font-mono text-[11px] text-slate-400">
          {url}
        </div>
        <div className="w-[42px]" aria-hidden="true" />
      </div>
      {media.video ? (
        // Muted + playsInline lets it play inline everywhere, including iOS.
        // With reduced motion the poster stands in and nothing plays.
        <video
          ref={videoRef}
          src={media.video.src}
          poster={media.video.poster}
          width={media.video.width}
          height={media.video.height}
          loop
          muted
          playsInline
          preload={priority ? "auto" : "metadata"}
          aria-label={alt}
          className="block h-auto w-full"
        />
      ) : (
        <img
          src={media.src}
          alt={alt}
          width={2368}
          height={1800}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          className="block h-auto w-full"
        />
      )}
    </figure>
  );
}
