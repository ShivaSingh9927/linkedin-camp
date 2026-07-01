'use client';

import { useState } from "react";
import { ArrowRight, Check, Sparkles, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlowButton } from "./GlowButton";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    priceMonthly: "0",
    priceYearly: "0",
    period: "forever",
    description: "Try Qampi AI and see the power of personalized outreach.",
    features: [
      "25 AI messages / week",
      "Qampi Fast model (optimized)",
      "Profile-level personalization",
      "1 AI follow-up step",
      "2 active campaigns",
      "Basic response analytics",
      "Community support",
    ],
    cta: "Start Free",
    popular: false,
    free: true,
    accent: "from-blue-500/10 to-indigo-500/10",
    accentLight: "bg-blue-500/5 text-blue-600",
    glowColor: "rgba(59, 130, 246, 0.15)",
  },
  {
    name: "Starter",
    priceMonthly: "49",
    priceYearly: "39",
    period: "month",
    description: "Perfect for solo founders getting started with LinkedIn outreach.",
    features: [
      "500 AI messages / week",
      "Qampi Pro model (reasoning)",
      "Profile + company context",
      "3 AI follow-up steps",
      "10 active campaigns",
      "Advanced analytics dashboard",
      "Standard email support",
    ],
    cta: "Start Free Trial",
    popular: false,
    free: false,
    accent: "from-indigo-500/10 to-violet-500/10",
    accentLight: "bg-indigo-500/5 text-indigo-600",
    glowColor: "rgba(99, 102, 241, 0.15)",
  },
  {
    name: "Growth",
    priceMonthly: "99",
    priceYearly: "79",
    period: "month",
    description: "For growing teams that need more power and collaboration.",
    features: [
      "2,000 AI messages / week",
      "Qampi Pro + deep research",
      "Intent signal detection",
      "Unlimited AI follow-ups",
      "Unlimited campaigns",
      "Team workspace & collaboration",
      "CRM native integrations",
      "Priority priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
    free: false,
    accent: "from-violet-600 to-indigo-600",
    accentLight: "bg-amber-400 text-slate-900",
    glowColor: "rgba(139, 92, 246, 0.3)",
  },
  {
    name: "Enterprise",
    priceMonthly: "249",
    priceYearly: "199",
    period: "month",
    description: "For large teams with advanced needs and custom requirements.",
    features: [
      "Unlimited AI messages",
      "Custom model fine-tuning",
      "Full research + custom training",
      "Unlimited adaptive follow-ups",
      "Unlimited campaigns",
      "White-label reports",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
    free: false,
    accent: "from-purple-500/10 to-pink-500/10",
    accentLight: "bg-purple-500/5 text-purple-600",
    glowColor: "rgba(168, 85, 247, 0.15)",
  },
];

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="py-24 lg:py-32 bg-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-indigo-500/5 via-purple-500/3 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 left-10 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 relative">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-indigo-100"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Pricing Plans
          </motion.span>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none"
          >
            Flexible plans built to{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">scale outreach</span>
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-5 text-lg text-slate-500 max-w-xl mx-auto font-medium"
          >
            Start free, upgrade when you need to close more deals. No hidden fees, cancel anytime.
          </motion.p>
        </div>

        {/* Billing Switch Toggle */}
        <div className="flex flex-col items-center justify-center mb-16 relative z-30">
          <div className="flex items-center gap-4 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm relative">
            <button
              onClick={() => setIsYearly(false)}
              className={cn(
                "relative z-10 px-5 py-2 text-sm font-bold rounded-xl transition-all duration-300",
                !isYearly ? "text-white" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={cn(
                "relative z-10 px-5 py-2 text-sm font-bold rounded-xl transition-all duration-300 flex items-center gap-1.5",
                isYearly ? "text-white" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Yearly
              <span className="text-[10px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-md">
                -20%
              </span>
            </button>
            
            {/* Sliding Pill Indicator */}
            <motion.div
              className="absolute top-1.5 bottom-1.5 left-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl"
              initial={false}
              animate={{
                left: isYearly ? "106px" : "6px",
                width: isYearly ? "104px" : "90px",
              }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
            />
          </div>
          
          {/* Subtle subtext for billing */}
          <p className="mt-3 text-xs text-slate-400 font-semibold tracking-wide h-4">
            {isYearly ? "Billed annually · Save up to $600/year" : "Billed monthly · Standard rates apply"}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
          {plans.map((plan, i) => {
            const price = isYearly ? plan.priceYearly : plan.priceMonthly;
            const isPopular = plan.popular;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                whileHover={{ y: -8 }}
                className="relative flex flex-col h-full rounded-[2rem] group"
              >
                {/* Popular card halo glow */}
                {isPopular && (
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                )}

                <div
                  className={cn(
                    "relative flex flex-col h-full rounded-[2rem] p-6 lg:p-8 border transition-all duration-500 bg-white",
                    isPopular
                      ? "bg-slate-900 border-slate-800 text-white shadow-2xl scale-105 z-10"
                      : "border-slate-200/80 shadow-md shadow-slate-100 hover:border-slate-300 hover:shadow-xl"
                  )}
                  style={{
                    boxShadow: !isPopular
                      ? `0 10px 30px -15px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.6) inset`
                      : undefined,
                  }}
                >
                  {/* Badge */}
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-xs font-black px-4 py-1.5 rounded-full shadow-md flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                      MOST POPULAR
                    </div>
                  )}

                  {plan.free && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-100 text-emerald-700 text-[10px] font-black px-3.5 py-1 rounded-full border border-emerald-200">
                      No Credit Card Required
                    </div>
                  )}

                  {/* Header info */}
                  <div className="mb-6">
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md inline-block mb-3",
                        isPopular ? plan.accentLight : "bg-indigo-50 text-indigo-600"
                      )}
                    >
                      {plan.name}
                    </span>
                    <p className={cn("text-xs font-medium mt-1 leading-relaxed min-h-[36px]", isPopular ? "text-slate-400" : "text-slate-500")}>
                      {plan.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6 flex items-baseline gap-1 relative overflow-hidden h-[54px]">
                    <span className={cn("text-lg font-bold align-super", isPopular ? "text-indigo-400" : "text-slate-400")}>$</span>
                    <span className={cn("text-5xl font-black tracking-tight", isPopular ? "text-white" : "text-slate-900")}>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={price}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 350, damping: 28 }}
                          className="inline-block"
                        >
                          {price}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <span className={cn("text-xs font-semibold ml-1 self-end mb-2", isPopular ? "text-slate-400" : "text-slate-500")}>
                      /{plan.period}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className={cn("w-full h-px mb-6", isPopular ? "bg-slate-800" : "bg-slate-100")} />

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <div
                          className={cn(
                            "w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                            isPopular ? "bg-indigo-500/20" : "bg-indigo-50"
                          )}
                        >
                          <Check
                            className={cn(
                              "w-3 h-3 stroke-[3px]",
                              isPopular ? "text-indigo-400" : "text-indigo-600"
                            )}
                          />
                        </div>
                        <span className={cn("text-xs leading-normal font-medium", isPopular ? "text-slate-300" : "text-slate-600")}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  <GlowButton
                    variant={isPopular ? "primary" : "outline"}
                    className={cn(
                      "w-full text-sm font-bold py-3.5 rounded-2xl transition-all duration-300",
                      isPopular && "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 border-0"
                    )}
                    href={plan.name === "Enterprise" ? "#" : "https://app.qampi.com/register"}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </GlowButton>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* AI Model Comparison Subtext */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-16 bg-white/60 backdrop-blur-sm border border-slate-200/50 rounded-2xl p-5 max-w-3xl mx-auto shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left justify-center">
            <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              <span className="text-indigo-600 font-bold">Qampi Fast Model</span> is optimized for speed and connection conversions.{" "}
              <span className="text-purple-600 font-bold">Qampi Pro Model</span> leverages our deep reasoning engine for intent analysis and multi-layered, personalized replies.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
