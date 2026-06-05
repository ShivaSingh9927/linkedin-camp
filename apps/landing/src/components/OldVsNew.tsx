'use client';

import { X, Check, Zap, Skull, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const oldWay = [
  "Scraping lead databases already outdated",
  "Spending hours setting up tools",
  "Complicated workflows for big teams",
  "Forgetting follow-ups constantly",
  "Losing conversations in messy inbox",
  "Generic templates that prospects ignore",
  "5-8% reply rate — most messages go unanswered",
];

const newWay = [
  "Prospect directly on LinkedIn, always fresh",
  "Launch outreach in minutes with templates",
  "One simple flow, no tech to manage",
  "Auto follow-ups that turn silence to replies",
  "One inbox for every conversation",
  "Qampi crafts unique messages referencing posts",
  "25-40% reply rate — every message feels personal",
];

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export function OldVsNew() {
  return (
    <section className="py-24 lg:py-32 bg-purple-50/30 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 bg-rose-50 text-rose-500 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6 border border-rose-100 shadow-sm">
            <Zap className="w-4 h-4" /> The Paradigm Shift
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
            Outreach shouldn't feel like a <br />
            <span className="text-rose-500 line-through decoration-4 decoration-rose-500/30">second job</span>
            {" "} <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">breeze</span>
          </h2>
          <p className="mt-6 text-xl text-slate-500 font-medium">
            From "ugh" to "done" in 10 minutes.
          </p>
        </motion.div>

        <div className="relative grid lg:grid-cols-[1fr_auto_1fr] gap-12 lg:gap-0 items-center max-w-6xl mx-auto">
          
          {/* Old Way */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, type: "spring" }}
            className="lg:pr-12 relative z-10"
          >
            <div className="bg-white hover:bg-rose-50/80 rounded-[2.5rem] p-8 md:p-10 border border-slate-200 shadow-lg hover:-translate-y-3 hover:shadow-2xl hover:shadow-rose-500/10 hover:border-rose-200 transition-all duration-500 group">
              <div className="flex flex-col items-center text-center space-y-4 mb-8 pb-8 border-b border-slate-100">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-rose-50 transition-colors duration-500">
                  <X className="w-8 h-8 text-slate-400 group-hover:text-rose-400 transition-colors duration-500" />
                </div>
                <h3 className="text-2xl font-black text-slate-800">The Old Way</h3>
              </div>
              <motion.ul 
                variants={listVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="space-y-5"
              >
                {oldWay.map((item) => (
                  <motion.li variants={itemVariants} key={item} className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <X className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <span className="text-slate-500 font-medium leading-relaxed">{item}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </motion.div>

          {/* VS Badge */}
          <div className="hidden lg:flex flex-col items-center justify-center relative z-20 w-0">
             <motion.div 
               initial={{ scale: 0, rotate: -180 }}
               whileInView={{ scale: 1, rotate: 0 }}
               viewport={{ once: true }}
               transition={{ type: "spring", bounce: 0.6, delay: 0.2 }}
               className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white font-black italic text-xl shadow-2xl absolute left-1/2 -translate-x-1/2 border-4 border-slate-50"
             >
               VS
             </motion.div>
          </div>

          {/* New Way */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, type: "spring", delay: 0.1 }}
            className="lg:pl-12 relative z-30"
          >
            <div className="bg-white hover:bg-indigo-50/80 rounded-[2.5rem] p-8 md:p-10 border border-indigo-100 shadow-lg relative group hover:-translate-y-3 hover:shadow-2xl hover:shadow-indigo-500/15 hover:border-indigo-200 transition-all duration-500">
              
              <div className="relative z-10">
                <div className="absolute -top-4 -right-2 md:right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
                  The Qampi Way
                </div>
                <div className="flex flex-col items-center text-center space-y-4 mb-8 pb-8 border-b border-indigo-50">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-100 transition-colors duration-500">
                    <img src="/logo.png" alt="Qampi Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-500">The Qampi Way</h3>
                </div>
                <motion.ul 
                  variants={listVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="space-y-5"
                >
                  {newWay.map((item) => (
                    <motion.li variants={itemVariants} key={item} className="flex items-start gap-4">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-emerald-500/20">
                        <Check className="w-3.5 h-3.5 text-white font-bold" />
                      </div>
                      <span className="text-slate-800 font-bold leading-relaxed">{item}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
