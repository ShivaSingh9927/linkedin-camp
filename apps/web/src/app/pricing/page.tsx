'use client';

import { useState } from 'react';
import { Zap, Rocket, Crown, CheckCircle2 } from 'lucide-react';
import { PricingCard, Tier } from '@/components/ui/pricing-card';
import { cn } from '@/lib/utils';

const tiers: Tier[] = [
    {
        name: "Free Forever",
        key: "free_monthly",
        monthlyPrice: "Free",
        yearlyPrice: "Free",
        description: "For individuals just starting out.",
        features: [
            "20 invites per week",
            "LinkedIn Profile Visits",
            "Basic Campaign Manager",
            "Manual Inbox Sync"
        ],
        buttonText: "Start for free",
        icon: Rocket
    },
    {
        name: "Pro Scale",
        key: "pro_monthly",
        monthlyPrice: "$59",
        yearlyPrice: "$29",
        highlighted: true,
        description: "Powerful automation for experts.",
        features: [
            "100 invites per day",
            "Auto-Message Responses",
            "CRM Integration",
            "Background Persistent Sessions",
            "Smart AI Sequences",
            "2-Step Followups"
        ],
        buttonText: "Get Started Pro",
        icon: Zap
    },
    {
        name: "Advanced Elite",
        key: "adv_monthly",
        monthlyPrice: "$119",
        yearlyPrice: "$59",
        description: "The ultimate weapon for teams.",
        features: [
            "Unlimited actions (safe limit)",
            "Dynamic AI Image Generation",
            "Team Collaboration tools",
            "Priority Support",
            "White-label Reports",
            "API Access"
        ],
        buttonText: "Go Elite",
        icon: Crown
    }
];

export default function PricingPage() {
    const [isYearly, setIsYearly] = useState(true);

    return (
        <div className="animate-in fade-in duration-500 flex flex-col h-full">
            {/* Header — compact */}
            <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-primary/20 mb-3">
                    <Zap className="w-3 h-3 fill-primary" />
                    <span>Save 50% on annual plans</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    Select your <span className="text-primary">plan</span>
                </h1>
                <p className="text-slate-500 font-semibold text-sm mt-1.5">Scale your outreach safely — upgrade or downgrade anytime.</p>

                {/* Billing toggle */}
                <div className="flex justify-center mt-4">
                    <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex items-center">
                        <button
                            onClick={() => setIsYearly(false)}
                            className={cn(
                                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                !isYearly ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsYearly(true)}
                            className={cn(
                                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                isYearly ? "bg-primary text-white" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <span>Yearly</span>
                            <span className={cn("px-1.5 py-0.5 rounded-full text-[8px] font-black", isYearly ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>-50%</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Pricing Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                {tiers.map((tier) => (
                    <PricingCard key={tier.name} tier={tier} isYearly={isYearly} />
                ))}
            </div>

            {/* Trust strip — slim, single row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-auto">
                {[
                    { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50', title: 'Account-safe', desc: 'Respects LinkedIn limits with human-like pacing.' },
                    { icon: Rocket, color: 'text-blue-600 bg-blue-50', title: 'Fast setup', desc: 'Launch your first campaign in under 5 minutes.' },
                    { icon: Zap, color: 'text-primary bg-primary/10', title: 'AI-written', desc: 'Messages tailored to each prospect to earn replies.' },
                ].map((f) => (
                    <div key={f.title} className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3">
                        <div className={cn('w-9 h-9 rounded-xl grid place-items-center shrink-0', f.color)}>
                            <f.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-[13px] font-black text-slate-900">{f.title}</h4>
                            <p className="text-[11px] font-semibold text-slate-400 leading-snug">{f.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
