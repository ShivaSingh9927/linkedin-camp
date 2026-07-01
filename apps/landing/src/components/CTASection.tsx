'use client';

import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Check, Sparkles, Zap, ArrowRight } from "lucide-react";
import React, { useRef } from "react";

export function CTASection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth out the mouse values for the spotlight
  const smoothX = useSpring(mouseX, { damping: 50, stiffness: 400 });
  const smoothY = useSpring(mouseY, { damping: 50, stiffness: 400 });

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  // 3D tilt effect for the main container
  const rotateX = useTransform(smoothY, [0, 800], [5, -5]);
  const rotateY = useTransform(smoothX, [0, 1200], [-5, 5]);

  return (
    <section className="py-24 lg:py-32 bg-purple-50/30 relative overflow-hidden">
      
      {/* Background ambient glow behind the CTA card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 relative perspective-1000">
        
        <motion.div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            mouseX.set(containerRef.current ? containerRef.current.offsetWidth / 2 : 0);
            mouseY.set(containerRef.current ? containerRef.current.offsetHeight / 2 : 0);
          }}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
          className="group relative bg-[#2D1B69] rounded-[3rem] lg:rounded-[4rem] p-10 sm:p-16 lg:p-24 overflow-hidden text-center text-white shadow-[0_20px_80px_-15px_rgba(168,85,247,0.4)] border border-purple-400/20"
        >
          {/* ── Dynamic Deep Background Gradients ── */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-700 via-[#2D1B69] to-indigo-900" />
          
          {/* Moving Orbs Background */}
          <motion.div 
            className="absolute top-0 right-0 w-[500px] h-[500px] bg-fuchsia-400/30 blur-[100px] rounded-full mix-blend-screen"
            animate={{ 
              x: [0, -100, 0],
              y: [0, 50, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-violet-500/30 blur-[120px] rounded-full mix-blend-screen"
            animate={{ 
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.5, 1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />

          {/* Interactive Spotlight Overlay */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 opacity-0 group-hover:opacity-100"
            style={{
              background: useTransform(
                [smoothX, smoothY],
                ([x, y]) => `radial-gradient(800px circle at ${x}px ${y}px, rgba(255,255,255,0.15), transparent 50%)`
              ) as any,
            }}
          />

          {/* Grid Pattern Overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay z-10 pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:40px_40px] z-10 pointer-events-none" />

          {/* ── Content ── */}
          <div className="relative z-20 max-w-4xl mx-auto flex flex-col items-center">
            
            {/* Logo Badge */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
              whileInView={{ scale: 1, opacity: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, type: "spring", stiffness: 200, delay: 0.2 }}
              style={{ transform: "translateZ(50px)" }}
              className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl flex items-center justify-center shadow-2xl mb-12"
            >
              <img src="/logo.png" alt="Qampi Logo" className="w-10 h-10 object-contain drop-shadow-md" />
            </motion.div>

            {/* Headline */}
            <motion.div style={{ transform: "translateZ(60px)" }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-purple-200 text-sm font-bold uppercase tracking-widest mb-8"
              >
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>Supercharge Your Pipeline</span>
              </motion.div>

              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold mb-8 leading-[1.05] text-white drop-shadow-lg"
              >
                Turn your browser into a <br className="hidden md:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-fuchsia-300">
                  sales generating machine
                </span>
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-xl sm:text-2xl text-purple-100/80 mb-14 max-w-2xl mx-auto font-medium leading-relaxed"
              >
                Join 10,000+ top sales leaders. Start your free trial today and experience the future of outbound.
              </motion.p>
            </motion.div>
            
            {/* Buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.6 }}
              style={{ transform: "translateZ(40px)" }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full sm:w-auto"
            >
              <a
                href="#"
                className="group relative w-full sm:w-auto bg-white text-purple-700 px-10 py-5 rounded-2xl text-lg font-black transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 overflow-hidden"
              >
                {/* Button Inner Shimmer */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-purple-100/50 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                <span className="relative z-10">Start free trial</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </a>
              
              <a
                href="#"
                className="w-full sm:w-auto bg-white/5 border border-white/20 backdrop-blur-md text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-white/10 hover:border-white/40 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center"
              >
                Book a demo
              </a>
            </motion.div>
            
            {/* Trust badge */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.8 }}
              style={{ transform: "translateZ(20px)" }}
              className="mt-12 flex items-center justify-center gap-3 text-purple-200/60 text-sm font-semibold tracking-wide"
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <span>No credit card required. Cancel anytime.</span>
            </motion.div>

          </div>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </section>
  );
}
