"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Clock, Play, Loader2, Check, GitBranch, ListOrdered,
    User, UserPlus, MessageCircle, MessageSquare, ThumbsUp, Mail, Radar,
    Footprints, Database, Sparkles, Linkedin, Layers,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { FALLBACK_TEMPLATES } from '@/lib/template-data';
import { CampaignNameModal } from '@/components/CampaignNameModal';
import { TemplateDetailGraph } from '@/components/templates/TemplateDetailGraph';
import { Card, Button, Badge, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

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
    aiStrategyHint: { objective: string; description: string; cta: string; toneOverride: string };
    workflow: { nodes: any[]; edges: any[] };
}

// Map a workflow node subType to a lucide icon + tinted chip for the timeline.
const NODE_META: Record<string, { Icon: any; cls: string; label: string }> = {
    PROFILE_VISIT: { Icon: User, cls: 'bg-blue-50 text-blue-600', label: 'Visit profile' },
    WAIT: { Icon: Clock, cls: 'bg-amber-50 text-amber-600', label: 'Wait' },
    CONNECT: { Icon: UserPlus, cls: 'bg-brand-50 text-brand', label: 'Send invite' },
    MESSAGE: { Icon: MessageCircle, cls: 'bg-pink-50 text-pink-600', label: 'Send message' },
    LIKE: { Icon: ThumbsUp, cls: 'bg-red-50 text-red-600', label: 'Like post' },
    COMMENT: { Icon: MessageSquare, cls: 'bg-orange-50 text-orange-600', label: 'Comment' },
    EMAIL_FINDER: { Icon: Radar, cls: 'bg-cyan-50 text-cyan-600', label: 'Find email' },
    EMAIL: { Icon: Mail, cls: 'bg-emerald-50 text-emerald-600', label: 'Send email' },
    FOLLOW: { Icon: Footprints, cls: 'bg-surface text-ink-500', label: 'Follow' },
    CRM_SYNC: { Icon: Database, cls: 'bg-indigo-50 text-indigo-600', label: 'CRM sync' },
    IF_ELSE: { Icon: GitBranch, cls: 'bg-teal-50 text-teal-600', label: 'Decision' },
};

const GROUP_LABELS: Record<string, string> = {
    'my-network': 'My Network',
    'out-of-network': 'Out of Network',
    'objective-based': 'Objective-Based',
};

const CHANNEL_META: Record<string, { label: string; icon: any; tone: 'info' | 'brand' | 'success' }> = {
    linkedin: { label: 'LinkedIn', icon: Linkedin, tone: 'info' },
    'multi-channel': { label: 'Multi-channel', icon: Layers, tone: 'brand' },
    email: { label: 'Email', icon: Mail, tone: 'success' },
};

