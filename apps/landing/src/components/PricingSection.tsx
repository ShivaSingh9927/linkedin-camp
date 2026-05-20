'use client';

import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { GlowButton } from "./GlowButton";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: "0",
    period: "forever",
    description: "Try Aigeon AI and see the power of personalized outreach.",
    features: [
      "25 AI messages/week",
      "Aigeon Fast model",
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
      "Aigeon Pro model",
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
      "Aigeon Pro + deep research",
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

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 lg:py-32 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Simple, transparent{" "}
            <span className="text-primary">pricing</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Start free, scale as you grow. No hidden fees.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className={cn(
                "relative rounded-3xl p-6 lg:p-8 h-full flex flex-col",
                plan.popular
                  ? "bg-gradient-to-br from-primary to-indigo-600 text-white shadow-2xl shadow-primary/25 lg:scale-105 border-0"
                  : plan.free
                    ? "bg-slate-50 border-2 border-dashed border-slate-200"
                    : "bg-slate-50 border border-slate-100"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-xs font-bold px-4 py-1.5 rounded-full">
                  Most Popular
                </div>
              )}

              {plan.free && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                  No credit card required
                </div>
              )}

              <div className="mb-6">
                <h3 className={cn("text-xl font-black", plan.popular ? "text-white" : "text-slate-900")}>
                  {plan.name}
                </h3>
                <p className={cn("text-sm mt-2", plan.popular ? "text-white/70" : "text-slate-500")}>
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className={cn("text-4xl lg:text-5xl font-black", plan.popular ? "text-white" : "text-slate-900")}>
                  ${plan.price}
                </span>
                <span className={cn("text-sm", plan.popular ? "text-white/70" : "text-slate-500")}>
                  /{plan.period}
                </span>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start space-x-2.5">
                    <div className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      plan.popular ? "bg-white/20" : "bg-primary/10"
                    )}>
                      <Check className={cn("w-2.5 h-2.5", plan.popular ? "text-white" : "text-primary")} />
                    </div>
                    <span className={cn("text-xs lg:text-sm", plan.popular ? "text-white/90" : "text-slate-600")}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <GlowButton
                variant={plan.popular ? "outline" : "primary"}
                className={cn(
                  "w-full text-sm",
                  plan.popular && "bg-white text-primary border-white hover:bg-white/90"
                )}
                href={plan.name === "Enterprise" ? "#" : "https://app.qampi.com/register"}
              >
                {plan.cta}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </GlowButton>
            </motion.div>
          ))}
        </div>

        {/* AI Model comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">Aigeon Fast</span> = optimized for speed and quality ·{" "}
            <span className="font-semibold text-slate-700">Aigeon Pro</span> = advanced reasoning models for deeper personalization
          </p>
        </motion.div>
      </div>
    </section>
  );
}
