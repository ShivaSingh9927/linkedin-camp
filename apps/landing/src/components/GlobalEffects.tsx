'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export function GlobalEffects() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Smooth the mouse movement for the glow
  const smoothX = useSpring(0, { damping: 50, stiffness: 400 });
  const smoothY = useSpring(0, { damping: 50, stiffness: 400 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      smoothX.set(e.clientX);
      smoothY.set(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [smoothX, smoothY]);

  return (
    <>
      {/* ── Global Grid Background ── */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        {/* Subtle dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1)_1px,transparent_1px)] [background-size:16px_16px]" />
        {/* Vertical/Horizontal lines grid (very faint) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#a855f715_1px,transparent_1px),linear-gradient(to_bottom,#a855f715_1px,transparent_1px)] bg-[size:16px_16px]" />
      </div>

      {/* ── Global Cursor Glow ── */}
      <motion.div
        className="fixed top-0 left-0 w-[100px] h-[100px] rounded-full pointer-events-none z-50 mix-blend-multiply opacity-70"
        style={{
          x: smoothX,
          y: smoothY,
          translateX: '-50%',
          translateY: '-50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0) 70%)'
        }}
      />
    </>
  );
}
