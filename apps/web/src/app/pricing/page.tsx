'use client';

import { useState } from 'react';
import { 
    Check, 
    Star, 
    Zap, 
    Gem, 
    Rocket,
    Crown,
    CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PricingCard, Tier } from '@/components/ui/pricing-card';
import { PricingTab } from '@/components/ui/pricing-tab';
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
        <div className="min-h-full bg-slate-50/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-20 animate-in fade-in duration-700">
                {/* Header Section */}
                <div className="text-center space-y-6 sm:space-y-8 mb-16 sm:mb-24">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center space-x-3 px-6 py-2.5 bg-primary/10 text-primary rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] border border-primary/20 shadow-lg shadow-primary/5"
                    >
                        <Zap className="w-3.5 h-3.5 fill-primary" />
                        <span>Limited Node Access: 50% Yield Increase</span>
                    </motion.div>
                    
                    <div className="space-y-4">
                        <motion.h1 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-4xl sm:text-7xl font-black text-slate-900 tracking-tighter italic uppercase leading-none"
                        >
                            Select Your <span className="text-primary">Protocol</span>
                        </motion.h1>
                        <p className="text-slate-500 font-bold text-xs sm:text-lg uppercase tracking-[0.1em] sm:tracking-[0.2em] opacity-60">Scale your outreach landscape with military-grade precision.</p>
                    </div>
                    
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex justify-center pt-6 sm:pt-10"
                    >
                        <div className="bg-white p-2 rounded-[2rem] border border-slate-100 shadow-premium flex items-center">
                            <button 
                                onClick={() => setIsYearly(false)}
                                className={cn(
                                    "px-6 sm:px-10 py-3 sm:py-4 rounded-[1.5rem] text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all",
                                    !isYearly ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                Monthly
                            </button>
                            <button 
                                onClick={() => setIsYearly(true)}
                                className={cn(
                                    "px-6 sm:px-10 py-3 sm:py-4 rounded-[1.5rem] text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center space-x-3",
                                    isYearly ? "bg-primary text-white shadow-xl shadow-primary/20" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <span>Yearly</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[8px] font-black",
                                    isYearly ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                                )}>-50%</span>
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* Pricing Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-10 mb-20 sm:mb-32">
                    {tiers.map((tier, idx) => (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <PricingCard tier={tier} isYearly={isYearly} />
                        </motion.div>
                    ))}
                </div>

                {/* FAQ / Trust Section */}
                <div className="bg-white rounded-[3rem] sm:rounded-[4rem] border border-slate-100 p-8 sm:p-20 shadow-premium relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent" />
                    <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12 sm:gap-20 text-center md:text-left">
                        <div className="space-y-6">
                            <div className="w-16 h-16 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center text-emerald-600 mx-auto md:mx-0 shadow-inner">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xl sm:text-2xl font-black text-slate-900 uppercase italic">Safety Protocol</h4>
                                <p className="text-xs sm:text-sm text-slate-500 font-bold leading-relaxed uppercase tracking-widest opacity-60">
                                    We respect LinkedIn limits and use advanced human-like behaviors to protect your identity.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center text-blue-600 mx-auto md:mx-0 shadow-inner">
                                <Rocket className="w-8 h-8" />
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xl sm:text-2xl font-black text-slate-900 uppercase italic">Rapid Deployment</h4>
                                <p className="text-xs sm:text-sm text-slate-500 font-bold leading-relaxed uppercase tracking-widest opacity-60">
                                    Launch your first campaign in under 5 minutes. No complex configuration required.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center text-primary mx-auto md:mx-0 shadow-inner">
                                <Zap className="w-8 h-8" />
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xl sm:text-2xl font-black text-slate-900 uppercase italic">AI Intelligence</h4>
                                <p className="text-xs sm:text-sm text-slate-500 font-bold leading-relaxed uppercase tracking-widest opacity-60">
                                    Our AI engine analyzes target profiles to architect messages that actually secure replies.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
