'use client';

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: "0",
    period: "forever",
    description: "Try Qampi AI and see the power of personalized outreach.",
    features: [
      "25 AI messages/week",
      "Qampi Standard model",
      "Profile-level personalization",
      "1 AI follow-up step",
      "2 active campaigns",
      "Basic analytics",
      "Community support",
    ],
    cta: "Start Free",
    popular: false,
    free: true,
  },
  {
    name: "Starter",
    price: "49",
    period: "month",
    description: "Perfect for solo founders getting started with LinkedIn outreach.",
    features: [
      "500 AI messages/week",
      "Qampi Pro model",
      "Profile + company context",
      "3 AI follow-up steps",
      "10 active campaigns",
      "Advanced analytics",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: true,
    free: false,
  },
  {
    name: "Growth",
    price: "99",
    period: "month",
    description: "For growing teams that need more power and collaboration.",
    features: [
      "2,000 AI messages/week",
      "Qampi Pro + deep research",
      "Intent signal detection",
      "Unlimited AI follow-ups",
      "Unlimited campaigns",
      "Team collaboration",
      "CRM integrations",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: false,
    free: false,
  },
  {
    name: "Enterprise",
    price: "249",
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
  },
];

export function PricingV2() {
  return (
    <section id="pricing" className="py-24 sm:py-32 bg-white relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/[0.015] rounded-full blur-[140px] pointer-events-none" />

      {/* Section Divider */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Pricing plans</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
            Simple, transparent{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">pricing</span>
          </h2>
          <p className="mt-4.5 text-base sm:text-lg text-slate-600 font-semibold leading-relaxed">
            Start free, scale as you grow. No hidden setups or contract lockouts.
          </p>
        </motion.div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-7xl mx-auto items-stretch">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5, type: "spring", stiffness: 90 }}
              whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              className={cn(
                "relative rounded-3xl h-full flex flex-col justify-between border transition-all duration-300 group",
                plan.popular
                  ? "bg-slate-50/80 backdrop-blur-xl border-indigo-500/30 shadow-[0_20px_50px_rgba(99,102,241,0.08)] scale-[1.02] z-10"
                  : "bg-white border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:border-slate-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.04)]"
              )}
            >
              {/* Animated gradient border for popular plan */}
              {plan.popular && (
                <>
                  <div className="absolute -inset-[1px] rounded-[25px] bg-[conic-gradient(from_var(--border-angle),#6366f1,#a855f7,#ec4899,#6366f1)] opacity-40 group-hover:opacity-80 transition-opacity duration-500 blur-[1px] animate-rotate-border pointer-events-none" />
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-indigo-500/25 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                </>
              )}

              {plan.free && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  No card required
                </div>
              )}

              <div className={cn("relative p-6 lg:p-8", plan.popular && "pt-10")}>
                {/* Title */}
                <div className="mb-6">
                  <h3 className="text-lg font-black text-slate-900">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold">
                    {plan.description}
                  </p>
                </div>

                {/* Pricing values */}
                <div className="mb-6 flex items-baseline border-b border-slate-100 pb-5">
                  <span className="text-4xl lg:text-5xl font-black text-slate-900">
                    ${plan.price}
                  </span>
                  <span className="text-xs text-slate-400 ml-1.5 font-bold">
                    /{plan.period}
                  </span>
                </div>

                {/* Features Checklist */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start space-x-2.5">
                      <div className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border",
                        plan.popular 
                          ? "bg-indigo-50 border-indigo-100 text-indigo-600" 
                          : "bg-slate-50 border-slate-200 text-slate-400 shadow-sm"
                      )}>
                        <Check className="w-2.5 h-2.5 font-black" aria-hidden="true" />
                      </div>
                      <span className="text-xs text-slate-600 font-semibold">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Trigger Button */}
              <div className={cn("px-6 lg:px-8 pb-6 lg:pb-8", !plan.popular && "pt-0")}>
                <motion.a
                  href={plan.name === "Enterprise" ? "mailto:sales@qampi.com" : "https://app.qampi.com/register"}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 font-black py-3.5 px-4 rounded-2xl text-xs transition-all cursor-pointer duration-200 shadow-sm",
                    plan.popular
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30"
                      : "bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-700 hover:text-slate-900"
                  )}
                >
                  <span>{plan.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footnote model comparison */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            <span className="font-black text-slate-700">Qampi Standard</span> = optimized speed models ·{" "}
            <span className="font-black text-slate-700">Qampi Pro</span> = high-reasoning context intelligence models
          </p>
        </motion.div>

      </div>
    </section>
  );
}
