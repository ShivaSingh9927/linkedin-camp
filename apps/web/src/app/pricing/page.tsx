'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Zap, Rocket, Crown, Sparkles, CheckCircle2 } from 'lucide-react';
import { PricingCard, Tier } from '@/components/ui/pricing-card';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// Shape returned by GET /api/v1/billing/plans (sourced from backend config/plans).
interface ApiPlan {
    key: string;
    label: string;
    pricing: {
        inr: { monthly: number; annualPerMonth: number; annualTotal: number };
        usd: { monthly: number; annualPerMonth: number; annualTotal: number };
    };
    monthlyInvites: number;
    leadsStored: number;
    emailFinderCredits: number;
    emailFinderRecurring: boolean;
    features: { crmSync: boolean; multichannel: boolean; team: boolean; copilot: 'limited' | 'full'; templates: 'starter' | 'all' };
    supportSla: string;
    available: boolean;
}

type Region = 'india' | 'global';
const CUR: Record<Region, 'inr' | 'usd'> = { india: 'inr', global: 'usd' };

declare global {
    interface Window { Razorpay?: any }
}

const ICONS: Record<string, any> = { FREE: Rocket, CORE: Sparkles, PRO: Zap, BUSINESS: Crown };
const SUPPORT_LABEL: Record<string, string> = {
    community: 'Community support',
    'email-48h': 'Email support (48h)',
    'priority-4h': 'Priority chat (4h)',
};

function loadRazorpay(): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined') return resolve(false);
        if (window.Razorpay) return resolve(true);
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.body.appendChild(s);
    });
}

// Feature bullets for a card, derived from the plan data (single source: backend).
function featuresFor(p: ApiPlan): string[] {
    const invites = p.key === 'FREE' ? '20 invites/week' : `${p.monthlyInvites} invites/month`;
    const credits = `${p.leadsStored.toLocaleString()} leads · ${p.emailFinderCredits} email credits${p.emailFinderRecurring ? '/mo' : ' (one-time)'}`;
    return [
        invites,
        p.features.templates === 'all' ? 'All 43 templates' : '4–5 starter templates',
        'AI-written DMs',
        p.features.copilot === 'full' ? 'Full Qampi copilot' : 'Copilot lead search',
        'Inbox sync + reply',
        ...(p.features.crmSync ? ['CRM sync (HubSpot/Pipedrive/Notion)'] : []),
        ...(p.features.team ? ['Team collaboration'] : []),
        ...(p.features.multichannel ? ['Cold email + multichannel'] : []),
        credits,
        SUPPORT_LABEL[p.supportSla] || p.supportSla,
    ];
}

function money(region: Region, n: number): string {
    return region === 'india' ? `₹${n.toLocaleString('en-IN')}` : `$${n}`;
}

export default function PricingPage() {
    const router = useRouter();
    const [plans, setPlans] = useState<ApiPlan[]>([]);
    const [region, setRegion] = useState<Region>('india');
    const [isYearly, setIsYearly] = useState(true);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/billing/plans')
            .then((r) => setPlans(r.data?.plans || []))
            .catch(() => toast.error('Could not load plans'))
            .finally(() => setLoading(false));
    }, []);

    const tiers: (Tier & { plan: ApiPlan })[] = useMemo(
        () =>
            plans.map((p) => {
                const price = p.pricing[CUR[region]];
                const isFree = p.key === 'FREE';
                return {
                    plan: p,
                    name: p.label,
                    key: p.key,
                    monthlyPrice: isFree ? 'Free' : money(region, price.monthly),
                    yearlyPrice: isFree ? 'Free' : money(region, price.annualPerMonth),
                    description:
                        p.key === 'FREE' ? 'Try the full loop, end to end'
                        : p.key === 'CORE' ? 'For solo founders & freelancers'
                        : p.key === 'PRO' ? 'For growing sales teams'
                        : 'Multichannel at full scale',
                    features: featuresFor(p),
                    highlighted: p.key === 'PRO',
                    buttonText: isFree ? 'Start for free' : p.available ? 'Start 14-day trial' : 'Coming soon',
                    icon: ICONS[p.key] || Rocket,
                };
            }),
        [plans, region]
    );

    async function handleSelect(p: ApiPlan) {
        if (p.key === 'FREE') { router.push('/'); return; }
        if (!p.available) { toast('This plan isn\'t available for checkout yet.'); return; }

        setBusyKey(p.key);
        try {
            const cycle = isYearly ? 'ANNUAL' : 'MONTHLY';
            const { data } = await api.post('/billing/checkout', { tier: p.key, cycle });
            const ok = await loadRazorpay();
            if (!ok || !window.Razorpay) {
                // Fallback: Razorpay's hosted subscription page.
                if (data.shortUrl) { window.location.href = data.shortUrl; return; }
                throw new Error('Checkout failed to load');
            }
            const rzp = new window.Razorpay({
                key: data.keyId,
                subscription_id: data.subscriptionId,
                name: 'Qampi',
                description: `${p.label} · ${cycle === 'ANNUAL' ? 'Annual' : 'Monthly'}`,
                theme: { color: '#7c3aed' },
                handler: () => {
                    toast.success('Payment received — activating your plan…');
                    setBusyKey(null);
                },
                modal: { ondismiss: () => setBusyKey(null) },
            });
            rzp.on('payment.failed', () => {
                toast.error('Payment failed. Please try again.');
                setBusyKey(null);
            });
            rzp.open();
        } catch (e: any) {
            toast.error(e?.response?.data?.error || e?.message || 'Could not start checkout');
            setBusyKey(null);
        }
    }

    return (
        <div className="animate-in fade-in duration-500 flex flex-col h-full">
            <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-primary/20 mb-3">
                    <Zap className="w-3 h-3 fill-primary" />
                    <span>2 months free on annual plans</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                    Select your <span className="text-primary">plan</span>
                </h1>
                <p className="text-slate-500 font-semibold text-sm mt-1.5">Scale your outreach safely — upgrade or downgrade anytime.</p>

                <div className="flex flex-wrap justify-center items-center gap-3 mt-4">
                    {/* Region */}
                    <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex items-center">
                        {(['india', 'global'] as Region[]).map((r) => (
                            <button
                                key={r}
                                onClick={() => setRegion(r)}
                                className={cn(
                                    'px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                                    region === r ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
                                )}
                            >
                                {r === 'india' ? 'India · ₹' : 'Global · $'}
                            </button>
                        ))}
                    </div>
                    {/* Billing cycle */}
                    <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex items-center">
                        <button
                            onClick={() => setIsYearly(false)}
                            className={cn('px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all', !isYearly ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600')}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsYearly(true)}
                            className={cn('px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2', isYearly ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-600')}
                        >
                            <span>Annual</span>
                            <span className={cn('px-1.5 py-0.5 rounded-full text-[8px] font-black', isYearly ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary')}>2 mo free</span>
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-5">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-[520px] rounded-[2rem] bg-white border-2 border-slate-100 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-5">
                    {tiers.map((t) => (
                        <PricingCard
                            key={t.key}
                            tier={t}
                            isYearly={isYearly}
                            busy={busyKey === t.key}
                            ctaDisabled={t.plan.key !== 'FREE' && !t.plan.available}
                            billedNote={t.plan.key === 'FREE' ? undefined : `${money(region, t.plan.pricing[CUR[region]].annualTotal)} billed yearly`}
                            onSelect={() => handleSelect(t.plan)}
                        />
                    ))}
                </div>
            )}

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
