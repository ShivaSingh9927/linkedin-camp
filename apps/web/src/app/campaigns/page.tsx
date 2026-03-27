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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { CampaignNameModal } from '@/components/CampaignNameModal';

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusPanel, setStatusPanel] = useState<{ campaignId: string; data: any } | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const createMenuRef = useRef<HTMLDivElement>(null);
    const [pendingCreate, setPendingCreate] = useState<{ defaultName: string; workflowJson: any } | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchCampaigns();
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
            } else {
                await api.post(`/campaigns/${id}/start`);
            }
            fetchCampaigns();
        } catch (error) {
            console.error('Failed to toggle campaign status:', error);
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
        if (!confirm('Remove this lead from campaign?')) return;
        try {
            await api.delete(`/campaigns/${campaignId}/leads/${leadId}`);
            fetchStatus(campaignId);
        } catch (error) {
            alert('Failed to remove lead.');
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
                    { id: 'n2', type: 'ACTION', subType: 'INVITE', data: { label: 'Send Invite', message: '' }, position: { x: 250, y: 200 } },
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

        setPendingCreate({ defaultName, workflowJson });
    };

    const handleConfirmCreate = async (name: string) => {
        if (!pendingCreate) return;
        setPendingCreate(null);
        try {
            const res = await api.post('/campaigns', { name, workflowJson: pendingCreate.workflowJson });
            router.push(`/campaigns/${res.data.id}/builder`);
        } catch (err) {
            alert('Error creating campaign. Make sure the backend is running.');
        }
    };

    const filteredCampaigns = filter === 'ALL'
        ? campaigns
        : campaigns.filter(c => c.status === filter);

    const statusCounts = {
        ALL: campaigns.length,
        ACTIVE: campaigns.filter(c => c.status === 'ACTIVE').length,
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
                <div>
                    <h2 className="text-4xl font-black text-foreground tracking-tight italic uppercase">My Campaigns</h2>
                    <p className="text-muted-foreground font-bold text-sm mt-1 uppercase tracking-widest opacity-60">Automate your outreach ecosystem.</p>
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
                {(['ALL', 'ACTIVE', 'PAUSED', 'DRAFT'] as const).map((tab) => {
                    const icons: Record<string, any> = { ALL: Target, ACTIVE: Play, PAUSED: Pause, DRAFT: Clock };
                    const Icon = icons[tab];
                    const colors: Record<string, string> = {
                        ALL: 'text-primary',
                        ACTIVE: 'text-emerald-500',
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

            {/* Table / Grid */}
            <div className="bg-card border border-border rounded-[3rem] shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
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
                                                    : campaign.status === 'PAUSED'
                                                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                        : 'bg-muted text-muted-foreground border-border'
                                            )}>
                                                {campaign.status}
                                            </span>
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

                            <div className="bg-primary/5 px-10 py-6 border-b border-border flex items-center justify-between">
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Lead Management Control</span>
                                <div className="flex gap-2">
                                    {/* Additional controls could go here */}
                                </div>
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
