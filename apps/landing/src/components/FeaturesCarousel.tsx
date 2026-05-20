'use client';

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Shield, BarChart3, MessageSquare, Zap, Users, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    id: "ai-messages",
    label: "Aigeon AI Messages",
    icon: Bot,
    description: "Our AI is fine-tuned on your writing style and company context. Every message sounds like you — not a template. Free users get 25 messages/week with Aigeon Fast.",
    gradient: "from-purple-500 via-indigo-500 to-blue-500",
    pattern: "ai",
  },
  {
    id: "aigeon-pro",
    label: "Aigeon Pro",
    icon: Brain,
    description: "Unlock our largest AI models for deep prospect research, intent signal detection, and multi-layered personalization. Aigeon Pro doesn't just read profiles — it understands them.",
    gradient: "from-violet-500 via-fuchsia-500 to-pink-500",
    pattern: "pro",
  },
  {
    id: "safe-automation",
    label: "Safe & Human-Like",
    icon: Shield,
    description: "Stay within LinkedIn limits with randomized delays, human-like behavior patterns, and automatic pause on detection.",
    gradient: "from-emerald-500 via-green-500 to-teal-500",
    pattern: "shield",
  },
  {
    id: "smart-analytics",
    label: "Smart Analytics",
    icon: BarChart3,
    description: "Track reply rates, connection acceptance, and campaign performance. Know what works and optimize in real-time.",
    gradient: "from-amber-500 via-orange-500 to-red-500",
    pattern: "chart",
  },
  {
    id: "auto-followup",
    label: "AI Auto Follow-Up",
    icon: MessageSquare,
    description: "AI-powered follow-up sequences that adapt based on prospect behavior. If they viewed your profile but didn't reply, Aigeon adjusts the next message accordingly.",
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    pattern: "followup",
  },
  {
    id: "smart-campaigns",
    label: "Smart Campaigns",
    icon: Zap,
    description: "Build multi-step campaigns with visual builder. Combine visits, likes, connection requests, and messages.",
    gradient: "from-violet-500 via-purple-500 to-pink-500",
    pattern: "campaign",
  },
  {
    id: "team-collab",
    label: "Team Collaboration",
    icon: Users,
    description: "Share lead lists, coordinate outreach, and avoid duplicate messaging. Perfect for sales teams of any size.",
    gradient: "from-indigo-500 via-blue-500 to-cyan-500",
    pattern: "team",
  },
];

const AUTO_PLAY_INTERVAL = 3500;
const ITEM_HEIGHT = 72;

const wrap = (min: number, max: number, v: number) => {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
};

