"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, ArrowLeft, Users, Globe, Zap, Target, Check } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { FALLBACK_TEMPLATES } from '@/lib/template-data';
import { CampaignNameModal } from '@/components/CampaignNameModal';
import { TemplateFlowStrip } from '@/components/templates/TemplateFlowStrip';

type GroupTab = 'all' | 'my-network' | 'out-of-network' | 'action-triggered' | 'objective-based';

interface TemplateSummary {
    id: string;
    name: string;
    description: string;
    useCase: string;
    recommendedFor: string[];
    group: string;
    category: 'linkedin' | 'email' | 'multi-channel';
    audience?: 'connected' | 'cold' | 'mixed';
    icp?: 'founder' | 'sales' | 'agency' | 'recruiter' | 'job-seeker' | 'creator' | 'universal';
    bestFor?: string;
    persona?: string | null;
    icon: string;
    color: string;
    durationDays: number;
    stepCount: number;
    delayCount: number;
    requires?: string[];
    stepSequence?: string[];
    aiStrategyHint: {
        objective: string;
        description: string;
        cta: string;
        toneOverride: string;
    };
}

interface FullTemplate extends TemplateSummary {
    workflow: {
        nodes: any[];
        edges: any[];
    };
}

const TABS: { key: GroupTab; label: string; icon: typeof Sparkles }[] = [
    { key: 'all', label: 'All', icon: Sparkles },
    { key: 'my-network', label: 'My Network', icon: Users },
    { key: 'out-of-network', label: 'Out of Network', icon: Globe },
    { key: 'action-triggered', label: 'Action-Triggered', icon: Zap },
    { key: 'objective-based', label: 'Objective-Based', icon: Target },
];

const GROUP_LABELS: Record<string, string> = {
    'my-network': 'My Network',
    'out-of-network': 'Out of Network',
    'action-triggered': 'Action-Triggered',
    'objective-based': 'Objective-Based',
};

const GROUP_COLORS: Record<string, string> = {
    'my-network': 'bg-blue-100 text-blue-700',
    'out-of-network': 'bg-purple-100 text-purple-700',
    'action-triggered': 'bg-amber-100 text-amber-700',
    'objective-based': 'bg-emerald-100 text-emerald-700',
};

type AudienceFilter = 'all' | 'connected' | 'cold' | 'mixed';

const AUDIENCE_LABELS: Record<Exclude<AudienceFilter, 'all'>, string> = {
    connected: 'Existing network',
    cold: 'Cold prospects',
    mixed: 'Mixed',
};

const AUDIENCE_BADGE_COLORS: Record<Exclude<AudienceFilter, 'all'>, string> = {
    connected: 'bg-emerald-100 text-emerald-700',
    cold:      'bg-rose-100 text-rose-700',
    mixed:     'bg-indigo-100 text-indigo-700',
};

type ICPFilter = 'all' | 'founder' | 'sales' | 'agency' | 'recruiter' | 'job-seeker' | 'creator' | 'universal';

const ICP_LABELS: Record<Exclude<ICPFilter, 'all'>, string> = {
    'founder':    'Founder',
    'sales':      'Sales / BD',
    'agency':     'Agency',
    'recruiter':  'Recruiter',
    'job-seeker': 'Job Seeker',
    'creator':    'Creator',
    'universal':  'Universal',
};

const ICP_ICONS: Record<Exclude<ICPFilter, 'all'>, string> = {
    'founder': '🧪', 'sales': '🎯', 'agency': '🤝',
    'recruiter': '🧲', 'job-seeker': '👤', 'creator': '📣', 'universal': '🌐',
};

const PERSONA_LABELS: Record<string, string> = {
    'job-seeker': 'Job Seeker',
    'recruiter': 'Recruiter',
    'vc-founder': 'VC / Founder',
    'enterprise-sales': 'Enterprise Sales',
};

