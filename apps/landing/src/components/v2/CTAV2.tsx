'use client';

import { ArrowRight, Sparkles } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useMemo } from "react";

function Particles() {
  const particles = useMemo(() => 
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 10 + 15,
      delay: Math.random() * 5,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white/20"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -100, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function CTAV2() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.92, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  return (
    <section ref={ref} className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.08]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      {/* Floating orbs */}
      <motion.div
        className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-white/[0.06] rounded-full blur-[100px]"
        animate={{ 
          x: [0, 50, 0],
          y: [0, -30, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[10%] right-[15%] w-[250px] h-[250px] bg-white/[0.05] rounded-full blur-[80px]"
        animate={{ 
          x: [0, -40, 0],
          y: [0, 40, 0],
          scale: [1.1, 0.9, 1.1]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />

      {/* Particles */}
      <Particles />

      <motion.div style={{ scale, opacity }} className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-1.5 rounded-full text-xs font-black mb-6 backdrop-blur-sm border border-white/20 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Powered by Aigeon AI
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]"
          >
            Ready to 3x your LinkedIn reply rate?
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-6 text-base sm:text-lg text-white/80 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Join 3,000+ founders and sales teams using Aigeon AI to turn cold outreach into warm conversations. Start free with 25 AI messages/week — no credit card required.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.a
              href="https://app.qampi.com/register"
              whileHover={{ scale: 1.04, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
              whileTap={{ scale: 0.98 }}
              className="group relative inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-white/95 px-8 py-4 rounded-2xl text-sm font-black shadow-xl shadow-black/10 transition-colors duration-300 overflow-hidden"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-100/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative z-10">Start Free — 25 AI messages/week</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200 relative z-10" />
            </motion.a>
            <a
              href="#pricing"
              className="text-white/60 hover:text-white font-semibold text-sm transition-colors duration-200 underline underline-offset-4 decoration-white/30 hover:decoration-white/60"
            >
              See all pricing plans
            </a>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-10 flex items-center justify-center space-x-6 text-sm text-white/50 font-medium"
          >
            {["14-day free trial", "No credit card", "Cancel anytime"].map((item, i) => (
              <motion.div 
                key={item} 
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="flex items-center space-x-2"
              >
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-sm shadow-emerald-400/50" />
                <span>{item}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