export default function TemplateDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [template, setTemplate] = useState<FullTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showFlow, setShowFlow] = useState(false);

    useEffect(() => {
        if (!params.id) return;
        api.get<{ template: FullTemplate }>(`/templates/${params.id}`)
            .then(res => setTemplate(res.data.template))
            .catch(err => {
                console.error('Failed to load template from API, using fallback:', err);
                const fallback = FALLBACK_TEMPLATES.find((t: any) => t.id === params.id);
                if (fallback) setTemplate(fallback);
                else router.push('/campaigns/templates');
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
            <div className="space-y-6">
                <Skeleton className="h-9 w-72 rounded-control" />
                <Skeleton className="h-24 rounded-card" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-96 rounded-card lg:col-span-2" />
                    <Skeleton className="h-96 rounded-card" />
                </div>
            </div>
        );
    }

    if (!template) return null;

    const steps = template.workflow.nodes.filter(n => n.subType !== 'START');
    const branched = template.workflow.nodes.some(n => n.subType === 'IF_ELSE');
    const channel = CHANNEL_META[template.category] || CHANNEL_META.linkedin;

    const useBtn = (
        <Button onClick={() => setShowModal(true)} disabled={creating}>
            <Play className="w-4 h-4" />
            {creating ? 'Creating…' : 'Use this template'}
        </Button>
    );

    return (
        <div className="space-y-6">
            <Link href="/campaigns" className="label !text-brand inline-flex items-center gap-1 hover:underline">
                <ArrowLeft className="w-4 h-4" /> Templates
            </Link>

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-5">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-control bg-surface text-2xl grid place-items-center shrink-0">{template.icon}</div>
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <Badge tone={channel.tone}><channel.icon className="w-3 h-3" />{channel.label}</Badge>
                            {GROUP_LABELS[template.group] && <Badge tone="neutral">{GROUP_LABELS[template.group]}</Badge>}
                            {branched && <Badge tone="info"><GitBranch className="w-3 h-3" />Branches on response</Badge>}
                        </div>
                        <h1 className="text-[26px] font-bold tracking-tight leading-none text-foreground">{template.name}</h1>
                        <p className="text-ink-500 font-medium mt-2 max-w-2xl">{template.description}</p>
                    </div>
                </div>
                <div className="shrink-0">{useBtn}</div>
            </div>

            {/* Decision stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-4"><div className="label">Steps</div><p className="num text-[24px] mt-1">{template.stepCount || steps.length}</p></Card>
                <Card className="p-4"><div className="label">Delays</div><p className="num text-[24px] mt-1">{template.delayCount}</p></Card>
                <Card className="p-4"><div className="label">Duration</div><p className="num text-[24px] mt-1">{template.durationDays}<span className="text-ink-400 text-[15px] ml-0.5">days</span></p></Card>
                <Card className="p-4"><div className="label">Channel</div><p className="text-[15px] font-semibold mt-1.5">{channel.label}</p></Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main */}
                <div className="lg:col-span-2 space-y-6">
                    {/* The sequence — graph for branched, timeline (+graph toggle) for linear */}
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold tracking-tight">The sequence</h3>
                            {!branched && (
                                <button onClick={() => setShowFlow((v) => !v)} className="text-[12px] font-semibold text-brand flex items-center gap-1.5">
                                    {showFlow ? <><ListOrdered className="w-4 h-4" />Show as steps</> : <><GitBranch className="w-4 h-4" />View full flow diagram</>}
                                </button>
                            )}
                        </div>

                        {branched || showFlow ? (
                            <>
                                {branched && (
                                    <p className="text-[13px] text-ink-500 font-medium mb-3">This template branches based on whether the prospect connects or replies — shown as a flow.</p>
                                )}
                                <div className="rounded-control border border-line overflow-hidden h-[460px]">
                                    <TemplateDetailGraph nodes={template.workflow.nodes} edges={template.workflow.edges} />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-0">
                                {steps.map((node: any, i: number) => {
                                    const meta = NODE_META[node.subType] || { Icon: Sparkles, cls: 'bg-surface text-ink-500', label: node.subType };
                                    const last = i === steps.length - 1;
                                    return (
                                        <div key={node.id || i} className="flex gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className={cn('w-9 h-9 rounded-control grid place-items-center', meta.cls)}>
                                                    <meta.Icon className="w-4 h-4" />
                                                </div>
                                                {!last && <div className="w-px flex-1 bg-line my-1" />}
                                            </div>
                                            <div className={cn(last ? '' : 'pb-5')}>
                                                <div className="text-[14px] font-semibold text-foreground">{node.data?.label || meta.label}</div>
                                                {node.subType === 'WAIT' && node.data?.delayDays && (
                                                    <div className="text-[12px] text-amber-600 font-medium">{node.data.delayDays} day delay</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Side rail */}
                <div className="space-y-4">
                    {/* What this does */}
                    <Card className="p-5">
                        <h3 className="font-bold tracking-tight mb-2">What this does</h3>
                        <p className="text-[13px] text-ink-700 font-medium leading-relaxed">{template.useCase}</p>
                    </Card>

                    {/* Best for + requires */}
                    <Card className="p-5">
                        <div className="label mb-3">Best for</div>
                        <ul className="space-y-2.5">
                            {template.recommendedFor.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-[13px] font-medium text-ink-700">
                                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />{r}
                                </li>
                            ))}
                        </ul>
                        {template.requires && template.requires.length > 0 && (
                            <>
                                <div className="border-t border-line my-4" />
                                <div className="label mb-2">Requires</div>
                                <div className="flex flex-wrap gap-2">
                                    {template.requires.map((r) => (
                                        <span key={r} className="text-[12px] font-semibold text-ink-500 bg-surface rounded-chip px-2.5 py-1">{r}</span>
                                    ))}
                                </div>
                            </>
                        )}
                    </Card>

                    {/* How the AI writes it */}
                    <Card className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-brand" />
                            <h3 className="font-bold tracking-tight">How the AI writes it</h3>
                        </div>
                        <p className="text-[13px] text-ink-700 font-medium leading-relaxed">
                            <b className="text-foreground">Goal:</b> {template.aiStrategyHint.objective}
                        </p>
                        <p className="text-[12px] text-ink-500 font-medium leading-relaxed mt-2">{template.aiStrategyHint.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            <span className="text-[12px] font-semibold text-ink-700 bg-surface rounded-chip px-3 py-1.5">CTA · <span className="text-brand">{template.aiStrategyHint.cta}</span></span>
                            <span className="text-[12px] font-semibold text-ink-700 bg-surface rounded-chip px-3 py-1.5">Tone · <span className="text-brand">{template.aiStrategyHint.toneOverride}</span></span>
                        </div>
                    </Card>

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
