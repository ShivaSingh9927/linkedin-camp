'use client';

import { useState } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlowButton } from "./GlowButton";
import { cn } from "@/lib/utils";

// Mirrors apps/backend/src/config/plans.ts (the single source of truth for
// tiers, limits and prices) and the bullets the app's /pricing page derives
// from it. The landing site can't import backend code, so when a plan changes
// there, change it here and in public/pricing.md too.
type Region = "usd" | "inr";

const plans = [
  {
    name: "Free",
    price: { usd: { monthly: 0, yearly: 0 }, inr: { monthly: 0, yearly: 0 } },
    description: "Try the full loop, end to end.",
    features: [
      "20 LinkedIn invites / week",
      "100 leads · 10 email credits (one-time)",
      "AI-written messages",
      "4–5 starter templates",
      "Copilot lead search",
      "Inbox sync + reply",
      "Community support",
    ],
    cta: "Start Free",
    popular: false,
    free: true,
  },
  {
    name: "Core",
    price: { usd: { monthly: 19, yearly: 16 }, inr: { monthly: 399, yearly: 333 } },
    description: "For solo founders & freelancers.",
    features: [
      "300 LinkedIn invites / month",
      "1,500 leads · 100 email credits / mo",
      "AI-written messages",
      "All 43 templates",
      "Full Qampi copilot",
      "CRM sync (HubSpot, Pipedrive, Notion)",
      "Email support (48h)",
    ],
    cta: "Start Free",
    popular: false,
    free: false,
  },
  {
    name: "Pro",
    price: { usd: { monthly: 49, yearly: 41 }, inr: { monthly: 1199, yearly: 999 } },
    description: "For growing sales teams.",
    features: [
      "800 LinkedIn invites / month",
      "2,500 leads · 300 email credits / mo",
      "Everything in Core",
      "Public API + webhooks (Zapier, Make, n8n)",
      "Priority support (4h)",
    ],
    cta: "Start Free",
    popular: true,
    free: false,
  },
  {
    name: "Business",
    price: { usd: { monthly: 69, yearly: 58 }, inr: { monthly: 1699, yearly: 1416 } },
    description: "Multichannel at full scale.",
    features: [
      "800 LinkedIn invites / month",
      "5,000 leads · 500 email credits / mo",
      "Everything in Pro",
      "Cold email + multichannel campaigns",
      "Team workspace (up to 25 seats)",
      "Priority support (4h)",
    ],
    cta: "Start Free",
    popular: false,
    free: false,
  },
];

const CURRENCY: Record<Region, string> = { usd: "$", inr: "₹" };

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);
  const [region, setRegion] = useState<Region>("usd");

  return (
    <section id="pricing" className="section relative">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="eyebrow">Pricing</span>
          <h2 className="section-title mt-3">
            Start free. <span className="accent">Pay when it works.</span>
          </h2>
          <p className="section-lead mx-auto mt-5">
            Every account starts on Free. Upgrade when you need more volume — no hidden fees, cancel anytime.
          </p>
        </div>

        {/* Region + billing toggles */}
        <div className="mb-12 flex flex-col items-center">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {[
              {
                label: "Currency",
                value: region,
                set: (v: string) => setRegion(v as Region),
                options: [
                  { v: "usd", text: "Global · $" },
                  { v: "inr", text: "India · ₹" },
                ],
              },
              {
                label: "Billing",
                value: isYearly ? "yearly" : "monthly",
                set: (v: string) => setIsYearly(v === "yearly"),
                options: [
                  { v: "monthly", text: "Monthly" },
                  { v: "yearly", text: "Yearly · 2 mo free" },
                ],
              },
            ].map((group) => (
              <div
                key={group.label}
                role="group"
                aria-label={group.label}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1"
              >
                {group.options.map((o) => (
                  <button
                    key={o.v}
                    aria-pressed={group.value === o.v}
                    onClick={() => group.set(o.v)}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200",
                      group.value === o.v ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {o.text}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3 h-4 text-xs font-medium text-slate-400">
            {isYearly ? "Billed yearly · 2 months free" : "Billed monthly · Switch or cancel anytime"}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
          {plans.map((plan, i) => {
            const price = (isYearly ? plan.price[region].yearly : plan.price[region].monthly).toLocaleString(region === "inr" ? "en-IN" : "en-US");
            const isPopular = plan.popular;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="relative flex flex-col h-full rounded-2xl group"
              >
                <div
                  className={cn(
                    "relative flex flex-col h-full rounded-2xl p-6 lg:p-7 border transition-colors duration-300 bg-white",
                    isPopular
                      ? "border-primary ring-1 ring-primary shadow-[0_24px_60px_-28px_rgba(124,58,237,0.45)]"
                      : "border-slate-200/80 hover:border-slate-300"
                  )}
                >
                  {/* Badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-6 bg-primary text-white text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md whitespace-nowrap">
                      Most popular
                    </div>
                  )}

                  {/* Header info */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">{plan.name}</h3>
                    <p className="mt-1 min-h-[3rem] text-sm leading-relaxed text-slate-500">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6 flex items-baseline gap-1 relative overflow-hidden h-[54px]">
                    <span className={cn("text-lg font-bold align-super", "text-slate-400")}>{CURRENCY[region]}</span>
                    <span className="text-5xl font-semibold tracking-tight text-slate-900 tabular-nums">
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
                    <span className={cn("text-xs font-semibold ml-1 self-end mb-2", "text-slate-500")}>
                      {plan.free ? "/forever" : "/month"}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="w-full h-px mb-6 bg-slate-100" />

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <div
                          className={cn(
                            "w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                            "bg-violet-50"
                          )}
                        >
                          <Check
                            className={cn(
                              "w-3 h-3 stroke-[3px]",
                              "text-violet-600"
                            )}
                          />
                        </div>
                        <span className="text-[13px] leading-normal text-slate-600">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  <GlowButton
                    variant={isPopular ? "primary" : "secondary"}
                    className={cn(
                      "w-full text-sm font-semibold py-3 rounded-xl transition-all duration-200",
                      isPopular && "border-0"
                    )}
                    href="https://app.qampi.com/register"
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
            <ShieldCheck className="w-5 h-5 text-violet-600 shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              <span className="text-violet-600 font-bold">Every plan gets the same account protection</span>, Free included: a dedicated proxy for each LinkedIn account, human-like pacing, and a hard safety ceiling of 18 invites and 40 messages a day.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
