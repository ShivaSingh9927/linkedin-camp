'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PricingTabProps {
    text: string;
    selected: boolean;
    onClick: () => void;
    discount?: boolean;
}

export function PricingTab({ text, selected, onClick, discount }: PricingTabProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative rounded-full px-8 py-3 text-sm font-black uppercase tracking-wider transition-colors",
                selected ? "text-white" : "text-slate-500 hover:text-slate-900"
            )}
        >
            <span className="relative z-10 flex items-center gap-3">
                {text}
                {discount && (
                    <span className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tight",
                        selected ? "bg-white/20 text-white" : "bg-accent text-white"
                    )}>
                        -50%
                    </span>
                )}
            </span>
            {selected && (
                <motion.div
                    layoutId="active-pricing-tab"
                    className="absolute inset-0 z-0 rounded-full bg-slate-900 shadow-lg"
                    transition={{ type: "spring", duration: 0.6 }}
                />
            )}
        </button>
    )
}
