'use client';

import { motion, useMotionValue, useTransform } from "framer-motion";
import { LineChart, ArrowUpRight, TrendingUp } from "lucide-react";
import React from "react";

export function CRMAnalyticsSection() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = (clientX - left) / width - 0.5;
    const y = (clientY - top) / height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  }

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-8, 8]);

  return (
    <section className="py-24 lg:py-32 bg-purple-50/30 relative overflow-hidden text-slate-900">
      
      {/* ── Background Elements ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Glows */}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-400/10 rounded-full blur-[100px]" />
        
        {/* Subtle Tech Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e140_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e140_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          
          {/* ═══════════════════════════════
              LEFT: COPY & HIGHLIGHTS
              ═══════════════════════════════ */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6 border border-blue-200/50 shadow-sm"
            >
              <LineChart className="w-4 h-4 text-blue-600" />
              <span>Real-Time Insights</span>
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-[4rem] font-black mb-6 tracking-tight leading-[1.1] text-slate-900"
            >
              Decisions powered by{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                real-time data
              </span>
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-slate-500 mb-10 leading-relaxed font-medium"
            >
              With a complete suite of real-time stats and metrics, you'll be able to make smart choices that propel your outreach strategy forward.
            </motion.p>
            
            <div className="flex gap-4 sm:gap-6 flex-wrap">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex-1 min-w-[200px] group hover:border-blue-300 hover:shadow-md transition-all duration-300"
              >
                <div className="text-4xl font-black text-blue-600 mb-2 group-hover:scale-105 transition-transform origin-left">94%</div>
                <div className="text-slate-500 font-bold text-sm tracking-wide">CRM SYNC RATE</div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex-1 min-w-[200px] group hover:border-emerald-300 hover:shadow-md transition-all duration-300"
              >
                <div className="text-4xl font-black text-emerald-500 mb-2 group-hover:scale-105 transition-transform origin-left">50%</div>
                <div className="text-slate-500 font-bold text-sm tracking-wide">HIGHER REPLIES</div>
              </motion.div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 flex items-center gap-6 text-sm font-bold text-slate-600"
            >
              <span className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100"><TrendingUp className="w-4 h-4 text-emerald-600" /> Live Data</span>
              <span className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"><ArrowUpRight className="w-4 h-4 text-blue-600" /> Exportable</span>
            </motion.div>
          </div>

          {/* ═══════════════════════════════
              RIGHT: DASHBOARD WIDGET
              ═══════════════════════════════ */}
          <div className="relative perspective-1000">
            {/* Ambient Shadow Glow */}
            <div className="absolute inset-0 bg-blue-500/10 rounded-[3rem] blur-3xl pointer-events-none" />

            <motion.div
              onMouseMove={handleMouseMove}
              onMouseLeave={() => {
                mouseX.set(0);
                mouseY.set(0);
              }}
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
              className="bg-white/90 backdrop-blur-xl border border-white rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden group"
            >
              {/* Internal Glows */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/50 rounded-full blur-[40px] pointer-events-none" />
              
              {/* Top Header */}
              <div className="flex items-center justify-between mb-12" style={{ transform: "translateZ(30px)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <LineChart className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900">Active Campaign Stats</h3>
                </div>
                <div className="flex gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-400 border border-red-500/20" />
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-500/20" />
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 border border-emerald-500/20" />
                </div>
              </div>

              {/* Progress Bars */}
              <div className="space-y-8" style={{ transform: "translateZ(40px)" }}>
                {/* Waiting */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-600 font-bold flex items-center gap-2.5">
                      <div className="w-2.5 h-6 bg-amber-400 rounded-full shadow-sm" />
                      Waiting
                    </span>
                    <span className="text-slate-800 font-black text-lg">1.2k</span>
                  </div>
                  <div className="h-4.5 bg-slate-100 rounded-full w-full overflow-hidden shadow-inner relative">
                    <motion.div 
                      className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-amber-400 to-amber-300 rounded-full"
                      initial={{ width: 0 }}
                      whileInView={{ width: "60%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    </motion.div>
                  </div>
                </div>

                {/* Connected */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-600 font-bold flex items-center gap-2.5">
                      <div className="w-2.5 h-6 bg-emerald-400 rounded-full shadow-sm" />
                      Connected
                    </span>
                    <span className="text-slate-800 font-black text-lg">840</span>
                  </div>
                  <div className="h-4.5 bg-slate-100 rounded-full w-full overflow-hidden shadow-inner relative">
                    <motion.div 
                      className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      initial={{ width: 0 }}
                      whileInView={{ width: "42%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    </motion.div>
                  </div>
                </div>

                {/* Replied */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-slate-600 font-bold flex items-center gap-2.5">
                      <div className="w-2.5 h-6 bg-blue-500 rounded-full shadow-sm" />
                      Replied
                    </span>
                    <span className="text-slate-800 font-black text-lg">420</span>
                  </div>
                  <div className="h-4.5 bg-slate-100 rounded-full w-full overflow-hidden shadow-inner relative">
                    <motion.div 
                      className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full"
                      initial={{ width: 0 }}
                      whileInView={{ width: "21%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, delay: 0.6, ease: "easeOut" }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Bottom CTA Button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.8 }}
                style={{ transform: "translateZ(50px)" }}
                className="w-full mt-12 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 active:scale-95"
              >
                Full analytics report
              </motion.button>
              
            </motion.div>
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
