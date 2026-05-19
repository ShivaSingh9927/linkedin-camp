'use client';

import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { GlowButton } from "./GlowButton";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: "49",
    description: "Perfect for solo founders getting started with LinkedIn outreach.",
    features: [
      "500 prospects/month",
      "3 active campaigns",
      "AI message generation",
      "Basic analytics",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Growth",
    price: "99",
    description: "For growing teams that need more power and collaboration.",
    features: [
      "2,000 prospects/month",
      "Unlimited campaigns",
      "AI message generation",
      "Advanced analytics",
      "Team collaboration",
      "CRM integrations",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "249",
    description: "For large teams with advanced needs and custom requirements.",
    features: [
      "Unlimited prospects",
      "Unlimited campaigns",
      "Custom AI training",
      "White-label reports",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
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

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className={cn(
                "relative rounded-3xl p-8 h-full flex flex-col",
                plan.popular
                  ? "bg-gradient-to-br from-primary to-indigo-600 text-white shadow-2xl shadow-primary/25 md:scale-105 border-0"
                  : "bg-slate-50 border border-slate-100"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-xs font-bold px-4 py-1.5 rounded-full">
                  Most Popular
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
                <span className={cn("text-5xl font-black", plan.popular ? "text-white" : "text-slate-900")}>
                  ${plan.price}
                </span>
                <span className={cn("text-sm", plan.popular ? "text-white/70" : "text-slate-500")}>
                  /month
                </span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center space-x-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                      plan.popular ? "bg-white/20" : "bg-primary/10"
                    )}>
                      <svg className={cn("w-3 h-3", plan.popular ? "text-white" : "text-primary")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className={cn("text-sm", plan.popular ? "text-white/90" : "text-slate-600")}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <GlowButton
                variant={plan.popular ? "outline" : "primary"}
                className={cn(
                  "w-full",
                  plan.popular && "bg-white text-primary border-white hover:bg-white/90"
                )}
                href={plan.name === "Enterprise" ? "#" : "https://app.qampi.com/register"}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 ml-2" />
              </GlowButton>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
