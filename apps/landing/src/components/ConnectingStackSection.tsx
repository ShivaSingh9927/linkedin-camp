"use client";
import React, { useState, useEffect, useRef } from "react";
import { useScroll, useMotionValueEvent } from "framer-motion";

export function ConnectingStackSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    setProgress(latest);
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const maxRadius = isMobile ? 100 : 250;
  const expandRadius = progress * maxRadius;

  const items = [
    {
      type: "profile",
      src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      alt: "Sarah Jenkins, VP of Sales"
    },
    {
      type: "icon",
      icon: (
        <svg className="w-5 h-5 md:w-10 md:h-10 fill-current text-blue-600" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
        </svg>
      )
    },
    {
      type: "profile",
      src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      alt: "David Chen, Founder"
    },
    {
      type: "icon",
      icon: (
        <svg className="w-5 h-5 md:w-10 md:h-10 fill-current text-red-500" viewBox="0 0 24 24">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
      )
    },
    {
      type: "profile",
      src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
      alt: "Amanda Rossi, Head of Talent"
    },
    {
      type: "icon",
      icon: (
        <svg className="w-5 h-5 md:w-10 md:h-10 fill-current text-orange-500" viewBox="0 0 24 24">
          <path d="M18.895 10.378c.883 0 1.6-0.717 1.6-1.6s-.717-1.6-1.6-1.6-1.6.717-1.6 1.6.717 1.6 1.6 1.6zm-13.79 0c.883 0 1.6-0.717 1.6-1.6s-.717-1.6-1.6-1.6-1.6.717-1.6 1.6.717 1.6 1.6 1.6zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.328 14.153l-1.92-1.92c-.37.195-.79.317-1.242.34l-1.12 3.36c1.693-.243 3.197-.935 4.282-1.78zm-6.656 0c1.085.845 2.59 1.537 4.282 1.78l-1.12-3.36c-.452-.023-.872-.145-1.242-.34l-1.92 1.92zM12 13.6c-.883 0-1.6-.717-1.6-1.6s.717-1.6 1.6-1.6 1.6.717 1.6 1.6-.717 1.6-1.6 1.6z"/>
        </svg>
      )
    },
    {
      type: "profile",
      src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      alt: "Marcus Brody, Account Executive"
    },
    {
      type: "icon",
      icon: (
        <svg className="w-5 h-5 md:w-10 md:h-10 fill-current text-slate-800" viewBox="0 0 24 24">
          <path d="M4.17 2.05C3.33 2.05 3 2.45 3 3.29v17.42c0 .84.33 1.24 1.17 1.24H19.8c.84 0 1.2-.4 1.2-1.24V3.29c0-.84-.36-1.24-1.2-1.24H4.17zm1.96 3.49h11.74v12.92H6.13V5.54zm2.14 2.14v8.64h1.79V9.77l2.84 4.41h1.34V7.68h-1.79v5.91l-2.84-4.41H8.27z"/>
        </svg>
      )
    }
  ];

  return (
    <div ref={containerRef} className="relative min-h-[130vh] bg-transparent w-full">
      <div className="sticky top-0 h-screen w-full flex items-center justify-center p-4 overflow-hidden z-10">
        <div className="relative">
          
          {/* Glowing pulse effect under the center hub */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-blue-500/5 animate-pulse pointer-events-none z-0" />
          
          <div
            className={`w-[290px] h-[290px] md:w-[600px] md:h-[600px] rounded-full flex items-center justify-center transition-all duration-700 ease-out ${
              progress > 0.6 ? "border border-slate-100/80 dark:border-slate-800/40 shadow-inner" : "border border-transparent"
            }`}
          >
            <div
              className={`w-[240px] h-[240px] md:w-[500px] md:h-[500px] rounded-full flex items-center justify-center relative transition-all duration-700 ease-out ${
                progress > 0.2 ? "border border-blue-50/40 dark:border-blue-950/15" : "border border-transparent"
              }`}
            >
              
              {/* Dynamic Expanding Connector Lines */}
              {items.map((_, idx) => {
                const angle = (idx * Math.PI) / 4;
                return (
                  <div
                    key={`line-${idx}`}
                    className="absolute left-1/2 top-1/2 origin-left h-[1.5px] border-t border-dashed border-blue-500/20 pointer-events-none z-0"
                    style={{
                      width: `${expandRadius}px`,
                      transform: `rotate(${angle}rad) translateY(-50%)`,
                      opacity: progress,
                    }}
                  />
                );
              })}

              <div className="w-[190px] h-[190px] md:w-[400px] md:h-[400px] rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 p-0.5 flex items-center justify-center relative shadow-2xl z-10">
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center relative">
                  
                  {/* Dynamic Expanding Floating Items */}
                  {items.map((item, idx) => {
                    const angle = (idx * Math.PI) / 4;
                    const xTranslation = expandRadius * Math.cos(angle);
                    const yTranslation = expandRadius * Math.sin(angle);
                    
                    // Scale and opacity starts small and increases as the circle expands
                    const scale = 0.4 + progress * 0.6;
                    const opacity = progress;

                    return (
                      <div
                        key={idx}
                        className="absolute w-12 h-12 md:w-20 md:h-20 rounded-xl md:rounded-2xl overflow-hidden border-2 md:border-4 border-white dark:border-slate-800 shadow-md md:shadow-xl transition-all duration-300 ease-out z-20 bg-slate-50 flex items-center justify-center"
                        style={{
                          transform: `translate(${xTranslation}px, ${yTranslation}px) scale(${scale})`,
                          opacity: opacity,
                        }}
                      >
                        {item.type === "profile" ? (
                          <img
                            src={item.src}
                            alt={item.alt}
                            className="w-full h-full object-cover select-none pointer-events-none"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full bg-white p-2 md:p-4">
                            {item.icon}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Center Text Fades in as progress increases */}
                  <div
                    className={`flex flex-col items-center justify-center px-4 relative z-20 transition-all duration-700 ease-out select-none ${
                      progress > 0.45 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
                    }`}
                  >
                    <h3 className="font-display text-xl md:text-5xl font-medium text-slate-800 dark:text-white text-center mb-1">
                      Prospecting
                    </h3>
                    <h3 className="font-display text-xl md:text-5xl font-medium text-primary text-center mb-3">
                      Automated
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-center text-xs md:text-sm max-w-[140px] md:max-w-xs leading-relaxed">
                      Find verified leads, launch sequences, and sync to your CRM in seconds.
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
