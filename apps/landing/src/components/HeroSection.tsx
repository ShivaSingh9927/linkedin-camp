'use client';

import { ArrowRight, Chrome, Mail, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { TextRotate } from "./TextRotate";

const revealVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (custom: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: custom * 0.1, ease: [0.215, 0.610, 0.355, 1.000] as const }
  })
};

const floatVariants = {
  animate: {
    y: [-8, 8, -8],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const }
  }
};

export function HeroSection() {
  return (
    <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        
        {/* Banner Badge */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-primary text-xs font-bold uppercase tracking-wider mb-8 shadow-sm border border-blue-100"
        >
          <Chrome className="w-4 h-4 text-primary" />
          <span>Browser Extension + Web Dashboard</span>
        </motion.div>
        
        {/* Main Heading */}
        <motion.h1
          custom={1}
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          className="font-display text-6xl md:text-8xl font-semibold text-slate-900 leading-[1.15] mb-8"
        >
          The Powerhouse <br/>
          <span className="inline-flex flex-wrap justify-center items-center gap-x-2">
            <span>B2B</span>
            <span className="gradient-text min-w-[280px] sm:min-w-[450px] inline-flex justify-center text-center">
              <TextRotate
                texts={["Lead Generation", "Cold Outreach", "Sales Automation", "Email Hunting"]}
                rotationInterval={2500}
                staggerDuration={0.02}
                animatePresenceMode="wait"
                loop={true}
                auto={true}
              />
            </span>
            <span>Tool</span>
          </span>
        </motion.h1>
        
        {/* Description */}
        <motion.p
          custom={2}
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 mb-12"
        >
          A powerful Chrome extension and web dashboard designed to automate LinkedIn outreach and cold email at scale. Let Qampi handle the heavy lifting while you focus on closing.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          custom={3}
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none"
        >
          <a
            href="https://app.qampi.com/register"
            id="hero-cta-main"
            className="w-full sm:w-auto btn-primary px-10 py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-2"
          >
            Start Generating Leads
            <ArrowRight className="w-5 h-5" />
          </a>
          <a
            href="#"
            id="hero-cta-demo"
            className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 text-slate-900 px-10 py-4 rounded-2xl text-lg font-bold border border-slate-200 transition-all flex items-center justify-center"
          >
            Watch Demo
          </a>
        </motion.div>

        {/* Hero Mockup Container */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          className="mt-24 relative max-w-5xl mx-auto"
        >
          <motion.div
            variants={floatVariants}
            animate="animate"
            className="relative bg-white rounded-3xl p-4 shadow-2xl border border-slate-100"
          >
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2000"
              alt="Qampi Dashboard"
              className="rounded-2xl w-full object-cover grayscale-[0.1] contrast-[1.03]"
            />
            
            {/* Top-Right Floating Card */}
            <div className="absolute -top-10 -right-6 hidden lg:block bg-white p-5 rounded-2xl shadow-xl border border-slate-100 text-left">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-8 h-8 bg-blue-100 text-primary rounded-full flex items-center justify-center">
                  <Mail className="w-4 h-4 text-primary fill-current" />
                </div>
                <span className="text-sm font-bold text-slate-800">Email Scraped!</span>
              </div>
              <p className="text-xs text-slate-400">Verified and ready to send</p>
            </div>

            {/* Bottom-Left Floating Card */}
            <div className="absolute -bottom-10 -left-6 hidden lg:block bg-white p-5 rounded-2xl shadow-xl border border-slate-100 text-left">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold border-2 border-white text-xs">JD</div>
                  <div className="w-9 h-9 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold border-2 border-white text-xs">AS</div>
                  <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white font-bold border-2 border-white text-xs">RK</div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">LinkedIn Auto-Connect</p>
                  <p className="text-xs text-slate-400">+45 new requests today</p>
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Background Glow Blobs */}
          <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] bg-blue-400/10 blur-[130px] rounded-full"></div>
        </motion.div>
      </div>
    </section>
  );
}
