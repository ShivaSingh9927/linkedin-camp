'use client';

import { Mail, Check, Sparkles, Search, Fingerprint, Zap } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import React from "react";

export function ColdEmailOutreach() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = (clientX - left) / width - 0.5;
    const y = (clientY - top) / height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  }

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-10, 10]);

  return (
    <section id="email" className="py-24 lg:py-32 bg-white relative overflow-hidden">
      
      {/* ── Background Elements ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradients */}
        <div className="absolute top-[10%] left-[-10%] w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-100/40 rounded-full blur-[100px]" />
        
        {/* Tech Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          
          {/* ═══════════════════════════════
              LEFT: WIDGET MOCKUP
              ═══════════════════════════════ */}
          <div className="w-full lg:w-1/2 relative perspective-1000">
            {/* Ambient Glow behind widget */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] bg-gradient-to-br from-blue-400/30 to-purple-500/20 rounded-full blur-[80px] pointer-events-none animate-pulse" />

            <motion.div
              onMouseMove={handleMouseMove}
              onMouseLeave={() => {
                mouseX.set(0);
                mouseY.set(0);
              }}
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              initial={{ opacity: 0, scale: 0.9, rotateY: -15 }}
              whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
              className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 shadow-2xl relative border border-white/60"
            >
              {/* Profile Card Header */}
              <div className="flex items-center gap-5 mb-8" style={{ transform: "translateZ(30px)" }}>
                <div className="relative">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150"
                    alt="Lauren Anderson"
                    className="w-16 h-16 rounded-full object-cover shadow-lg border-2 border-white"
                  />
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 text-lg">Lauren Anderson</h4>
                  <p className="text-slate-500 text-sm font-medium">HR Director @ TechCorp</p>
                </div>
                <div className="ml-auto">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs bg-blue-50 px-4 py-2 rounded-xl shadow-sm border border-blue-100/50">
                    <img src="/logo.png" alt="Qampi" className="w-3.5 h-3.5" />
                    LinkedIn
                  </div>
                </div>
              </div>

              {/* Email Search Box */}
              <div 
                className="bg-slate-900 rounded-2xl p-7 relative overflow-hidden shadow-[0_20px_50px_-12px_rgba(15,23,42,0.4)]"
                style={{ transform: "translateZ(50px)" }}
              >
                {/* Internal Glows */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 blur-[50px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/20 blur-[50px] rounded-full pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-blue-400" />
                      Qampi Email Finder
                    </p>
                    <Fingerprint className="w-4 h-4 text-slate-600" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-white text-sm font-medium">Searching databases...</span>
                      <span className="text-blue-400 font-bold font-mono text-lg">92%</span>
                    </div>
                    <div className="h-2.5 bg-slate-800 rounded-full w-full overflow-hidden shadow-inner relative">
                      <motion.div 
                        className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                        initial={{ width: "0%" }}
                        whileInView={{ width: "92%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                      >
                        {/* Shimmer on progress bar */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                      </motion.div>
                    </div>
                    
                    {/* Simulated Success State */}
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      whileInView={{ opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 2.5, duration: 0.5, type: "spring", stiffness: 200 }}
                      className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between shadow-inner"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Mail className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="text-emerald-400 font-mono text-sm tracking-tight font-medium">l.anderson@techcorp.com</span>
                      </div>
                      <Check className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ═══════════════════════════════
              RIGHT: COPY & FEATURES
              ═══════════════════════════════ */}
          <div className="w-full lg:w-1/2 relative text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-8 border border-indigo-100 shadow-sm"
            >
              <img src="/logo.png" alt="Qampi Logo" className="w-4 h-4 object-contain" />
              <span>Verified Email Finder</span>
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold text-slate-900 mb-6 leading-[1.1]"
            >
              The Ultimate Email{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                Hunter & Sender
              </span>
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-slate-500 mb-10 leading-relaxed font-medium max-w-xl"
            >
              Find verified professional emails in one click, then launch high-converting cold email sequences automatically — running LinkedIn and email from one place.
            </motion.p>

            <div className="space-y-4">
              {[
                { text: "Integrated email finder — verified addresses in one click" },
                { text: "Connect your existing email provider" },
                { text: "Multi-step email sequences for cold outreach" },
                { text: "Open, click & reply rate tracking" },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 + (idx * 0.1) }}
                  className="flex items-center gap-4 group p-3 -ml-3 rounded-xl hover:bg-slate-50 transition-colors duration-300"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100/50 border border-blue-200/50 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition-all duration-300 shadow-sm">
                    <Check className="w-4 h-4 text-blue-600 group-hover:text-white" strokeWidth={3} />
                  </div>
                  <span className="text-slate-700 font-semibold text-[15px] group-hover:text-slate-900 transition-colors">{item.text}</span>
                  {item.soon && (
                    <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">Soon</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </section>
  );
}
