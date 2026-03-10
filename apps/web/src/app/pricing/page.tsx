"use client";

import { useState } from 'react';
import { Check, Rocket } from 'lucide-react';

const tiers = [
    {
        name: 'PRO',
        desc: 'Ideal if you have a strong LinkedIn network and want to turn connections into conversations.',
        price: '₹431',
        originalPrice: '₹885/month',
        invitations: '300 invitations per month',
        features: ['Automated follow-up messages', 'LinkedIn Campaigns', 'Basic analytics'],
        cta: 'Choose this plan',
        highlight: false,
    },
    {
        name: 'ADVANCED',
        desc: 'Perfect for scaling outreach and growing your network fast – at the best price.',
        price: '₹1,271',
        originalPrice: '₹2,541/month',
        invitations: '800 invitations per month',
        features: ['Everything in PRO', '+500 Invitations', 'Live Chat support', 'API Keys Management'],
        cta: 'Choose this plan',
        highlight: true,
        badge: 'x2.5 more results than PRO ★',
    },
    {
        name: 'BUSINESS',
        desc: 'Maximize replies by combining LinkedIn and Emails. No leads left behind.',
        price: '₹1,815',
        originalPrice: '₹3,629/month',
        invitations: '800 invitations per month',
        features: ['Everything in ADVANCED', 'Cold Email features', 'Email finders', 'Additional outreach tools'],
        cta: 'Current trial',
        highlight: false,
    },
    {
        name: 'ENTERPRISE',
        desc: 'Designed for collaboration, for sales teams and agencies.',
        price: 'Custom',
        originalPrice: 'Starts at 5 seats',
        invitations: '800 invitations per month',
        features: ['The plan you choose, plus:', 'Team workspace', 'Volume discounts', 'Unified billing'],
        cta: 'Talk to Sales',
        highlight: false,
    },
];

export default function PricingPage() {
    const [billing, setBilling] = useState<'monthly' | 'quarterly' | 'yearly'>('yearly');

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-black text-slate-800">
                    Join LEADMATE – best prices in the galaxy 😎
                </h1>
            </div>

            {/* Billing Toggle */}
            <div className="flex justify-center">
                <div className="flex items-center space-x-1 bg-slate-100 rounded-2xl p-1">
                    {(['monthly', 'quarterly', 'yearly'] as const).map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setBilling(opt)}
                            className={`px-5 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${billing === opt
                                    ? 'bg-white shadow-sm text-slate-800'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {opt.charAt(0).toUpperCase() + opt.slice(1)}
                            {opt === 'yearly' && (
                                <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-black">
                                    Save 50%
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {tiers.map((tier) => (
                    <div
                        key={tier.name}
                        className={`bg-white rounded-3xl border p-6 flex flex-col transition-all hover:shadow-lg ${tier.highlight
                                ? 'border-indigo-300 shadow-lg shadow-indigo-100 relative'
                                : 'border-slate-200 shadow-sm'
                            }`}
                    >
                        {tier.badge && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1 rounded-full whitespace-nowrap">
                                {tier.badge}
                            </div>
                        )}

                        {tier.highlight && (
                            <Rocket className="absolute -top-4 -right-4 w-10 h-10 text-indigo-500 rotate-12 opacity-30" />
                        )}

                        <h3 className={`text-lg font-black uppercase tracking-tight ${tier.highlight ? 'text-indigo-700' : 'text-slate-800'}`}>
                            {tier.name}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 flex-grow-0">{tier.desc}</p>

                        <div className="mt-4">
                            <span className="text-3xl font-black text-slate-900">{tier.price}</span>
                            {tier.originalPrice && tier.price !== 'Custom' && (
                                <span className="ml-2 text-sm text-slate-400 line-through">{tier.originalPrice}</span>
                            )}
                            {tier.price === 'Custom' && (
                                <p className="text-xs text-slate-400 mt-0.5">{tier.originalPrice}</p>
                            )}
                        </div>

                        <button
                            className={`w-full mt-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${tier.highlight
                                    ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white hover:opacity-90 shadow-lg'
                                    : 'border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                }`}
                        >
                            {tier.cta}
                        </button>

                        <div className="mt-3 text-center">
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                                {tier.invitations}
                            </span>
                        </div>

                        <div className="mt-5 space-y-2 flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key Features</p>
                            {tier.features.map((f) => (
                                <div key={f} className="flex items-center space-x-2 text-sm">
                                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                    <span className="text-slate-600">{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