function FeatureVisual({ pattern, gradient }: { pattern: string; gradient: string }) {
  return (
    <div className={`w-full aspect-[4/3] bg-gradient-to-br ${gradient} relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem]`}>
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '24px 24px'
      }} />

      {/* Floating orbs */}
      <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute bottom-1/3 left-1/4 w-24 h-24 bg-white/10 rounded-full blur-xl" />

      {pattern === "ai" && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="w-full max-w-[280px]">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/20 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/30 rounded-xl flex items-center justify-center">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <div className="h-2.5 bg-white/40 rounded-full w-24 mb-1.5" />
                  <div className="h-2 bg-white/25 rounded-full w-16" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-white/30 rounded-full w-full" />
                <div className="h-2 bg-white/30 rounded-full w-5/6" />
                <div className="h-2 bg-white/30 rounded-full w-4/6" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/15 rounded-xl p-3">
                <div className="h-2 bg-white/25 rounded-full w-12 mb-2" />
                <div className="h-2 bg-white/20 rounded-full w-full" />
              </div>
              <div className="flex-1 bg-white/15 rounded-xl p-3">
                <div className="h-2 bg-white/25 rounded-full w-12 mb-2" />
                <div className="h-2 bg-white/20 rounded-full w-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {pattern === "pro" && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="w-full max-w-[280px]">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/20 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/30 rounded-xl flex items-center justify-center">
                  <Brain size={20} className="text-white" />
                </div>
                <div>
                  <div className="h-2.5 bg-white/40 rounded-full w-28 mb-1.5" />
                  <div className="h-2 bg-white/25 rounded-full w-20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["Profile", "Posts", "Company", "Intent"].map((item) => (
                  <div key={item} className="bg-white/15 rounded-lg p-2 text-center">
                    <div className="h-2 bg-white/30 rounded-full w-12 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <div className="h-2 bg-white/25 rounded-full w-full mb-2" />
              <div className="h-2 bg-white/20 rounded-full w-5/6 mb-2" />
              <div className="h-2 bg-white/20 rounded-full w-4/6" />
            </div>
          </div>
        </div>
      )}

      {pattern === "shield" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/20">
              <Shield size={48} className="text-white" />
            </div>
            <div className="absolute -top-3 -right-3 w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-full" />
            </div>
            <div className="absolute -bottom-2 -left-2 bg-white/15 rounded-lg px-3 py-1.5">
              <div className="h-2 bg-white/40 rounded-full w-16" />
            </div>
          </div>
        </div>
      )}

      {pattern === "chart" && (
        <div className="absolute inset-0 p-6 flex flex-col justify-end">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/20 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="h-3 bg-white/40 rounded-full w-20" />
              <div className="h-3 bg-white/30 rounded-full w-12" />
            </div>
            <div className="flex items-end gap-2 h-28">
              {[35, 55, 40, 75, 50, 85, 65, 90].map((h, i) => (
                <div key={i} className="flex-1 bg-white/30 rounded-t-lg transition-all" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-white/15 rounded-xl p-3">
              <div className="h-2 bg-white/30 rounded-full w-10 mb-2" />
              <div className="h-4 bg-white/40 rounded-full w-14" />
            </div>
            <div className="flex-1 bg-white/15 rounded-xl p-3">
              <div className="h-2 bg-white/30 rounded-full w-10 mb-2" />
              <div className="h-4 bg-white/40 rounded-full w-14" />
            </div>
            <div className="flex-1 bg-white/15 rounded-xl p-3">
              <div className="h-2 bg-white/30 rounded-full w-10 mb-2" />
              <div className="h-4 bg-white/40 rounded-full w-14" />
            </div>
          </div>
        </div>
      )}

      {pattern === "followup" && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="w-full max-w-[260px] space-y-3">
            {[
              { align: "right", width: "w-48" },
              { align: "left", width: "w-40" },
              { align: "right", width: "w-44" },
              { align: "left", width: "w-36" },
            ].map((msg, i) => (
              <div key={i} className={`flex ${msg.align === "right" ? "justify-end" : "justify-start"}`}>
                <div className={`${msg.width} bg-white/25 backdrop-blur-sm rounded-2xl p-3`}>
                  <div className="h-2 bg-white/40 rounded-full w-full mb-1.5" />
                  <div className="h-2 bg-white/25 rounded-full w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pattern === "campaign" && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="w-full max-w-[300px]">
            <div className="flex items-center gap-3 mb-4">
              {["Visit", "Connect", "Message", "Follow"].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="bg-white/25 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
                    <div className="h-2 bg-white/40 rounded-full w-12" />
                  </div>
                  {i < 3 && <div className="w-4 h-0.5 bg-white/30" />}
                </div>
              ))}
            </div>
            <div className="bg-white/15 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center">
                  <Zap size={12} className="text-white" />
                </div>
                <div className="h-2 bg-white/30 rounded-full w-20" />
              </div>
              <div className="h-2 bg-white/20 rounded-full w-full mb-2" />
              <div className="h-2 bg-white/20 rounded-full w-5/6" />
            </div>
          </div>
        </div>
      )}

      {pattern === "team" && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="w-full max-w-[280px]">
            <div className="flex -space-x-3 mb-6 justify-center">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-12 h-12 bg-white/25 backdrop-blur-sm rounded-full border-2 border-white/20 flex items-center justify-center">
                  <div className="w-5 h-5 bg-white/40 rounded-full" />
                </div>
              ))}
            </div>
            <div className="bg-white/15 rounded-2xl p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-2 bg-white/30 rounded-full w-24 mb-1.5" />
                    <div className="h-2 bg-white/20 rounded-full w-16" />
                  </div>
                  <div className="w-6 h-6 bg-white/25 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FeaturesCarousel() {
  const [step, setStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentIndex = ((step % FEATURES.length) + FEATURES.length) % FEATURES.length;

  const nextStep = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const handleChipClick = (index: number) => {
    const diff = (index - currentIndex + FEATURES.length) % FEATURES.length;
    if (diff > 0) setStep((s) => s + diff);
  };

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextStep, AUTO_PLAY_INTERVAL);
    return () => clearInterval(interval);
  }, [nextStep, isPaused]);

  const getCardStatus = (index: number) => {
    const diff = index - currentIndex;
    const len = FEATURES.length;
    let normalizedDiff = diff;
    if (diff > len / 2) normalizedDiff -= len;
    if (diff < -len / 2) normalizedDiff += len;
    if (normalizedDiff === 0) return "active";
    if (normalizedDiff === -1) return "prev";
    if (normalizedDiff === 1) return "next";
    return "hidden";
  };

  return (
    <section id="features" className="py-24 lg:py-32 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-100/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4"
          >
            Features
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight"
          >
            Everything you need to{" "}
            <span className="text-primary">scale outreach</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto"
          >
            Powerful features designed to help you connect with the right people and start meaningful conversations.
          </motion.p>
        </div>

        {/* Carousel Container */}
        <div className="relative overflow-hidden rounded-[2.5rem] lg:rounded-[4rem] flex flex-col lg:flex-row min-h-[600px] lg:aspect-video min-h-[600px] border border-slate-200/60 shadow-xl shadow-slate-200/30">
          {/* Left Side - Feature List */}
          <div className="w-full lg:w-[40%] min-h-[350px] md:min-h-[450px] lg:h-full relative z-30 flex flex-col items-start justify-center overflow-hidden px-6 md:px-10 lg:pl-12 bg-gradient-to-br from-primary via-indigo-600 to-purple-700">
            {/* Top gradient fade */}
            <div className="absolute inset-x-0 top-0 h-16 md:h-24 lg:h-20 bg-gradient-to-b from-primary via-primary/80 to-transparent z-40" />
            {/* Bottom gradient fade */}
            <div className="absolute inset-x-0 bottom-0 h-16 md:h-24 lg:h-20 bg-gradient-to-t from-purple-700 via-purple-700/80 to-transparent z-40" />

            <div className="relative w-full h-full flex items-center justify-center lg:justify-start z-20">
              {FEATURES.map((feature, index) => {
                const isActive = index === currentIndex;
                const distance = index - currentIndex;
                const wrappedDistance = wrap(-(FEATURES.length / 2), FEATURES.length / 2, distance);

                return (
                  <motion.div
                    key={feature.id}
                    style={{ height: ITEM_HEIGHT, width: "fit-content" }}
                    animate={{
                      y: wrappedDistance * ITEM_HEIGHT,
                      opacity: 1 - Math.abs(wrappedDistance) * 0.25,
                    }}
                    transition={{ type: "spring", stiffness: 90, damping: 22, mass: 1 }}
                    className="absolute flex items-center justify-start"
                  >
                    <button
                      onClick={() => handleChipClick(index)}
                      onMouseEnter={() => setIsPaused(true)}
                      onMouseLeave={() => setIsPaused(false)}
                      className={cn(
                        "relative flex items-center gap-3 md:gap-4 px-5 md:px-8 py-3 md:py-4 rounded-full transition-all duration-700 text-left group border",
                        isActive
                          ? "bg-white text-primary border-white z-10 shadow-lg"
                          : "bg-transparent text-white/60 border-white/20 hover:border-white/40 hover:text-white"
                      )}
                    >
                      <div className={cn("flex items-center justify-center transition-colors duration-500", isActive ? "text-primary" : "text-white/40")}>
                        <feature.icon size={18} strokeWidth={2} />
                      </div>
                      <span className="font-semibold text-sm md:text-[15px] tracking-tight whitespace-nowrap">
                        {feature.label}
                      </span>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right Side - Visual Display */}
          <div className="flex-1 min-h-[400px] md:min-h-[500px] lg:h-full relative bg-slate-50 flex items-center justify-center py-12 md:py-16 px-6 md:px-10 overflow-hidden border-t lg:border-t-0 lg:border-l border-slate-200/60">
            <div className="relative w-full max-w-[480px] aspect-[4/3] flex items-center justify-center">
              {FEATURES.map((feature, index) => {
                const status = getCardStatus(index);
                const isActive = status === "active";
                const isPrev = status === "prev";
                const isNext = status === "next";

                return (
                  <motion.div
                    key={feature.id}
                    initial={false}
                    animate={{
                      x: isActive ? 0 : isPrev ? -80 : isNext ? 80 : 0,
                      scale: isActive ? 1 : isPrev || isNext ? 0.88 : 0.75,
                      opacity: isActive ? 1 : isPrev || isNext ? 0.5 : 0,
                      rotate: isPrev ? -2 : isNext ? 2 : 0,
                      zIndex: isActive ? 20 : isPrev || isNext ? 10 : 0,
                      pointerEvents: isActive ? "auto" : "none",
                    }}
                    transition={{ type: "spring", stiffness: 260, damping: 25, mass: 0.8 }}
                    className="absolute inset-0 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border-4 border-white bg-white origin-center shadow-xl"
                  >
                    <FeatureVisual pattern={feature.pattern} gradient={feature.gradient} />

                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute inset-x-0 bottom-0 p-6 md:p-8 pt-24 md:pt-32 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end pointer-events-none"
                        >
                          <div className="bg-white/10 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] w-fit mb-3 border border-white/20">
                            {feature.label}
                          </div>
                          <p className="text-white font-medium text-base md:text-lg leading-snug">
                            {feature.description}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
