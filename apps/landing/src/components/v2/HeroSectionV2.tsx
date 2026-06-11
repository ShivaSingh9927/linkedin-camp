'use client';

import { ArrowRight, Zap, Target, Mail, Users, Sparkles, Database, ShieldAlert, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type Persona = "Founder" | "Engineering" | "Sales";

interface HeroPersonaData {
  lead: string;
  title: string;
  company: string;
  avatar: string;
  leadsCount: string;
  connectedCount: string;
  repliesCount: string;
  progress: number;
  campaignName: string;
  aiMessage: string;
}

const personaData: Record<Persona, HeroPersonaData> = {
  "Founder": {
    lead: "Sarah Chen",
    title: "Founder & CEO",
    company: "AetherSaaS",
    avatar: "S",
    leadsCount: "1,247",
    connectedCount: "892",
    repliesCount: "234",
    progress: 74,
    campaignName: "Tech Founders Outreach",
    aiMessage: "Hey Sarah, saw your post about scaling AetherSaaS to $2M ARR — we helped 3 founders do exactly that..."
  },
  "Engineering": {
    lead: "David Kovac",
    title: "Head of Infrastructure",
    company: "CloudCore",
    avatar: "D",
    leadsCount: "842",
    connectedCount: "512",
    repliesCount: "148",
    progress: 61,
    campaignName: "K8s Latency Solutions",
    aiMessage: "Hey David, saw your thread on Kubernetes latency issues. Loved the practical take on config maps..."
  },
  "Sales": {
    lead: "Marcus Vane",
    title: "VP of Global Sales",
    company: "ScaleFlow",
    avatar: "M",
    leadsCount: "2,154",
    connectedCount: "1,410",
    repliesCount: "512",
    progress: 88,
    campaignName: "High Velocity Sales Pipeline",
    aiMessage: "Hello Marcus, read your post on outbound reply rates dropping. Spot on about generic templates..."
  }
};

export function HeroSectionV2() {
  const [activePersona, setActivePersona] = useState<Persona>("Founder");
  const activeData = personaData[activePersona];
  const [typedMessage, setTypedMessage] = useState("");

  useEffect(() => {
    setTypedMessage("");
    let index = 0;
    const targetMessage = activeData.aiMessage;
    
    // Simulating natural typing behavior with slightly variable speed
    let timer: NodeJS.Timeout;
    
    const typeNextChar = () => {
      if (index < targetMessage.length) {
        setTypedMessage((prev) => prev + targetMessage.charAt(index));
        index++;
        const nextSpeed = Math.random() * 20 + 10; // humanized variable latency
        timer = setTimeout(typeNextChar, nextSpeed);
      }
    };
    
    timer = setTimeout(typeNextChar, 100);
    return () => clearTimeout(timer);
  }, [activePersona, activeData]);

  return (
    <section className="relative min-h-screen flex flex-col justify-start items-center overflow-hidden pt-32 sm:pt-40 pb-24 bg-transparent">
      
      {/* Mesh Gradient Background */}
      <div 
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.08), transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(168, 85, 247, 0.06), transparent 50%),
            radial-gradient(ellipse at 40% 80%, rgba(236, 72, 153, 0.04), transparent 50%)
          `
        }}
      />
      
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.4] pointer-events-none -z-10"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(99, 102, 241, 0.06) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />
      
      {/* Visual top border line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Animated Floating Orbs */}
      <motion.div
        className="absolute top-[15%] left-[15%] w-[300px] h-[300px] bg-indigo-500/[0.06] rounded-full blur-[100px] pointer-events-none -z-10"
        animate={{ 
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.2, 0.9, 1],
          opacity: [0.4, 0.7, 0.5, 0.4]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[25%] right-[10%] w-[250px] h-[250px] bg-purple-500/[0.05] rounded-full blur-[90px] pointer-events-none -z-10"
        animate={{ 
          x: [0, -30, 20, 0],
          y: [0, 40, -20, 0],
          scale: [1.1, 0.9, 1.1, 1.1],
          opacity: [0.3, 0.6, 0.4, 0.3]
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-[20%] left-[30%] w-[200px] h-[200px] bg-pink-500/[0.04] rounded-full blur-[80px] pointer-events-none -z-10"
        animate={{ 
          x: [0, 20, -30, 0],
          y: [0, -20, 30, 0],
          scale: [0.9, 1.1, 1, 0.9],
          opacity: [0.3, 0.5, 0.4, 0.3]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full text-center">
        
        {/* Texts Stack (Centered like Dreelio) */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto flex flex-col items-center gap-6"
        >
          {/* Eyebrow badge */}
          <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4.5 py-1.5 rounded-full text-xs font-black shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Personalized LinkedIn Outreach That Works</span>
          </div>

          {/* Heading (Dreelio Font Weight and Accents) */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.08]">
            LinkedIn outreach that<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 relative inline-block">
              actually gets replies
            </span>
          </h1>

          {/* Subtitle description */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-3xl leading-relaxed font-semibold">
            Qampi's AI copywriter analyzes target profile activity, posts, and company announcements to write unique, natural outreach sequences. No dry templates. Just organic connections.
          </p>

          {/* Button Row (Centered like Dreelio) */}
          <div className="flex flex-col sm:flex-row items-center gap-4.5 justify-center mt-3">
            <motion.a
              href="#sequence"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-black px-8 py-4 rounded-2xl text-sm shadow-[0_10px_30px_rgba(99,102,241,0.22)] hover:shadow-[0_12px_35px_rgba(99,102,241,0.32)] transition-all cursor-pointer"
            >
              Test outreach live
              <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
            </motion.a>
            <motion.a
              href="#pricing"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center font-black px-8 py-4 rounded-2xl text-sm text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm hover:shadow-md"
            >
              Start free trial
            </motion.a>
          </div>

          {/* Core Perks */}
          <div className="flex items-center justify-center space-x-6 text-xs text-slate-500 font-bold pt-4">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10B981]" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10B981]" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10B981]" />
              <span>Setup in 2 mins</span>
            </div>
          </div>
        </motion.div>

        {/* Dashboard Image / Container Mockup (Below content, centered, like Dreelio) */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, type: "spring", stiffness: 70, damping: 15 }}
          className="mt-16 sm:mt-20 max-w-5xl mx-auto relative group/mockup"
        >
          {/* External decorative grid lines (Dreelio Premium grid frame look) */}
          <div className="absolute -inset-x-8 -top-8 -bottom-8 border border-slate-200/40 rounded-[40px] pointer-events-none -z-10 hidden md:block" />
          <div className="absolute -inset-x-16 -top-16 -bottom-16 border border-slate-200/20 rounded-[48px] pointer-events-none -z-10 hidden md:block" />

          {/* Radial glow background around the mock */}
          <div className="absolute inset-0 bg-indigo-500/[0.04] rounded-[32px] blur-3xl opacity-60 pointer-events-none -z-10 group-hover/mockup:bg-indigo-500/[0.08] transition-colors duration-500" />

          {/* Animated gradient border wrapper */}
          <div className="absolute -inset-[1.5px] rounded-[28px] bg-[conic-gradient(from_var(--border-angle),#6366f1,#a855f7,#ec4899,#6366f1)] opacity-0 group-hover/mockup:opacity-100 transition-opacity duration-700 blur-[1px] pointer-events-none animate-rotate-border" style={{ "--border-angle": "0deg" } as React.CSSProperties} />
          
          {/* Main browser shell in Light Mode */}
          <div className="relative bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.04)] transition-all duration-300 hover:border-transparent hover:shadow-[0_40px_100px_rgba(99,102,241,0.12)]">
            
            {/* Browser Header Bar */}
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200/60 flex items-center justify-between">
              
              {/* Colored Dots */}
              <div className="flex space-x-1.5 shrink-0">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>

              {/* Sandbox URL */}
              <div className="hidden sm:block bg-white border border-slate-200 rounded-xl px-4 py-1 text-[11px] text-slate-500 font-mono tracking-wide w-80 text-center truncate shadow-sm">
                app.qampi.com/campaigns
              </div>
              
              {/* Persona Tabs right in the Hero Dashboard! */}
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/50">
                {(["Founder", "Engineering", "Sales"] as Persona[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePersona(p)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer",
                      activePersona === p
                        ? "bg-white text-slate-900 border border-slate-200/60 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Dashboard Content Body */}
            <div className="p-6 md:p-8 space-y-6 bg-white">
              
              {/* Stats list */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Outbox Size", value: activeData.leadsCount, icon: Users, color: "text-indigo-600", bgColor: "bg-indigo-50/50 border-indigo-100" },
                  { label: "Connections", value: activeData.connectedCount, icon: Target, color: "text-emerald-600", bgColor: "bg-emerald-50/50 border-emerald-100" },
                  { label: "Responses", value: activeData.repliesCount, icon: Mail, color: "text-amber-600", bgColor: "bg-amber-50/50 border-amber-100" },
                ].map((stat) => (
                  <div key={stat.label} className={cn("border rounded-2xl p-4 sm:p-5 text-center transition-all duration-300 hover:bg-white hover:border-slate-300 hover:shadow-sm", stat.bgColor)}>
                    <stat.icon className={cn("w-6 h-6 mx-auto mb-2.5", stat.color)} />
                    <p className="text-2xl sm:text-3xl font-black text-slate-900">{stat.value}</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Interactive Outreach Pipeline Map (Visual Workflow like Dreelio design style) */}
              <div className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-5 md:p-6 text-left relative overflow-hidden">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  Visual Outbound Pipeline Map
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                  
                  {/* Step 1 */}
                  <div className="relative bg-white border border-slate-200/80 shadow-sm rounded-xl p-4 flex flex-col gap-1 z-10">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Step 1</span>
                    <p className="text-xs font-black text-slate-950">Prospect Sync</p>
                    <p className="text-[10px] text-slate-500 leading-normal">Import lead files or Sales Nav results</p>
                  </div>

                  {/* Step 2 */}
                  <div className="relative bg-white border border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.06)] rounded-xl p-4 flex flex-col gap-1 z-10">
                    <span className="text-[9px] font-black text-purple-600 uppercase tracking-wider">Step 2</span>
                    <p className="text-xs font-black text-slate-950 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-purple-600" /> AI Research
                    </p>
                    <p className="text-[10px] text-slate-500 leading-normal">Collect profile bios and recent articles</p>
                  </div>

                  {/* Step 3 */}
                  <div className="relative bg-white border border-slate-200/80 shadow-sm rounded-xl p-4 flex flex-col gap-1 z-10">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Step 3</span>
                    <p className="text-xs font-black text-slate-950">Hyper-Personalized note</p>
                    <p className="text-[10px] text-slate-500 leading-normal">Write custom invite with icebreakers</p>
                  </div>

                  {/* Step 4 */}
                  <div className="relative bg-white border border-slate-200/80 shadow-sm rounded-xl p-4 flex flex-col gap-1 z-10">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Step 4</span>
                    <p className="text-xs font-black text-slate-950 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-amber-500" /> Warm Follow-Ups
                    </p>
                    <p className="text-[10px] text-slate-500 leading-normal">Pause sequence immediately on direct reply</p>
                  </div>

                </div>
              </div>

              {/* Active Campaign Completion Row */}
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-5 text-white shadow-[0_8px_30px_rgba(99,102,241,0.2)] relative overflow-hidden text-left">
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-90 bg-white/20 px-2 py-0.5 rounded-full">
                    Campaign Active
                  </span>
                  <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#34D399] animate-pulse" />
                </div>
                <p className="font-extrabold text-lg">{activeData.campaignName}</p>
                <div className="mt-4 flex items-center justify-between text-xs font-semibold">
                  <span className="opacity-95">Campaign Completion Progress</span>
                  <span className="font-bold">{activeData.progress}%</span>
                </div>
                <div className="mt-2 h-2 bg-white/25 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-white rounded-full" 
                    initial={{ width: 0 }}
                    animate={{ width: `${activeData.progress}%` }}
                    key={activePersona}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Qampi Live Copywriter Draft typing terminal */}
              <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-5 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6.5 h-6.5 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <span className="text-[11px] font-black text-slate-700 tracking-wide">
                    Qampi personalized draft for {activeData.lead}:
                  </span>
                  <div className="ml-auto flex space-x-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                         key={i}
                         className="w-1.5 h-1.5 bg-indigo-500 rounded-full"
                         animate={{ opacity: [0.3, 1, 0.3] }}
                         transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4.5 min-h-[76px] shadow-sm">
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold">
                    "{typedMessage}"
                    {typedMessage.length < activeData.aiMessage.length && (
                      <span className="w-1.5 h-3.5 bg-indigo-600 inline-block animate-pulse ml-0.5" />
                    )}
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* Floating dynamic status badges */}
          <motion.div
            animate={{ y: [-6, 6, -6] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-6 -right-6 bg-white border border-slate-200/80 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-4.5 backdrop-blur-md z-20 text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <Mail className="w-4.5 h-4.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">Lead Connected!</p>
                <p className="text-[10px] font-bold text-slate-400">Just now</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [6, -6, 6] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute -bottom-6 -left-6 bg-white border border-slate-200/80 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-4.5 backdrop-blur-md z-20 text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center shrink-0">
                <Sparkles className="w-4.5 h-4.5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">+38% Outbound Gain</p>
                <p className="text-[10px] font-bold text-slate-400">Powered by Qampi</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
