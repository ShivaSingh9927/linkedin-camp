'use client';

import { 
  Zap, 
  Clock, 
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  Database,
  BarChart3,
  Send,
  Bot,
  Users,
  Target,
  Cpu
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={cn("relative", className)}
    >
      {children}
    </motion.div>
  );
}

function GradientBorderCard({ children, className, gradient = "from-indigo-500 via-purple-500 to-pink-500" }: { 
  children: React.ReactNode; 
  className?: string;
  gradient?: string;
}) {
  return (
    <div className={cn("relative group", className)}>
      {/* Animated gradient border */}
      <div className={cn(
        "absolute -inset-[1px] rounded-[inherit] bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[1px]",
        gradient
      )} />
      <div className="relative bg-white rounded-[inherit]">
        {children}
      </div>
    </div>
  );
}

export function FeaturesGridV2() {
  return (
    <section id="features" className="py-24 sm:py-32 bg-white relative overflow-hidden">
      
      {/* Background visual glows */}
      <div className="absolute top-1/4 left-1/10 w-[500px] h-[500px] bg-indigo-500/[0.02] rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/10 w-[600px] h-[600px] bg-purple-500/[0.02] rounded-full blur-[160px] pointer-events-none -z-10" />
      
      {/* Section Divider Line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <span className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4.5 py-1.5 rounded-full text-xs font-black mb-4.5 shadow-sm">
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
            <span>Outbound Re-engineered</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
            Outbound pipelines that<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
              run on autopilot
            </span>
          </h2>
          <p className="mt-4.5 text-base sm:text-lg text-slate-600 font-semibold max-w-2xl mx-auto leading-relaxed">
            Move prospects from cold lists to positive conversations automatically using contextual personalization.
          </p>
        </motion.div>

        {/* ==================== BENTO GRID ==================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          
          {/* === LARGE FEATURE CARD (spans 2 cols) === */}
          <TiltCard className="lg:col-span-2">
            <GradientBorderCard className="rounded-3xl h-full">
              <div className="p-8 lg:p-10 h-full">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm mb-4">
                      <span>Campaign Automation</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                      Automate your LinkedIn outbound pipelines
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                </div>
                
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-semibold mb-6">
                  Import lead lists, set up multi-step touchpoint flows, and let Qampi handle the rest. Sync connections and handle replies directly from our inbox console.
                </p>

                {/* Feature Pills */}
                <div className="flex flex-wrap gap-2.5 mb-8">
                  {["LinkedIn Sync", "Persona Selector", "AI Copywriting", "Outbox Queue"].map((pill) => (
                    <div key={pill} className="bg-slate-50 border border-slate-200/80 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs hover:border-slate-300 hover:bg-slate-100/50 transition-all shadow-sm">
                      {pill}
                    </div>
                  ))}
                </div>

                {/* Browser Mockup */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200/60 bg-white rounded-t-xl">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <div className="ml-3 bg-slate-50 border border-slate-100 text-[9px] text-slate-400 font-bold px-3 py-0.5 rounded-md text-center truncate">
                      qampi.com/personalization
                    </div>
                  </div>
                  <div className="bg-white rounded-b-xl h-32 flex items-center justify-center">
                    <img 
                      src="/qampi-personalization-light.png" 
                      alt="Qampi AI Personalization" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center h-full"><span class="text-slate-300 font-bold text-sm">Personalization Dashboard</span></div>';
                      }}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <a href="#trial" className="group inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors">
                    <span>Start outreach campaign</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            </GradientBorderCard>
          </TiltCard>

          {/* === STAT CARD (gradient bg) === */}
          <TiltCard>
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 h-full text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <p className="text-5xl font-black mb-2 tracking-tight">34%</p>
                <p className="text-sm font-bold text-white/80">Average reply rate</p>
                <p className="text-xs text-white/60 mt-2">vs 4.8% industry average</p>
                <div className="mt-6 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-white rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: "34%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </TiltCard>

          {/* === AI FEATURE CARD === */}
          <TiltCard>
            <GradientBorderCard className="rounded-3xl h-full" gradient="from-purple-500 to-pink-500">
              <div className="p-8 h-full">
                <div className="w-12 h-12 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <Bot className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="text-xl font-black text-slate-900 mb-3 tracking-tight">
                  AI personalization that mimics you
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                  Qampi's context engine studies recent target posts, comments, and profile summaries. It drafts custom outreach messages that sound entirely organic.
                </p>
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs font-black">AI</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        initial={{ width: 0 }}
                        whileInView={{ width: "92%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-xs font-black text-slate-700">92%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-semibold">Personalization accuracy score</p>
                </div>
              </div>
            </GradientBorderCard>
          </TiltCard>

          {/* === INTEGRATIONS CARD === */}
          <TiltCard>
            <GradientBorderCard className="rounded-3xl h-full" gradient="from-emerald-500 to-teal-500">
              <div className="p-8 h-full">
                <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <Database className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="text-xl font-black text-slate-900 mb-3 tracking-tight">
                  Seamless tech stack integration
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                  Connect Qampi with your HubSpot, Salesforce, or native CRM. Keep your sales pipelines synced automatically.
                </p>
                <div className="mt-6 grid grid-cols-4 gap-2">
                  {["HubSpot", "Salesforce", "Zapier", "Slack"].map((name) => (
                    <div key={name} className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 flex items-center justify-center">
                      <span className="text-[9px] font-black text-slate-500">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GradientBorderCard>
          </TiltCard>

          {/* === OUTBOX CARD (spans 2 cols) === */}
          <TiltCard className="lg:col-span-2">
            <GradientBorderCard className="rounded-3xl h-full" gradient="from-amber-500 to-orange-500">
              <div className="p-8 lg:p-10 h-full">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="inline-flex items-center space-x-2 bg-amber-50 border border-amber-100 text-amber-600 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm mb-4">
                      <span>Smart Outbox Console</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                      Track response rates and conversions live
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                </div>
                
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-semibold mb-6">
                  Get an aggregated view of your outbound campaign metrics. Monitor connection acceptance rates, response rates, and positive intent replies at a glance.
                </p>

                {/* Browser Mockup */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200/60 bg-white rounded-t-xl">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <div className="ml-3 bg-slate-50 border border-slate-100 text-[9px] text-slate-400 font-bold px-3 py-0.5 rounded-md text-center truncate">
                      qampi.com/outbox
                    </div>
                  </div>
                  <div className="bg-white rounded-b-xl h-32 flex items-center justify-center">
                    <img 
                      src="/qampi-outbox-light.png" 
                      alt="Qampi Outbox Dashboard" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center h-full"><span class="text-slate-300 font-bold text-sm">Outbox Dashboard</span></div>';
                      }}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <a href="#trial" className="group inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors">
                    <span>Check your dashboard</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            </GradientBorderCard>
          </TiltCard>

          {/* === THREE SMALL CARDS === */}
          {[
            {
              title: "Campaign Scheduling",
              desc: "Define exactly when your messages go out. Set optimal delivery windows aligned with your target's local working hours.",
              icon: Clock,
              gradient: "from-indigo-500 to-blue-500",
              iconBg: "bg-indigo-50 border-indigo-100 text-indigo-600"
            },
            {
              title: "Smart Anti-Detection",
              desc: "Randomized intervals and human-like typing behaviors guarantee your LinkedIn account stays safe and compliant.",
              icon: Shield,
              gradient: "from-purple-500 to-violet-500",
              iconBg: "bg-purple-50 border-purple-100 text-purple-600"
            },
            {
              title: "Multi-Persona Selection",
              desc: "Target founders, developers, or sales reps. Customize dynamic search parameters to segment and adapt sequences.",
              icon: Users,
              gradient: "from-pink-500 to-rose-500",
              iconBg: "bg-pink-50 border-pink-100 text-pink-600"
            }
          ].map((card, idx) => (
            <TiltCard key={idx}>
              <GradientBorderCard className="rounded-3xl h-full" gradient={card.gradient}>
                <div className="p-7 h-full">
                  <div className={cn("w-11 h-11 border rounded-2xl flex items-center justify-center mb-5 shadow-sm", card.iconBg)}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <h5 className="text-base font-black text-slate-900 mb-2 tracking-tight">{card.title}</h5>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">{card.desc}</p>
                </div>
              </GradientBorderCard>
            </TiltCard>
          ))}

        </div>

      </div>
    </section>
  );
}