export default function TemplatesHubPage() {
    const [tab, setTab] = useState<GroupTab>('all');
    const [audience, setAudience] = useState<AudienceFilter>('all');
    const [icp, setIcp] = useState<ICPFilter>('all');
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingTemplate, setPendingTemplate] = useState<any | null>(null);
    const [creating, setCreating] = useState(false);
    const router = useRouter();

    useEffect(() => {
        api.get('/templates')
            .then(res => setTemplates(res.data.templates || []))
            .catch(err => {
                console.error('Failed to load templates from API, using fallback:', err);
                setTemplates(FALLBACK_TEMPLATES);
            })
            .finally(() => setLoading(false));
    }, []);

    const filtered = templates
        .filter(t => tab === 'all' || t.group === tab)
        .filter(t => audience === 'all' || (t.audience || 'mixed') === audience)
        .filter(t => icp === 'all' || (t.icp || 'universal') === icp);

    const handleUseTemplate = (template: any) => {
        setPendingTemplate(template);
    };

    const handleConfirmCreate = async (name: string) => {
        if (!pendingTemplate) return;
        const summary = pendingTemplate;
        setPendingTemplate(null);
        setCreating(true);
        try {
            let tpl = summary.workflow ? summary : null;
            if (!tpl) {
                try {
                    const res = await api.get<{ template: any }>(`/templates/${summary.id}`);
                    tpl = res.data.template;
                } catch {
                    tpl = FALLBACK_TEMPLATES.find(t => t.id === summary.id) || null;
                }
            }
            if (!tpl) throw new Error('Template not found');
            const res = await api.post('/campaigns', {
                name,
                workflowJson: tpl.workflow,
                objective: tpl.aiStrategyHint.objective,
                description: tpl.aiStrategyHint.description,
                cta: tpl.aiStrategyHint.cta,
                toneOverride: tpl.aiStrategyHint.toneOverride,
            });
            router.push(`/campaigns/${res.data.id}/builder`);
        } catch (err) {
            console.error(err);
            alert('Error creating campaign from template.');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center space-x-4">
                <Link href="/campaigns" className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Campaign Templates</h1>
                    <p className="text-slate-500 font-medium">Prebuilt outreach sequences. Pick one, customize, launch.</p>
                </div>
            </div>

            {/* Category tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 rounded-2xl p-1 w-fit overflow-x-auto">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            tab === t.key
                                ? 'bg-white shadow-sm text-indigo-700'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <t.icon className="w-4 h-4" />
                        <span>{t.label}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            tab === t.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'
                        }`}>
                            {t.key === 'all' ? templates.length : templates.filter(x => x.group === t.key).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* ICP filter — primary axis: who is the user */}
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">I am a:</span>
                {(['all', 'founder', 'sales', 'agency', 'recruiter', 'job-seeker', 'creator', 'universal'] as ICPFilter[]).map(k => {
                    const label = k === 'all' ? 'Any role' : ICP_LABELS[k];
                    const count = k === 'all'
                        ? templates.filter(t => tab === 'all' || t.group === tab).length
                        : templates.filter(t => (tab === 'all' || t.group === tab) && (t.icp || 'universal') === k).length;
                    const active = icp === k;
                    return (
                        <button
                            key={k}
                            onClick={() => setIcp(k)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                                active
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                        >
                            {k !== 'all' && <span className="mr-1">{ICP_ICONS[k]}</span>}
                            {label} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Audience filter pills — pick the right template for your lead list */}
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Lead list:</span>
                {(['all', 'connected', 'cold', 'mixed'] as AudienceFilter[]).map(a => {
                    const label = a === 'all' ? 'Any audience' : AUDIENCE_LABELS[a];
                    const count = a === 'all'
                        ? templates.filter(t => tab === 'all' || t.group === tab).length
                        : templates.filter(t => (tab === 'all' || t.group === tab) && (t.audience || 'mixed') === a).length;
                    const active = audience === a;
                    return (
                        <button
                            key={a}
                            onClick={() => setAudience(a)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                                active
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                            title={
                                a === 'connected' ? 'Templates that work on leads already in your 1st-degree network'
                                : a === 'cold' ? 'Templates designed for prospects you are not yet connected to'
                                : a === 'mixed' ? 'Templates that work on any connection degree'
                                : 'Show all templates'
                            }
                        >
                            {label} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Template grid */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
            )}

            {!loading && filtered.length === 0 && (
                <div className="bg-white border rounded-3xl p-12 text-center">
                    <p className="text-slate-500 font-bold">No templates in this category.</p>
                </div>
            )}

            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map((tpl) => (
                        <Link
                            key={tpl.id}
                            href={`/campaigns/templates/${tpl.id}`}
                            className="bg-white rounded-3xl border shadow-sm hover:shadow-lg transition-all overflow-hidden group flex flex-col cursor-pointer"
                        >
                            <div className={`h-2 bg-gradient-to-r ${tpl.color}`} />
                            {/* Flow preview header — the actual step sequence, no stock art */}
                            <div className={`relative h-36 overflow-hidden bg-gradient-to-br ${tpl.color} bg-opacity-5`}>
                                <div className="absolute inset-0 bg-white/85 backdrop-blur-[1px]" />
                                <div className="relative h-full flex flex-col justify-center px-5 gap-3">
                                    <span className="text-4xl drop-shadow-sm">{tpl.icon}</span>
                                    {tpl.stepSequence && tpl.stepSequence.length > 0 ? (
                                        <TemplateFlowStrip
                                            nodes={tpl.stepSequence.map((s: string) => ({ subType: s }))}
                                            maxSteps={6}
                                        />
                                    ) : null}
                                </div>
                                <div className="absolute top-3 right-3 flex gap-1.5">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${GROUP_COLORS[tpl.group] || 'bg-slate-100 text-slate-600'} backdrop-blur-sm bg-white/90`}>
                                        {GROUP_LABELS[tpl.group] || tpl.group}
                                    </span>
                                    {tpl.icp && tpl.icp !== 'universal' && (
                                        <span
                                            className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700"
                                            title={`Built for ${ICP_LABELS[tpl.icp as Exclude<ICPFilter, 'all'>]}`}
                                        >
                                            {ICP_ICONS[tpl.icp as Exclude<ICPFilter, 'all'>]} {ICP_LABELS[tpl.icp as Exclude<ICPFilter, 'all'>]}
                                        </span>
                                    )}
                                    {tpl.audience && tpl.audience !== 'mixed' && (
                                        <span
                                            className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${AUDIENCE_BADGE_COLORS[tpl.audience as Exclude<AudienceFilter, 'all'>] || 'bg-slate-100 text-slate-600'}`}
                                            title={`Designed for ${AUDIENCE_LABELS[tpl.audience as Exclude<AudienceFilter, 'all'>]?.toLowerCase()}`}
                                        >
                                            {tpl.audience === 'connected' ? '1st-degree' : 'Cold'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 space-y-4 flex flex-col flex-1">
                                {/* Title */}
                                <p className="font-black text-slate-800 uppercase tracking-tight text-sm leading-tight">{tpl.name}</p>

                                {/* Stats */}
                                <div className="flex items-center space-x-2 text-xs text-slate-400">
                                    <span className="bg-slate-50 px-2 py-1 rounded-full font-bold">{tpl.stepCount || '-'} steps</span>
                                    <span className="bg-slate-50 px-2 py-1 rounded-full font-bold">{tpl.delayCount || 0} delays</span>
                                    <span className="bg-slate-50 px-2 py-1 rounded-full font-bold">{tpl.durationDays}d</span>
                                </div>

                                {/* Use Template button */}
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleUseTemplate(tpl);
                                    }}
                                    disabled={creating}
                                    className="mt-auto w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {creating ? 'Creating…' : 'Use Template'}
                                </button>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <CampaignNameModal
                isOpen={!!pendingTemplate}
                defaultName={pendingTemplate?.name || 'New Campaign'}
                onConfirm={handleConfirmCreate}
                onCancel={() => setPendingTemplate(null)}
                aiGuidance={pendingTemplate ? {
                    objective: pendingTemplate.aiStrategyHint.objective,
                    description: pendingTemplate.aiStrategyHint.description,
                    cta: pendingTemplate.aiStrategyHint.cta,
                    toneOverride: pendingTemplate.aiStrategyHint.toneOverride,
                } : undefined}
            />
        </div>
    );
}
