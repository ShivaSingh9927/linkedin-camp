'use client';

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Send, BarChart3, Database, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Find buyers on LinkedIn",
    description: "Build qualified lead lists from real, up-to-date LinkedIn profiles. Use LinkedIn Search, Sales Navigator, or import your own database.",
    features: ["Target by intent signals", "No external database needed", "Always up-to-date profiles"],
    gradient: "from-purple-400 via-indigo-500 to-blue-500",
    pattern: "search",
    image: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600&h=400&auto=format&fit=crop&q=80",
  },
  {
    number: "02",
    icon: Send,
    title: "Launch personal outreach",
    description: "Send connection requests, messages, and follow-ups that spark real conversations with 99+ ready-to-use templates.",
    features: ["Automated follow-ups", "Human-like timing", "Stay within LinkedIn limits"],
    gradient: "from-blue-400 via-cyan-500 to-teal-500",
    pattern: "messages",
    image: "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=600&h=400&auto=format&fit=crop&q=80",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "See what gets replies",
    description: "Know exactly what works so you can double down. Track reply rates, sentiment, and performance at a glance.",
    features: ["Reply rate benchmarks", "Visual sentiment analysis", "Clear performance dashboard"],
    gradient: "from-amber-400 via-orange-500 to-red-500",
    pattern: "analytics",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&auto=format&fit=crop&q=80",
  },
  {
    number: "04",
    icon: Database,
    title: "Sync with your CRM",
    description: "Push qualified conversations straight into your stack. HubSpot, Pipedrive & 2,000+ integrations available.",
    features: ["Auto-enrich leads", "Full CSV export", "2,000+ integrations"],
    gradient: "from-emerald-400 via-green-500 to-teal-600",
    pattern: "sync",
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&h=400&auto=format&fit=crop&q=80",
  },
];

function StepVisual({ pattern, gradient, image }: { pattern: string; gradient: string; image: string }) {
  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-3xl">
      {/* Background image */}
      <img
        src={image}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-75`} />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '24px 24px'
      }} />

      {pattern === "search" && (
        <div className="absolute top-8 left-8 right-8">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
                <Search size={16} className="text-white" />
              </div>
              <div className="h-3 bg-white/30 rounded-full w-32" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 bg-white/10 rounded-lg p-2">
                  <div className="w-8 h-8 bg-white/20 rounded-full" />
                  <div className="flex-1">
                    <div className="h-2 bg-white/30 rounded-full w-24 mb-1" />
                    <div className="h-2 bg-white/20 rounded-full w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pattern === "messages" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48">
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="bg-white/30 backdrop-blur-sm rounded-2xl rounded-br-md p-3 max-w-[180px]">
                <div className="h-2 bg-white/50 rounded-full w-full mb-1" />
                <div className="h-2 bg-white/30 rounded-full w-3/4" />
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl rounded-bl-md p-3 max-w-[180px]">
                <div className="h-2 bg-white/40 rounded-full w-full mb-1" />
                <div className="h-2 bg-white/25 rounded-full w-2/3" />
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-white/30 backdrop-blur-sm rounded-2xl rounded-br-md p-3 max-w-[180px]">
                <div className="h-2 bg-white/50 rounded-full w-5/6" />
              </div>
            </div>
          </div>
        </div>
      )}

      {pattern === "analytics" && (
        <div className="absolute top-6 left-6 right-6">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="h-3 bg-white/40 rounded-full w-20" />
              <div className="h-3 bg-white/30 rounded-full w-12" />
            </div>
            <div className="flex items-end gap-2 h-24">
              {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                <div key={i} className="flex-1 bg-white/30 rounded-t-lg" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {pattern === "sync" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-6">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
            <Database size={28} className="text-white" />
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-12 h-1 bg-white/30 rounded-full" />
            ))}
          </div>
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
            <CheckCircle2 size={28} className="text-white" />
          </div>
        </div>
      )}
    </div>
  );
}

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveStep((s) => (s + 1) % steps.length);
          return 0;
        }
        return prev + 2;
      });
    }, 60);
    return () => clearInterval(interval);
  }, []);

  const currentStep = steps[activeStep];
  const Icon = currentStep.icon;

  return (
    <section id="how-it-works" ref={sectionRef} className="py-24 lg:py-32 bg-slate-950 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block bg-primary/20 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4"
          >
            How It Works
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight"
          >
            Start getting replies in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400">4 simple steps</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto"
          >
            From first lead to first reply, Qampi guides you at every step.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Step Navigation */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isActive = index === activeStep;
              const StepIcon = step.icon;

              return (
                <motion.button
                  key={step.number}
                  onClick={() => {
                    setActiveStep(index);
                    setProgress(0);
                  }}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "w-full text-left p-5 md:p-6 rounded-2xl transition-all duration-500 group relative overflow-hidden",
                    isActive
                      ? "bg-white/10 backdrop-blur-sm border border-primary/30 shadow-lg shadow-primary/10"
                      : "bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10"
                  )}
                >
                  {/* Active indicator line */}
                  {isActive && (
                    <motion.div
                      className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-indigo-400"
                      layoutId="activeIndicator"
                    />
                  )}

                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500",
                      isActive
                        ? "bg-primary text-white shadow-lg shadow-primary/30"
                        : "bg-white/10 text-slate-400 group-hover:text-white"
                    )}>
                      <StepIcon size={22} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          isActive ? "text-primary" : "text-slate-500"
                        )}>
                          Step {step.number}
                        </span>
                        {isActive && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 3, ease: "linear" }}
                            className="h-0.5 bg-primary/30 rounded-full overflow-hidden"
                          >
                            <motion.div
                              className="h-full bg-primary"
                              style={{ width: `${progress}%` }}
                            />
                          </motion.div>
                        )}
                      </div>
                      <h3 className={cn(
                        "text-lg font-bold transition-colors duration-300",
                        isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                      )}>
                        {step.title}
                      </h3>
                      <p className={cn(
                        "text-sm mt-1 transition-colors duration-300",
                        isActive ? "text-slate-300" : "text-slate-500"
                      )}>
                        {step.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className={cn(
                      "w-5 h-5 flex-shrink-0 mt-1 transition-all duration-300",
                      isActive ? "text-primary translate-x-0" : "text-slate-600 -translate-x-2 opacity-0"
                    )} />
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Right - Visual Display */}
          <div className="relative">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative"
            >
              {/* Main visual */}
              <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                <StepVisual pattern={currentStep.pattern} gradient={currentStep.gradient} image={currentStep.image} />

                {/* Overlay content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                      <Icon size={16} className="text-white" />
                    </div>
                    <span className="text-primary text-sm font-bold uppercase tracking-wider">
                      Step {currentStep.number}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white mb-2">
                    {currentStep.title}
                  </h3>
                  <p className="text-slate-300 text-sm md:text-base">
                    {currentStep.description}
                  </p>
                </div>
              </div>

              {/* Feature pills */}
              <div className="absolute -bottom-6 left-6 right-6 flex flex-wrap gap-2">
                {currentStep.features.map((feature, i) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2"
                  >
                    <CheckCircle2 size={14} className="text-primary" />
                    <span className="text-white text-xs font-medium">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
