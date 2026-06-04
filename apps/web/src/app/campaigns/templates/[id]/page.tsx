"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Layers, Target, Zap, Check, Loader2, Play } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { FALLBACK_TEMPLATES } from '@/lib/template-data';
import { CampaignNameModal } from '@/components/CampaignNameModal';
import { TemplateDetailGraph } from '@/components/templates/TemplateDetailGraph';

interface FullTemplate {
    id: string;
    name: string;
    description: string;
    useCase: string;
    recommendedFor: string[];
    group: string;
    category: string;
    persona?: string | null;
    icon: string;
    color: string;
    durationDays: number;
    stepCount: number;
    delayCount: number;
    requires?: string[];
    aiStrategyHint: {
        objective: string;
        description: string;
        cta: string;
        toneOverride: string;
    };
    workflow: {
        nodes: any[];
        edges: any[];
    };
}

const NODE_LABELS: Record<string, { icon: string; color: string; label: string }> = {
    PROFILE_VISIT: { icon: '👤', color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Visit Profile' },
    WAIT: { icon: '⏳', color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Wait' },
    CONNECT: { icon: '🔗', color: 'text-purple-600 bg-purple-50 border-purple-200', label: 'Send Invite' },
    MESSAGE: { icon: '💬', color: 'text-pink-600 bg-pink-50 border-pink-200', label: 'Send Message' },
    LIKE: { icon: '👍', color: 'text-red-600 bg-red-50 border-red-200', label: 'Like Post' },
    COMMENT: { icon: '💭', color: 'text-orange-600 bg-orange-50 border-orange-200', label: 'Comment' },
    EMAIL_FINDER: { icon: '📡', color: 'text-cyan-600 bg-cyan-50 border-cyan-200', label: 'Find Email' },
    EMAIL: { icon: '📧', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Send Email' },
    FOLLOW: { icon: '👣', color: 'text-gray-600 bg-gray-50 border-gray-200', label: 'Follow' },
    CRM_SYNC: { icon: '📊', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', label: 'CRM Sync' },
    IF_ELSE: { icon: '🔀', color: 'text-teal-600 bg-teal-50 border-teal-200', label: 'Decision' },
};

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

export default function TemplateDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [template, setTemplate] = useState<FullTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!params.id) return;
        api.get<{ template: FullTemplate }>(`/templates/${params.id}`)
            .then(res => setTemplate(res.data.template))
            .catch(err => {
                console.error('Failed to load template from API, using fallback:', err);
                const fallback = FALLBACK_TEMPLATES.find((t: any) => t.id === params.id);
                if (fallback) {
                    setTemplate(fallback);
                } else {
                    router.push('/campaigns/templates');
                }
            })
            .finally(() => setLoading(false));
    }, [params.id, router]);

    const handleConfirmCreate = async (name: string) => {
        if (!template) return;
        setShowModal(false);
        setCreating(true);
        try {
            const res = await api.post('/campaigns', {
                name,
                workflowJson: template.workflow,
                objective: template.aiStrategyHint.objective,
                description: template.aiStrategyHint.description,
                cta: template.aiStrategyHint.cta,
                toneOverride: template.aiStrategyHint.toneOverride,
            });
            router.push(`/campaigns/${res.data.id}/builder`);
        } catch (err) {
            console.error(err);
            alert('Error creating campaign from template.');
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (!template) return null;

    const steps = template.workflow.nodes.filter(n => n.subType !== 'START');

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back navigation */}
            <div className="flex items-center space-x-4">
                <Link href="/campaigns/templates" className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">{template.name}</h1>
                    <p className="text-slate-500 font-medium">{template.description}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left panel — Info */}
                <div className="xl:col-span-1 space-y-6">
                    {/* Metadata card */}
                    <div className="bg-white rounded-3xl border shadow-sm p-6 space-y-5">
                        <div className="flex items-center space-x-3">
                            <span className="text-4xl">{template.icon}</span>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{template.category}</p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-50 rounded-2xl p-3 text-center">
                                <Layers className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                                <p className="text-lg font-black text-slate-800">{template.stepCount || steps.length}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Steps</p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-3 text-center">
                                <Clock className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                                <p className="text-lg font-black text-slate-800">{template.delayCount}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Delays</p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-3 text-center">
                                <Zap className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                                <p className="text-lg font-black text-slate-800">{template.durationDays}d</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Duration</p>
                            </div>
                        </div>

                        {/* Use case */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Use Case</label>
                            <p className="text-sm text-slate-600 leading-relaxed">{template.useCase}</p>
                        </div>

                        {/* Best for */}
                        <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100 space-y-2">
                            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Target className="w-3 h-3" /> Best for
                            </label>
                            <ul className="space-y-1">
                                {template.recommendedFor.map((r, i) => (
                                    <li key={i} className="text-xs text-slate-600 flex items-start">
                                        <Check className="w-3 h-3 text-indigo-400 mr-2 mt-0.5 flex-shrink-0" />
                                        <span>{r}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Requires */}
                        {template.requires && template.requires.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Requires</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {template.requires.map(r => (
                                        <span key={r} className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CTA */}
                        <button
                            onClick={() => setShowModal(true)}
                            disabled={creating}
                            className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            <Play className="w-4 h-4" />
                            {creating ? 'Creating…' : 'Use This Template'}
                        </button>
                    </div>

                    {/* Steps timeline */}
                    <div className="bg-white rounded-3xl border shadow-sm p-6 space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Steps Timeline</label>
                        <div className="space-y-0">
                            {steps.map((node: any, i: number) => {
                                const meta = NODE_LABELS[node.subType];
                                return (
                                    <div key={node.id || i} className="flex items-start space-x-3 py-2">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border ${meta?.color || 'bg-slate-100 border-slate-200'}`}>
                                                <span className="text-xs">{meta?.icon || '•'}</span>
                                            </div>
                                            {i < steps.length - 1 && (
                                                <div className="w-0.5 h-6 bg-slate-200 mt-1" />
                                            )}
                                        </div>
                                        <div className="flex-1 pt-1">
                                            <p className="text-xs font-bold text-slate-700">{node.data?.label || meta?.label || node.subType}</p>
                                            {node.subType === 'WAIT' && node.data?.delayDays && (
                                                <p className="text-[10px] text-amber-500 font-semibold">{node.data.delayDays} day delay</p>
                                            )}
                                            {node.subType === 'IF_ELSE' && (
                                                <p className="text-[10px] text-teal-500 font-semibold">Branching condition</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right panel — Graph */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border shadow-sm p-1 h-[640px]">
                        <TemplateDetailGraph
                            nodes={template.workflow.nodes}
                            edges={template.workflow.edges}
                        />
                    </div>

                    <div className="bg-white rounded-3xl border shadow-sm p-6">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">AI Strategy</label>
                        <div className="space-y-3 text-sm text-slate-600">
                            <div>
                                <span className="font-bold text-slate-700">Objective:</span> {template.aiStrategyHint.objective}
                            </div>
                            <div>
                                <span className="font-bold text-slate-700">Description:</span> {template.aiStrategyHint.description}
                            </div>
                            <div className="flex gap-4">
                                <span className="bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-bold">
                                    CTA: <span className="text-indigo-600">{template.aiStrategyHint.cta}</span>
                                </span>
                                <span className="bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-bold">
                                    Tone: <span className="text-indigo-600">{template.aiStrategyHint.toneOverride}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <CampaignNameModal
                isOpen={showModal}
                defaultName={template.name || 'New Campaign'}
                onConfirm={handleConfirmCreate}
                onCancel={() => setShowModal(false)}
                aiGuidance={template.aiStrategyHint ? {
                    objective: template.aiStrategyHint.objective,
                    description: template.aiStrategyHint.description,
                    cta: template.aiStrategyHint.cta,
                    toneOverride: template.aiStrategyHint.toneOverride,
                } : undefined}
            />
        </div>
    );
}
