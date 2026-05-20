'use client';

import { motion } from "framer-motion";
import { Brain, Search, Send, ArrowRight, Sparkles } from "lucide-react";
import { GlowButton } from "./GlowButton";

const steps = [
  {
    icon: Brain,
    number: "01",
    title: "Aigeon learns your voice",
    description: "Upload a few samples of your writing — emails, LinkedIn posts, or messages. Aigeon fine-tunes to your tone, style, and personality. It sounds like you, not a robot.",
    gradient: "from-purple-500 via-indigo-500 to-blue-500",
    visual: "voice",
    image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&h=400&auto=format&fit=crop&q=80",
  },
  {
    icon: Search,
    number: "02",
    title: "Aigeon researches every prospect",
    description: "Before sending, Aigeon reads the prospect's profile, recent posts, company news, and mutual connections. It finds the hook that makes them want to reply.",
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    visual: "research",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&auto=format&fit=crop&q=80",
  },
  {
    icon: Send,
    number: "03",
    title: "Aigeon crafts personalized messages",
    description: "Every message is unique. No templates. No copy-paste. Just a real conversation starter that references something the prospect actually cares about.",
    gradient: "from-amber-500 via-orange-500 to-red-500",
    visual: "message",
    image: "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=600&h=400&auto=format&fit=crop&q=80",
  },
];

function StepVisual({ visual, gradient, image }: { visual: string; gradient: string; image: string }) {
  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-3xl">
      {/* Background image */}
      <img
        src={image}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-80`} />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '20px 20px'
      }} />

      {visual === "voice" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="w-full max-w-[200px] space-y-3">
            {["Email sample uploaded", "LinkedIn post analyzed", "Voice profile created"].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.3 }}
                className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/20"
              >
                <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <span className="text-white text-xs font-medium">{item}</span>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1 }}
              className="bg-white/30 backdrop-blur-sm rounded-xl p-4 text-center border border-white/30"
            >
              <Sparkles className="w-6 h-6 text-white mx-auto mb-2" />
              <p className="text-white text-xs font-bold">Voice Profile Ready</p>
            </motion.div>
          </div>
        </div>
      )}

      {visual === "research" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="relative w-full max-w-[200px]">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/20 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-white/50 rounded-full" />
                </div>
                <div>
                  <div className="h-2 bg-white/40 rounded-full w-20 mb-1" />
                  <div className="h-1.5 bg-white/25 rounded-full w-14" />
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Recent post", color: "bg-emerald-400/40" },
                  { label: "Company news", color: "bg-blue-400/40" },
                  { label: "Mutual connections", color: "bg-amber-400/40" },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center gap-2 ${item.color} rounded-lg px-2 py-1.5`}>
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    <span className="text-white text-[10px] font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-10 h-10 bg-white/30 rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {visual === "message" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="w-full max-w-[220px] space-y-3">
            {[
              { align: "left", text: "Hey Sarah, loved your post about scaling SaaS..." },
              { align: "right", text: "That's exactly what we help with!" },
              { align: "left", text: "Would love to share our playbook..." },
            ].map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.4 }}
                className={`flex ${msg.align === "right" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[160px] bg-white/25 backdrop-blur-sm rounded-2xl p-3 ${msg.align === "right" ? "rounded-br-md" : "rounded-bl-md"}`}>
                  <p className="text-white text-[10px] leading-relaxed">{msg.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function HowAigeonWorks() {
  return (
    <section className="py-24 lg:py-32 bg-white relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Sparkles className="w-4 h-4" />
            How Aigeon Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            3 steps from stranger to{" "}
            <span className="text-primary">conversation</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Aigeon doesn't guess. It researches, learns, and writes — so you don't have to.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="group"
            >
              {/* Step number */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl font-black text-primary/20">{step.number}</span>
                <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
              </div>

              {/* Visual */}
              <div className="mb-6 rounded-3xl overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <StepVisual visual={step.visual} gradient={step.gradient} image={step.image} />
              </div>

              {/* Content */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-black text-slate-900">{step.title}</h3>
              </div>

              <p className="text-slate-600 leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Bottom banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-r from-slate-50 to-purple-50 rounded-2xl p-6 lg:p-8 border border-slate-200"
        >
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="text-center lg:text-left">
              <p className="text-lg font-bold text-slate-900">
                Free: 25 Aigeon messages/week (Fast model)
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Upgrade to Aigeon Pro for advanced reasoning and deeper personalization
              </p>
            </div>
            <GlowButton href="https://app.qampi.com/register">
              See all plans
              <ArrowRight className="w-4 h-4 ml-2" />
            </GlowButton>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
