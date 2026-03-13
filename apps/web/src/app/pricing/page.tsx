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
import { TopBar } from '@/components/TopBar';

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
        <div className="min-h-full bg-slate-50">
            <TopBar 
                title="Plans & Pricing" 
                description="Scale your outreach with our power-packed plans."
            />

            <main className="max-w-7xl mx-auto px-8 py-16">
                {/* Header Section */}
                <div className="text-center space-y-4 mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-primary/5 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/10"
                    >
                        <Star className="w-3 h-3 fill-primary" />
                        <span>Limited Time Offer: 50% Off Yearly</span>
                        <Star className="w-3 h-3 fill-primary" />
                    </motion.div>
                    
                    <motion.h2 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl font-black text-slate-900 tracking-tight"
                    >
                        Ready to automate your success?
                    </motion.h2>
                    
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex justify-center mt-12"
                    >
                        <div className="bg-white p-2 rounded-full border shadow-xl shadow-slate-200/50 flex">
                            <PricingTab 
                                text="Monthly" 
                                selected={!isYearly} 
                                onClick={() => setIsYearly(false)} 
                            />
                            <PricingTab 
                                text="Yearly" 
                                selected={isYearly} 
                                onClick={() => setIsYearly(true)}
                                discount 
                            />
                        </div>
                    </motion.div>
                </div>

                {/* Pricing Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
                    {tiers.map((tier, idx) => (
                        <PricingCard key={tier.name} tier={tier} isYearly={isYearly} />
                    ))}
                </div>

                {/* FAQ / Trust Section */}
                <div className="bg-white rounded-[3rem] border border-slate-100 p-12 shadow-2xl shadow-slate-200/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto md:mx-0">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900">Safety First</h4>
                            <p className="text-sm text-slate-500 font-bold leading-relaxed">
                                We respect LinkedIn limits and use advanced human-like behaviors to protect your account.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto md:mx-0">
                                <Rocket className="w-6 h-6" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900">Fast Setup</h4>
                            <p className="text-sm text-slate-500 font-bold leading-relaxed">
                                Launch your first campaign in under 5 minutes. No coding or complex setup required.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mx-auto md:mx-0">
                                <Zap className="w-6 h-6" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900">AI Personalization</h4>
                            <p className="text-sm text-slate-500 font-bold leading-relaxed">
                                Our AI analyzes landing pages and profiles to write messages that actually get replies.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
