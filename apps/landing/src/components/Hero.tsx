"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import { MagneticButton } from "./MagneticButton";

interface FloatingMessageProps {
  x: number;
  y: number;
  size: number;
  color: string;
  type: 'message' | 'mail' | 'linkedin' | 'logo';
}

function FloatingMessage({ x, y, size, color, type }: FloatingMessageProps) {
  // SVG paths for message bubble, email envelope, and LinkedIn logo
  const path = type === 'message'
    ? "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
    : type === 'mail'
      ? "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
      : type === 'linkedin'
        ? "M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
        : "";

  // Memoize random values so they are stable across re-renders for a seamless, multi-axis soft drift
  const driftX = useMemo(() => Math.random() * 80 - 40, []);
  const driftY = useMemo(() => Math.random() * 80 - 40, []);
  const maxRotate = useMemo(() => Math.random() * 24 - 12, []);

  // Use slightly offset, prime-like durations so horizontal, vertical, rotation and scale cycles mismatch, 
  // creating a truly organic and infinitely non-repetitive (seamless) motion path.
  const durationX = useMemo(() => 18 + Math.random() * 14, []);
  const durationY = useMemo(() => 18 + Math.random() * 14, []);
  const durationRotate = useMemo(() => 22 + Math.random() * 18, []);
  const durationScale = useMemo(() => 14 + Math.random() * 10, []);
  const durationOpacity = useMemo(() => 12 + Math.random() * 8, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        x: [0, driftX, -driftX, 0],
        y: [0, -driftY, driftY, 0],
        rotate: [0, maxRotate, -maxRotate, 0],
        scale: [0.95, 1.05, 0.95],
        opacity: type === 'logo' ? [0.12, 0.22, 0.12] : [0.18, 0.32, 0.18],
      }}
      transition={{
        x: { duration: durationX, repeat: Infinity, ease: "easeInOut" },
        y: { duration: durationY, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: durationRotate, repeat: Infinity, ease: "easeInOut" },
        scale: { duration: durationScale, repeat: Infinity, ease: "easeInOut" },
        opacity: { duration: durationOpacity, repeat: Infinity, ease: "easeInOut" },
      }}
      className="absolute pointer-events-none select-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
      }}
    >
      {type === 'logo' ? (
        <img 
          src="/logo.png" 
          alt="Qampi Bird" 
          className="w-full h-full object-contain select-none pointer-events-none opacity-70 filter saturate-[0.6] drop-shadow-sm" 
        />
      ) : (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill={color}
        >
          <path d={path} />
        </svg>
      )}
    </motion.div>
  );
}

function FloatingMessages() {
  const [items, setItems] = useState<Array<{ id: number; x: number; y: number; size: number; color: string; type: 'message' | 'mail' | 'linkedin' | 'logo' }>>([]);

  useEffect(() => {
    const types: Array<'message' | 'mail' | 'linkedin' | 'logo'> = ['message', 'mail', 'linkedin', 'logo'];
    // Distribute using percentages (e.g. 5% to 95%) to cover the container correctly
    const newItems = Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90, // 5% to 95%
      y: 5 + Math.random() * 90, // 5% to 95%
      size: Math.random() * 20 + 24, // Size range: 24px to 44px
      color: `rgba(147, 51, 234, ${0.22 + Math.random() * 0.18})`, // Soft brand purple (Tailwind purple-600)
      type: types[i % 4], // Mixes the logo into the floating items
    }));
    setItems(newItems);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden w-full h-full">
      {items.map((item) => (
        <FloatingMessage key={item.id} {...item} />
      ))}
    </div>
  );
}

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["automated", "personalized", "effortless", "multi-channel", "smart"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2500);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-white via-blue-50/20 to-purple-50/15 pt-20">
      
      {/* Background Floating Message/Mail/LinkedIn Icons */}
      <FloatingMessages />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="flex gap-8 items-center justify-center flex-col max-w-5xl mx-auto">
          
          {/* Extension Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <span
              className="inline-flex items-center gap-2 bg-blue-50 text-primary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100 shadow-sm"
            >
              Browser Extension + Web Dashboard
            </span>
          </motion.div>

          {/* Heading with Letter-by-Letter and Rotating Animations */}
          <div className="flex gap-4 flex-col items-center w-full">
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-[1.2] mb-4 tracking-tighter w-full">
              
              {/* Rising spring letters for prefix */}
              <span className="block mb-2">
                {"This is B2B lead gen made".split(" ").map((word, wordIndex) => (
                  <span key={wordIndex} className="inline-block mr-3 last:mr-0 whitespace-nowrap">
                    {word.split("").map((letter, letterIndex) => (
                      <motion.span
                        key={`${wordIndex}-${letterIndex}`}
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          delay: wordIndex * 0.04 + letterIndex * 0.012,
                          type: "spring",
                          stiffness: 150,
                          damping: 25,
                        }}
                        className="inline-block"
                      >
                        {letter}
                      </motion.span>
                    ))}
                  </span>
                ))}
              </span>

              {/* Sliding rotation segment */}
              <span className="relative flex w-full justify-center overflow-hidden h-[1.3em] md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-extrabold gradient-text"
                    initial={{ opacity: 0, y: -100 }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? -150 : 150,
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="text-lg md:text-xl leading-relaxed tracking-tight text-slate-500 max-w-2xl mx-auto mt-6"
            >
              A powerful Chrome extension and web dashboard designed to automate LinkedIn outreach and cold email at scale. Let Qampi handle the heavy lifting while you focus on closing.
            </motion.p>
          </div>

          {/* Premium CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 mt-8 w-full justify-center max-w-md sm:max-w-none"
          >
            <a
              href="#"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 px-8 py-4 rounded-2xl text-lg font-bold border border-slate-200 transition-all duration-200 shadow-sm hover:-translate-y-0.5 active:scale-98"
            >
              Watch Demo <MoveRight className="w-4.5 h-4.5 text-slate-400" />
            </a>

            {/* Premium Gradient Glow Button Container */}
            <MagneticButton>
              <div
                className="inline-block p-px rounded-2xl bg-gradient-to-b from-blue-400/30 to-purple-400/30 
                           overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 w-full sm:w-auto"
              >
                <a
                  href="https://app.qampi.com/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 btn-primary px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-blue-200 hover:-translate-y-0.5 active:scale-98 transition-all duration-200"
                >
                  Start Generating Leads <MoveRight className="w-4.5 h-4.5" />
                </a>
              </div>
            </MagneticButton>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

export { Hero };
