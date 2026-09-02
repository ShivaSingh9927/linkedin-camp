'use client';

import { motion } from 'framer-motion';
import { Check, Star, Zap, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Tier {
    name: string;
    key: string;
    monthlyPrice: string;
    yearlyPrice: string;
    description: string;
    features: string[];
    highlighted?: boolean;
    buttonText: string;
    icon: any;
}

export function PricingCard({
    tier,
    isYearly,
    onSelect,
    busy = false,
    ctaDisabled = false,
    billedNote,
}: {
    tier: Tier;
    isYearly: boolean;
    onSelect?: () => void;
    busy?: boolean;
    ctaDisabled?: boolean;
    billedNote?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -8 }}
            className={cn(
                "relative flex flex-col rounded-[2rem] bg-white p-6 transition-all hover:bg-slate-50",
                "border-2",
                tier.highlighted ? "border-primary shadow-2xl shadow-primary/10" : "border-slate-100 shadow-xl shadow-slate-200/50"
            )}
        >
            {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground shadow-lg">
                    Most Popular
                </div>
            )}

            <div className="mb-5 flex items-center gap-3">
                <div className={cn(
                    "flex size-11 items-center justify-center rounded-2xl",
                    tier.highlighted ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20" : "bg-slate-100 text-slate-600"
                )}>
                    <tier.icon className="size-5" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">{tier.name}</h3>
                    <p className="text-[11px] font-bold text-slate-400">{tier.description}</p>
                </div>
            </div>

            <div className="mb-5 p-4 bg-slate-100/50 rounded-2xl">
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">
                        {isYearly ? tier.yearlyPrice : tier.monthlyPrice}
                    </span>
                    <span className="text-sm font-bold text-slate-400">/mo</span>
                </div>
                {isYearly && billedNote && tier.monthlyPrice !== "Free" && (
                    <p className="mt-1 text-[10px] font-black text-accent uppercase tracking-wider">
                        {billedNote}
                    </p>
                )}
            </div>

            <ul className="mb-6 flex-1 space-y-2.5">
                {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-[13px] font-bold text-slate-600">
                        <div className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-lg",
                            tier.highlighted ? "bg-primary/20 text-primary" : "bg-slate-200 text-slate-400"
                        )}>
                            <Check className="size-3.5 stroke-[4px]" />
                        </div>
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            <button
                onClick={onSelect}
                disabled={busy || ctaDisabled}
                className={cn(
                    "w-full rounded-2xl py-3 text-[13px] font-black uppercase tracking-widest transition-all active:scale-95",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
                    tier.highlighted
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                )}
            >
                {busy ? "Starting…" : tier.buttonText}
            </button>
        </motion.div>
    );
}
