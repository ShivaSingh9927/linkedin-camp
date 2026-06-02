"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Plus,
    MoreVertical,
    Play,
    Pause,
    Clock,
    CheckCircle2,
    Loader2,
    Trash2,
    Info,
    X,
    AlertCircle,
    ChevronDown,
    Linkedin,
    Mail,
    Wrench,
    LayoutTemplate,
    Target,
    User,
    Send,
    ThumbsUp,
    MessageSquare,
    Eye,
    Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { SafetyQuotaBadge } from '@/components/SafetyQuotaBadge';
import { CampaignEta } from '@/components/CampaignEta';
import { CampaignNameModal } from '@/components/CampaignNameModal';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface CampaignActivity {
    campaignId: string;
    leadId: string;
    leadName: string;
    node: string;
    action: 'executing' | 'success' | 'failed';
    details: Record<string, any>;
    error?: string;
    timestamp: string;
}

const nodeIcons: Record<string, any> = {
    'warmup': Eye,
    'profile-visit': User,
    'connect': User,
    'like-nth-post': ThumbsUp,
    'comment-nth-post': MessageSquare,
    'send-message': Send,
    'delay': Clock,
};

const nodeLabels: Record<string, string> = {
    'warmup': 'Warmup',
    'profile-visit': 'Profile Visit',
    'connect': 'Connect',
    'like-nth-post': 'Like Post',
    'comment-nth-post': 'Comment',
    'send-message': 'Send Message',
    'delay': 'Delay',
};

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusPanel, setStatusPanel] = useState<{ campaignId: string; data: any } | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const createMenuRef = useRef<HTMLDivElement>(null);
    const [pendingCreate, setPendingCreate] = useState<{ defaultName: string; workflowJson: any; aiDetails?: { objective: string; description: string; cta: string; toneOverride: string; } } | null>(null);
    const [activities, setActivities] = useState<CampaignActivity[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [strategyData, setStrategyData] = useState<any>(null);
    const [strategyLoading, setStrategyLoading] = useState(false);
    const [aiGuidance, setAiGuidance] = useState<{
        objective: string;
        description: string;
        cta: string;
        toneOverride: string;
    } | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchCampaigns();
        fetchUserStrategy();
    }, []);

    const fetchUserStrategy = async () => {
        setStrategyLoading(true);
        try {
            const userContext = await api.get('/strategy/user-context');
            if (userContext.data && userContext.data.aiStrategy) {
                const aiStrategy = userContext.data.aiStrategy;
                // Extract guidance from AI strategy
                const guidance = extractCampaignGuidance(aiStrategy);
                setAiGuidance(guidance);
            }
        } catch (error) {
            console.error('Failed to fetch user strategy:', error);
        } finally {
            setStrategyLoading(false);
        }
    };

    const extractCampaignGuidance = (strategy: any) => {
        // Default values
        let objective = 'Connect with prospects and generate leads';
        let description = 'Targeted outreach to decision makers in relevant industries';
        let cta = 'connect';
        let toneOverride = 'professional';

        // Try to extract from strategy if available
        if (typeof strategy === 'string') {
            try {
                const parsed = JSON.parse(strategy);
                if (parsed.objective) objective = parsed.objective;
                if (parsed.description) description = parsed.description;
                if (parsed.cta) cta = parsed.cta;
                if (parsed.toneOverride) toneOverride = parsed.toneOverride;
            } catch (e) {
                // If not JSON, try to extract from text
                if (strategy.includes('objective')) {
                    // Simple extraction - in a real app this would be more sophisticated
                    objective = 'Based on your AI strategy: ' + strategy.substring(0, 100) + '...';
                }
            }
        } else if (strategy && typeof strategy === 'object') {
            if (strategy.objective) objective = strategy.objective;
            if (strategy.description) description = strategy.description;
            if (strategy.cta) cta = strategy.cta;
            if (strategy.toneOverride) toneOverride = strategy.toneOverride;
        }

        return { objective, description, cta, toneOverride };
    };

    // Real-time campaign activity via Socket.IO
    useEffect(() => {
        const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
        const newSocket = io(apiBase);
        setSocket(newSocket);

        const token = localStorage.getItem('token');
        if (token) {
            newSocket.emit('join_room', { token });
        }

        newSocket.on('campaign_activity', (data: CampaignActivity) => {
            console.log('[SOCKET] Campaign activity:', data);
            setActivities(prev => [data, ...prev].slice(0, 50));
            
            // Show toast for completed actions
            if (data.action === 'success') {
                const nodeLabel = nodeLabels[data.node] || data.node;
                toast.success(`${nodeLabel} completed for ${data.leadName}`, {
                    description: data.details?.company ? `Company: ${data.details.company}` : undefined,
                    duration: 2,
                });
            } else if (data.action === 'failed') {
                const nodeLabel = nodeLabels[data.node] || data.node;
                toast.error(`${nodeLabel} failed for ${data.leadName}`, {
                    description: data.error || undefined,
                    duration: 3,
                });
            }
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
                setShowCreateMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchCampaigns = async () => {
        try {
            const response = await api.get('/campaigns');
            setCampaigns(response.data);
        } catch (error) {
            console.error('Failed to fetch campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        try {
            if (currentStatus === 'ACTIVE') {
                await api.post(`/campaigns/${id}/pause`);
            } else if (currentStatus === 'QUEUED') {
                // Pulling out of the queue → DRAFT
                await api.post(`/campaigns/${id}/unqueue`);
            } else {
                await api.post(`/campaigns/${id}/start`);
            }
            fetchCampaigns();
        } catch (error: any) {
            // 409 ACTIVE_CAMPAIGN_EXISTS — offer to queue this one instead.
            if (error?.response?.status === 409 && error.response.data?.error === 'ACTIVE_CAMPAIGN_EXISTS') {
                const activeName = error.response.data?.message?.match(/"([^"]+)"/)?.[1] || 'another campaign';
                const shouldQueue = confirm(
                    `You already have an active campaign (${activeName}). ` +
                    `Only one campaign can run at a time on LinkedIn.\n\n` +
                    `Queue this campaign to run next when the current one finishes?`
                );
                if (shouldQueue) {
                    try {
                        await api.post(`/campaigns/${id}/queue`);
                        toast.success('Campaign queued. It will start automatically when the active one completes.');
                        fetchCampaigns();
                    } catch (qErr: any) {
                        toast.error('Failed to queue campaign: ' + (qErr?.response?.data?.error || qErr.message));
                    }
                }
                return;
            }
            // 400 LEAD_CAP_EXCEEDED — show the cap clearly.
            if (error?.response?.status === 400 && error.response.data?.error === 'LEAD_CAP_EXCEEDED') {
                const { cap, provided } = error.response.data;
                toast.error(`Too many leads (${provided}/${cap}). Remove some leads or upgrade your plan.`);
                return;
            }
            console.error('Failed to toggle campaign status:', error);
            toast.error('Failed to update campaign');
        }
    };

    const deleteCampaign = async (id: string) => {
        if (!confirm('Are you absolutely sure? This will remove all progress for this campaign.')) return;
        try {
            await api.delete(`/campaigns/${id}`);
            if (statusPanel?.campaignId === id) setStatusPanel(null);
            fetchCampaigns();
        } catch (error) {
            console.error('Failed to delete campaign:', error);
        }
    };

    const fetchStatus = async (campaignId: string) => {
        setStatusLoading(true);
        setStatusPanel({ campaignId, data: null });
        try {
            const response = await api.get(`/campaigns/${campaignId}/status`);
            const allLeadsRes = await api.get('/leads');

            // Filter out leads already in this campaign
            const currentLeadIds = new Set(response.data.leads.map((l: any) => l.lead.id));
            const availableLeads = allLeadsRes.data.filter((l: any) => !currentLeadIds.has(l.id));

            setStatusPanel({
                campaignId,
                data: {
                    ...response.data,
                    availableLeads
                }
            });
        } catch (error) {
            console.error('Failed to fetch campaign status:', error);
            setStatusPanel(null);
        } finally {
            setStatusLoading(false);
        }
    };

const removeLeadFromCampaign = async (campaignId: string, leadId: string) => {
        try {
            await api.delete(`/campaigns/${campaignId}/leads/${leadId}`);
            fetchStatus(campaignId);
        } catch (error) {
            console.error('Failed to remove lead:', error);
        }
    };

    const exportCampaign = async (campaignId: string, format: 'json' | 'csv' = 'csv') => {
        try {
            const response = await api.get(`/campaigns/${campaignId}/export?format=${format}`);
            
            // For CSV, create download
            if (format === 'csv') {
                const blob = new Blob([response.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `campaign-export-${campaignId.slice(0, 8)}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                // JSON - show in new tab
                const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `campaign-export-${campaignId.slice(0, 8)}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Failed to export:', error);
        }
    };

    const addLeadToCampaign = async (campaignId: string, leadId: string) => {
        try {
            await api.post(`/campaigns/${campaignId}/start`, { leadIds: [leadId] });
            fetchStatus(campaignId);
        } catch (error) {
            alert('Failed to add lead.');
        }
    };

    const startCreateCampaign = (type: 'linkedin' | 'email' | 'enrichment' | 'custom') => {
        setShowCreateMenu(false);
        let defaultName = 'New Campaign';
        let workflowJson: any = { nodes: [], edges: [] };

        if (type === 'linkedin') {
            defaultName = 'LinkedIn Campaign';
            workflowJson = {
                nodes: [
                    { id: 'trigger', type: 'TRIGGER', subType: 'START', data: { label: 'Trigger: Lead Added' }, position: { x: 250, y: 0 } },
                    { id: 'n1', type: 'ACTION', subType: 'PROFILE_VISIT', data: { label: 'Visit Profile' }, position: { x: 250, y: 100 } },
                    { id: 'n2', type: 'ACTION', subType: 'CONNECT', data: { label: 'Send Invite', message: '' }, position: { x: 250, y: 200 } },
                    { id: 'n3', type: 'DELAY', subType: 'WAIT', data: { label: 'Wait 2 days', delayDays: 2 }, position: { x: 250, y: 300 } },
                    { id: 'n4', type: 'ACTION', subType: 'MESSAGE', data: { label: 'Send Message', message: '' }, position: { x: 250, y: 400 } },
                ],
                edges: [
                    { id: 'e1', source: 'trigger', target: 'n1' },
                    { id: 'e2', source: 'n1', target: 'n2' },
                    { id: 'e3', source: 'n2', target: 'n3' },
                    { id: 'e4', source: 'n3', target: 'n4' },
                ],
            };
        } else if (type === 'enrichment') {
            defaultName = 'Lead Enrichment';
            workflowJson = {
                nodes: [
                    { id: 'trigger', type: 'TRIGGER', subType: 'START', data: { label: 'Trigger: Lead Added' }, position: { x: 250, y: 0 } },
                    { 
                        id: 'n1', 
                        type: 'ACTION', 
                        subType: 'VISIT', 
                        data: { 
                            label: 'Profile Visit (Enrich)', 
                            enrichCompany: true, 
                            enrichAbout: true, 
                            enrichContact: true, 
                            enrichPosts: true 
                        }, 
                        position: { x: 250, y: 100 } 
                    },
                ],
                edges: [
                    { id: 'e1', source: 'trigger', target: 'n1' },
                ],
            };
        } else if (type === 'email') {
            defaultName = 'Email Campaign';
            workflowJson = {
                nodes: [
                    { id: 'trigger', type: 'TRIGGER', subType: 'START', data: { label: 'Trigger: Lead Added' }, position: { x: 250, y: 0 } },
                    { id: 'n1', type: 'ACTION', subType: 'EMAIL', data: { label: 'Send Email', message: '' }, position: { x: 250, y: 100 } },
                    { id: 'n2', type: 'DELAY', subType: 'WAIT', data: { label: 'Wait 3 days', delayDays: 3 }, position: { x: 250, y: 200 } },
                    { id: 'n3', type: 'ACTION', subType: 'EMAIL', data: { label: 'Follow-up Email', message: '' }, position: { x: 250, y: 300 } },
                ],
                edges: [
                    { id: 'e1', source: 'trigger', target: 'n1' },
                    { id: 'e2', source: 'n1', target: 'n2' },
                    { id: 'e3', source: 'n2', target: 'n3' },
                ],
            };
        } else {
            workflowJson = {
                nodes: [
                    { id: 'trigger', type: 'TRIGGER', subType: 'START', data: { label: 'Trigger: Lead Added' }, position: { x: 250, y: 50 } },
                ],
                edges: [],
            };
        }

        setPendingCreate({ 
            defaultName, 
            workflowJson
        });
    };

    const handleConfirmCreate = async (name: string, details: any) => {
        if (!pendingCreate) return;
        setPendingCreate(null);
        try {
            // Use AI guidance as default values, but allow user to override
            const finalObjective = details.objective || pendingCreate.aiDetails?.objective || '';
            const finalDescription = details.description || pendingCreate.aiDetails?.description || '';
            const finalCta = details.cta || pendingCreate.aiDetails?.cta || 'connect';
            const finalToneOverride = details.toneOverride || pendingCreate.aiDetails?.toneOverride || 'professional';
            
            const res = await api.post('/campaigns', { 
                name, 
                workflowJson: pendingCreate.workflowJson,
                objective: finalObjective,
                description: finalDescription,
                cta: finalCta,
                toneOverride: finalToneOverride
            });
            router.push(`/campaigns/${res.data.id}/builder`);
        } catch (err) {
            alert('Error creating campaign. Make sure the backend is running.');
        }
    };

    // Order: ACTIVE first (one of), then QUEUED by queuePosition asc, then
    // everything else by createdAt desc. This makes the user's pipeline
    // obvious at a glance: what's running, what's next, what's done.
    const sortedCampaigns = [...campaigns].sort((a, b) => {
        const rank = (s: string) => s === 'ACTIVE' ? 0 : s === 'QUEUED' ? 1 : 2;
        const ra = rank(a.status), rb = rank(b.status);
        if (ra !== rb) return ra - rb;
        if (a.status === 'QUEUED' && b.status === 'QUEUED') {
            return (a.queuePosition ?? 999) - (b.queuePosition ?? 999);
        }
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    const filteredCampaigns = filter === 'ALL'
        ? sortedCampaigns
        : sortedCampaigns.filter(c => c.status === filter);

    const statusCounts = {
        ALL: campaigns.length,
        ACTIVE: campaigns.filter(c => c.status === 'ACTIVE').length,
        QUEUED: campaigns.filter(c => c.status === 'QUEUED').length,
        PAUSED: campaigns.filter(c => c.status === 'PAUSED').length,
        DRAFT: campaigns.filter(c => c.status === 'DRAFT').length,
    };

    if (loading) return (
        <div className="flex h-[60vh] items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
    );

    return (
        <div className="space-y-8 lg:space-y-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="space-y-3">
                    <div>
                        <h2 className="text-4xl font-black text-foreground tracking-tight italic uppercase">My Campaigns</h2>
                        <p className="text-muted-foreground font-bold text-sm mt-1 uppercase tracking-widest opacity-60">Automate your outreach ecosystem.</p>
                    </div>
                    <SafetyQuotaBadge />
                </div>
                <div className="relative group" ref={createMenuRef}>
                    <button
                        onClick={() => setShowCreateMenu(!showCreateMenu)}
                        className="flex items-center space-x-3 bg-primary text-primary-foreground px-8 py-4 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 hover:-translate-y-1 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Start a Campaign</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showCreateMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showCreateMenu && (
                        <div className="absolute right-0 top-full mt-4 w-72 bg-background border border-border rounded-[2.5rem] shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 p-2">
                            <div className="space-y-1">
                                <button
                                    onClick={() => startCreateCampaign('linkedin')}
                                    className="w-full flex items-center space-x-4 px-5 py-4 rounded-3xl hover:bg-muted transition-all text-left group"
                                >
                                    <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <Linkedin className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-foreground uppercase tracking-tight">LinkedIn</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Growth Machine</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => startCreateCampaign('enrichment')}
                                    className="w-full flex items-center space-x-4 px-5 py-4 rounded-3xl hover:bg-muted transition-all text-left group"
                                >
                                    <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                                        <Wrench className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-foreground uppercase tracking-tight">Lead Enrichment</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Scrape & Save</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => startCreateCampaign('email')}
                                    className="w-full flex items-center space-x-4 px-5 py-4 rounded-3xl hover:bg-muted transition-all text-left group"
                                >
                                    <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                        <Mail className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-foreground uppercase tracking-tight">Cold Email</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Direct Inbox</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => startCreateCampaign('custom')}
                                    className="w-full flex items-center space-x-4 px-5 py-4 rounded-3xl hover:bg-muted transition-all text-left group"
                                >
                                    <div className="w-10 h-10 bg-slate-500/10 rounded-2xl flex items-center justify-center group-hover:bg-slate-500/20 transition-colors">
                                        <Wrench className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-foreground uppercase tracking-tight">Custom Builder</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Full Control</p>
                                    </div>
                                </button>
                                <div className="border-t border-border mx-4 my-2" />
                                <Link
                                    href="/campaigns/templates"
                                    onClick={() => setShowCreateMenu(false)}
                                    className="w-full flex items-center space-x-4 px-5 py-4 rounded-3xl hover:bg-primary/5 transition-all group"
                                >
                                    <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <LayoutTemplate className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-primary uppercase tracking-tight">Templates</p>
                                        <p className="text-[10px] font-bold text-primary/60 uppercase">Prebuilt Flows</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
                {(['ALL', 'ACTIVE', 'QUEUED', 'PAUSED', 'DRAFT'] as const).map((tab) => {
                    const icons: Record<string, any> = { ALL: Target, ACTIVE: Play, QUEUED: Clock, PAUSED: Pause, DRAFT: Clock };
                    const Icon = icons[tab];
                    const colors: Record<string, string> = {
                        ALL: 'text-primary',
                        ACTIVE: 'text-emerald-500',
                        QUEUED: 'text-blue-500',
                        PAUSED: 'text-amber-500',
                        DRAFT: 'text-muted-foreground',
                    };
                    return (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={cn(
                                "flex items-center space-x-3 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all border",
                                filter === tab
                                    ? "bg-foreground text-background border-foreground shadow-lg"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                            )}
                        >
                            <Icon className={cn("w-3.5 h-3.5", filter === tab ? "text-background" : colors[tab])} />
                            <span>{tab}</span>
                            <span className={cn(
                                "ml-1.5 px-2 py-0.5 rounded-full font-black min-w-[20px] text-center",
                                filter === tab ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                            )}>
                                {statusCounts[tab]}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Workflow List (Table on Desktop, Cards on Mobile) */}
            <div className="bg-card border border-border rounded-[2.5rem] sm:rounded-[3rem] shadow-soft overflow-hidden">
                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-muted/50 text-[10px] font-black border-b border-border text-muted-foreground uppercase tracking-[0.2em]">
                            <tr>
                                <th className="px-10 py-8">Workflow</th>
                                <th className="px-10 py-8">Status</th>
                                <th className="px-10 py-8">Performance</th>
                                <th className="px-10 py-8 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredCampaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-24 text-center">
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="mb-8 bg-muted w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto border-4 border-dashed border-border"
                                        >
                                            <Plus className="w-10 h-10 text-muted-foreground/30" />
                                        </motion.div>
                                        <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Empty Ecosystem</h3>
                                        <p className="text-muted-foreground font-medium text-sm mt-1">
                                            {filter === 'ALL' ? "You haven't initialized any campaigns." : `No ${filter.toLowerCase()} iterations found.`}
                                        </p>
                                        <Link href="/campaigns/new/builder" className="inline-flex mt-8 bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all hover:scale-105">
                                            Start Your First Campaign
                                        </Link>
                                    </td>
                                </tr>
                            ) : filteredCampaigns.map((campaign) => (
                                <tr key={campaign.id} className="hover:bg-muted/30 transition-all group">
                                    <td className="px-10 py-8">
                                        <Link href={`/campaigns/${campaign.id}/builder`} className="block">
                                            <span className="text-lg font-black text-foreground hover:text-primary transition-colors tracking-tight uppercase">
                                                {campaign.name}
                                            </span>
                                            <div className="flex items-center space-x-2 mt-1.5 opacity-60">
                                                <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">ID: {campaign.id.slice(0, 8)}</span>
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center space-x-3">
                                            {campaign.status === 'ACTIVE' && (
                                                <span className="relative flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                                </span>
                                            )}
                                            <span className={cn(
                                                "text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border shadow-sm",
                                                campaign.status === 'ACTIVE'
                                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                    : campaign.status === 'QUEUED'
                                                        ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                                        : campaign.status === 'PAUSED'
                                                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                            : 'bg-muted text-muted-foreground border-border'
                                            )}>
                                                {campaign.status}{campaign.status === 'QUEUED' && campaign.queuePosition ? ` #${campaign.queuePosition}` : ''}
                                            </span>
                                            {(campaign.status === 'ACTIVE' || campaign.status === 'QUEUED') && (
                                                <CampaignEta campaignId={campaign.id} />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em]">Engine health</span>
                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Normal</span>
                                            </div>
                                            <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 w-full opacity-80" />
                                            </div>
                                        </div>
                                        {/* Live activity count for this campaign */}
                                        {campaign.status === 'ACTIVE' && (() => {
                                            const campaignActivities = activities.filter(a => a.campaignId === campaign.id);
                                            const completed = campaignActivities.filter(a => a.action === 'success').length;
                                            const failed = campaignActivities.filter(a => a.action === 'failed').length;
                                            if (completed > 0 || failed > 0) {
                                                return (
                                                    <div className="mt-2 flex items-center gap-2 text-[10px]">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                        <span className="font-bold text-emerald-600">{completed}</span>
                                                        {failed > 0 && (
                                                            <>
                                                                <AlertCircle className="w-3 h-3 text-red-500 ml-2" />
                                                                <span className="font-bold text-red-600">{failed}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => fetchStatus(campaign.id)}
                                                className="w-12 h-12 flex items-center justify-center bg-muted/50 text-muted-foreground hover:text-primary hover:bg-muted rounded-2xl transition-all group/info"
                                                title="View Status"
                                            >
                                                <Info className="w-5 h-5 group-hover/info:scale-110 transition-transform" />
                                            </button>
                                            <button
                                                onClick={() => toggleStatus(campaign.id, campaign.status)}
                                                className={cn(
                                                    "w-12 h-12 flex items-center justify-center rounded-2xl transition-all shadow-soft",
                                                    campaign.status === 'ACTIVE'
                                                        ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                                        : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                                )}
                                            >
                                                {campaign.status === 'ACTIVE' ? (
                                                    <Pause className="w-5 h-5 fill-current" />
                                                ) : (
                                                    <Play className="w-5 h-5 fill-current ml-1" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => deleteCampaign(campaign.id)}
                                                className="w-12 h-12 flex items-center justify-center bg-muted/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-2xl transition-all group/del"
                                                title="Delete Campaign"
                                            >
                                                <Trash2 className="w-5 h-5 group-hover/del:scale-110 transition-transform" />
                                            </button>
                                            <Link
                                                href={`/campaigns/${campaign.id}/builder`}
                                                className="w-12 h-12 flex items-center justify-center bg-muted/50 text-muted-foreground hover:bg-muted rounded-2xl transition-all"
                                            >
                                                <MoreVertical className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile view */}
                <div className="md:hidden divide-y divide-border">
                    {filteredCampaigns.length === 0 ? (
                        <div className="p-10 text-center">
                            <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Empty Ecosystem</h3>
                            <p className="text-muted-foreground text-xs mt-1">No iterations found.</p>
                            <Link href="/campaigns/new/builder" className="inline-flex mt-6 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest">
                                Start Campaign
                            </Link>
                        </div>
                    ) : filteredCampaigns.map((campaign) => (
                        <div key={campaign.id} className="p-6 space-y-6">
                            <div className="flex justify-between items-start">
                                <Link href={`/campaigns/${campaign.id}/builder`} className="min-w-0 flex-1">
                                    <h4 className="text-base font-black text-foreground uppercase truncate tracking-tight">{campaign.name}</h4>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">ID: {campaign.id.slice(0, 8)}</p>
                                </Link>
                                <span className={cn(
                                    "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border shrink-0",
                                    campaign.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                        : campaign.status === 'QUEUED' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                        : 'bg-muted text-muted-foreground'
                                )}>
                                    {campaign.status}{campaign.status === 'QUEUED' && campaign.queuePosition ? ` #${campaign.queuePosition}` : ''}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-50">Engine Status</p>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-20 h-1 bg-muted rounded-full">
                                            <div className="h-full bg-emerald-500 w-full" />
                                        </div>
                                        <span className="text-[9px] font-black text-emerald-500 uppercase">100%</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => fetchStatus(campaign.id)}
                                        className="w-10 h-10 flex items-center justify-center bg-muted/50 text-muted-foreground rounded-xl"
                                    >
                                        <Info className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(campaign.id, campaign.status)}
                                        className={cn(
                                            "w-10 h-10 flex items-center justify-center rounded-xl",
                                            campaign.status === 'ACTIVE' ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
                                        )}
                                    >
                                        {campaign.status === 'ACTIVE' ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                                    </button>
                                    <button
                                        onClick={() => deleteCampaign(campaign.id)}
                                        className="w-10 h-10 flex items-center justify-center bg-muted/50 text-muted-foreground rounded-xl"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Status Panel Modal */}
            <AnimatePresence>
                {statusPanel && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setStatusPanel(null)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md cursor-pointer"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 30 }}
                            className="bg-background rounded-[3rem] shadow-2xl border border-border w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col relative z-50"
                        >
                            <div className="px-10 py-10 border-b border-border flex items-center justify-between bg-muted/30">
                                <div>
                                    <h3 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Engine Status</h3>
                                    {statusPanel.data && (
                                        <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-70">
                                            {statusPanel.data.campaign.name} • {statusPanel.data.campaign.status}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={() => exportCampaign(statusPanel.campaignId, 'csv')}
                                        className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/20 transition-all"
                                        title="Export CSV"
                                    >
                                        <Download className="w-4 h-4 text-emerald-600" />
                                    </button>
                                    <button
                                        onClick={() => fetchStatus(statusPanel.campaignId)}
                                        className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center hover:bg-muted transition-all"
                                        title="Refresh Status"
                                    >
                                        <Loader2 className={cn("w-4 h-4", statusLoading && "animate-spin")} />
                                    </button>
                                    <button
                                        onClick={() => setStatusPanel(null)}
                                        className="w-12 h-12 rounded-2xl bg-white border border-border flex items-center justify-center hover:bg-muted transition-all shadow-sm"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Live Activity Feed */}
                            {activities.length > 0 && (
                                <div className="bg-gradient-to-r from-emerald-500/5 to-primary/5 px-10 py-6 border-b border-border">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            Live Activity
                                        </span>
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                            {activities.filter(a => a.action === 'success').length} completed
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {activities.slice(0, 5).map((activity, idx) => {
                                            const Icon = nodeIcons[activity.node] || Loader2;
                                            const isSuccess = activity.action === 'success';
                                            const isFailed = activity.action === 'failed';
                                            return (
                                                <div key={idx} className={cn(
                                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-xs",
                                                    isSuccess && "bg-emerald-500/10 text-emerald-700",
                                                    isFailed && "bg-red-500/10 text-red-700",
                                                    activity.action === 'executing' && "bg-primary/10 text-primary"
                                                )}>
                                                    {activity.action === 'executing' ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : isSuccess ? (
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    ) : (
                                                        <AlertCircle className="w-3 h-3" />
                                                    )}
                                                    <span className="font-bold">{nodeLabels[activity.node] || activity.node}</span>
                                                    <span className="truncate flex-1">{activity.leadName}</span>
                                                    <span className="opacity-60">
                                                        {new Date(activity.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="bg-primary/5 px-10 py-6 border-b border-border flex items-center justify-between">
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Lead Management Control</span>
                                {statusPanel.data?.stats && (
                                    <div className="flex gap-4 text-[10px] font-bold">
                                        <span className="text-muted-foreground">Total: {statusPanel.data.stats.total}</span>
                                        <span className="text-emerald-600">✓ {statusPanel.data.stats.completed || 0}</span>
                                        <span className="text-red-500">✗ {statusPanel.data.stats.failed || 0}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                                {statusLoading ? (
                                    <div className="flex h-64 items-center justify-center">
                                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                    </div>
                                ) : statusPanel.data?.leads?.length === 0 ? (
                                    <div className="text-center py-20 opacity-50 space-y-4">
                                        <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground" />
                                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Engine is currently empty.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-12">
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between px-2">
                                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Active Deployment ({statusPanel.data?.leads?.length})</h4>
                                            </div>
                                            {statusPanel.data?.leads?.map((lead: any) => (
                                                <div key={lead.campaignLeadId} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-soft hover:shadow-xl transition-all relative group">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h4 className="text-lg font-black text-foreground uppercase tracking-tight">{lead.lead.firstName} {lead.lead.lastName}</h4>
                                                            <a href={lead.lead.linkedinUrl} target="_blank" className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:underline mt-1 inline-block opacity-80">View Nexus Link</a>
                                                        </div>
                                                        <div className="flex items-center space-x-3">
                                                            <span className={cn(
                                                                "text-[9px] font-black px-4 py-1.5 rounded-full border shadow-sm uppercase tracking-widest",
                                                                lead.isCompleted ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-primary/10 text-primary border-primary/20"
                                                            )}>
                                                                {lead.isCompleted ? 'Finalized' : 'Operational'}
                                                            </span>
                                                            <button
                                                                onClick={() => removeLeadFromCampaign(statusPanel.campaignId, lead.lead.id)}
                                                                className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all"
                                                                title="Remove from Campaign"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Enriched Data */}
                                                    {(lead.lead.company || lead.lead.jobTitle || lead.nodeOutputs?.['profile-visit']?.company) && (
                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            {lead.lead.company || lead.nodeOutputs?.['profile-visit']?.company ? (
                                                                <span className="text-[10px] font-bold px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full">
                                                                    {lead.lead.company || lead.nodeOutputs?.['profile-visit']?.company}
                                                                </span>
                                                            ) : null}
                                                            {lead.lead.jobTitle || lead.nodeOutputs?.['profile-visit']?.jobTitle ? (
                                                                <span className="text-[10px] font-bold px-3 py-1 bg-purple-500/10 text-purple-600 rounded-full">
                                                                    {lead.lead.jobTitle || lead.nodeOutputs?.['profile-visit']?.jobTitle}
                                                                </span>
                                                            ) : null}
                                                            {(lead.lead.aboutInfo || lead.nodeOutputs?.['profile-visit']?.about) && (
                                                                <span className="text-[10px] font-bold px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full">
                                                                    About extracted
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-2 gap-4 mt-8">
                                                        <div className="bg-muted p-5 rounded-3xl border border-border/50">
                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Execution Point</span>
                                                            <p className="text-sm font-black text-foreground uppercase tracking-tight mt-1 truncate">{lead.currentStepId?.slice(-8) || 'INITIAL'}</p>
                                                        </div>
                                                        <div className="bg-muted p-5 rounded-3xl border border-border/50">
                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Synchronizer</span>
                                                            <p className="text-sm font-black text-foreground mt-1 tracking-tight">
                                                                {lead.nextActionDate ? new Date(lead.nextActionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'READY'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Execution Log - Show failed steps */}
                                                    {lead.execLog?.some((e: any) => e.status === 'failed') && (
                                                        <div className="mt-6 p-4 bg-red-500/5 rounded-2xl border border-red-500/20">
                                                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Failed Steps</span>
                                                            {lead.execLog?.filter((e: any) => e.status === 'failed').map((e: any, idx: number) => (
                                                                <div key={idx} className="text-xs text-red-500 mt-2">
                                                                    {e.node}: {e.error || 'Unknown error'}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {lead.personalization && (
                                                        <div className="mt-6 p-6 bg-primary/5 rounded-[2rem] border border-primary/10 italic">
                                                            <p className="text-sm text-foreground leading-relaxed font-medium">"{lead.personalization}"</p>
                                                        </div>
                                                    )}

                                                    {lead.recentLogs?.length > 0 && (
                                                        <div className="mt-8 border-t border-border pt-6">
                                                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 block">Operation Sequence</span>
                                                            <div className="space-y-3">
                                                                {lead.recentLogs.map((log: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center justify-between bg-muted/40 p-4 rounded-2xl border border-border/30">
                                                                        <div className="flex items-center space-x-4">
                                                                            <div className={cn("w-2 h-2 rounded-full", log.status === 'SUCCESS' ? "bg-emerald-500" : "bg-red-500")} />
                                                                            <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{log.actionType.replace(/_/g, ' ')}</span>
                                                                        </div>
                                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                                                                            {new Date(log.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add Leads Section */}
                                        <div className="pt-10 border-t border-border">
                                            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 italic">Available Prospects for Reinforcement</h4>
                                            {statusPanel.data?.availableLeads?.length === 0 ? (
                                                <p className="text-xs font-bold text-muted-foreground/40 text-center py-10 uppercase italic">No available prospects in global list.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {statusPanel.data?.availableLeads?.map((lead: any) => (
                                                        <div key={lead.id} className="flex items-center justify-between p-5 bg-muted/20 border border-border/50 rounded-3xl hover:bg-white transition-all group">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-black text-foreground uppercase truncate">{lead.firstName} {lead.lastName}</p>
                                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{lead.company || 'Global Entity'}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => addLeadToCampaign(statusPanel.campaignId, lead.id)}
                                                                className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <CampaignNameModal
                isOpen={!!pendingCreate}
                defaultName={pendingCreate?.defaultName || 'New Campaign'}
                onConfirm={handleConfirmCreate}
                onCancel={() => setPendingCreate(null)}
            />
        </div>
    );
}
