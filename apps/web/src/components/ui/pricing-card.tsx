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

export function PricingCard({ tier, isYearly }: { tier: Tier, isYearly: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -8 }}
            className={cn(
                "relative flex flex-col rounded-[2.5rem] bg-white p-8 transition-all hover:bg-slate-50",
                "border-2",
                tier.highlighted ? "border-primary shadow-2xl shadow-primary/10" : "border-slate-100 shadow-xl shadow-slate-200/50"
            )}
        >
            {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground shadow-lg">
                    Most Popular
                </div>
            )}

            <div className="mb-8 flex items-center gap-4">
                <div className={cn(
                    "flex size-14 items-center justify-center rounded-3xl",
                    tier.highlighted ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20" : "bg-slate-100 text-slate-600"
                )}>
                    <tier.icon className="size-7" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900">{tier.name}</h3>
                    <p className="text-xs font-bold text-slate-400">{tier.description}</p>
                </div>
            </div>

            <div className="mb-8 p-6 bg-slate-100/50 rounded-3xl">
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900">
                        {isYearly ? tier.yearlyPrice : tier.monthlyPrice}
                    </span>
                    <span className="text-sm font-bold text-slate-400">/mo</span>
                </div>
                {isYearly && tier.monthlyPrice !== "Free" && (
                    <p className="mt-2 text-[10px] font-black text-accent uppercase tracking-wider">
                        Billed annually (Save 50%)
                    </p>
                )}
            </div>

            <ul className="mb-10 flex-1 space-y-4">
                {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-4 text-sm font-bold text-slate-600">
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
                className={cn(
                    "w-full rounded-[1.5rem] py-4 text-sm font-black uppercase tracking-widest transition-all active:scale-95",
                    tier.highlighted
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                )}
            >
                {tier.buttonText}
            </button>
        </motion.div>
    );
}
