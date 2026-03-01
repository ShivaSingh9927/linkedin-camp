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
} from 'lucide-react';
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
            setStatusPanel({ campaignId, data: response.data });
        } catch (error) {
            console.error('Failed to fetch campaign status:', error);
            setStatusPanel(null);
        } finally {
            setStatusLoading(false);
        }
    };

    const startCreateCampaign = (type: 'linkedin' | 'email' | 'custom') => {
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
        <div className="flex h-full items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">My Campaigns</h2>
                    <p className="text-slate-500 font-medium">Manage and monitor your automated LinkedIn workflows.</p>
                </div>
                <div className="relative" ref={createMenuRef}>
                    <button
                        onClick={() => setShowCreateMenu(!showCreateMenu)}
                        className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Start a Campaign</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showCreateMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showCreateMenu && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white border rounded-2xl shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="p-1.5">
                                <button
                                    onClick={() => startCreateCampaign('linkedin')}
                                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-blue-50 transition-colors text-left group"
                                >
                                    <div className="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                                        <Linkedin className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">LinkedIn</p>
                                        <p className="text-[10px] text-slate-400">Visit → Invite → Message flow</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => startCreateCampaign('email')}
                                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-emerald-50 transition-colors text-left group"
                                >
                                    <div className="p-2 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                                        <Mail className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Email</p>
                                        <p className="text-[10px] text-slate-400">Email drip sequence</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => startCreateCampaign('custom')}
                                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                                >
                                    <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
                                        <Wrench className="w-4 h-4 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Custom</p>
                                        <p className="text-[10px] text-slate-400">Empty canvas, full control</p>
                                    </div>
                                </button>
                                <div className="border-t my-1" />
                                <Link
                                    href="/campaigns/templates"
                                    onClick={() => setShowCreateMenu(false)}
                                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-indigo-50 transition-colors group"
                                >
                                    <div className="p-2 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                                        <LayoutTemplate className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">From Template</p>
                                        <p className="text-[10px] text-slate-400">Pick a prebuilt workflow</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 rounded-2xl p-1 w-fit">
                {(['ALL', 'ACTIVE', 'PAUSED', 'DRAFT'] as const).map((tab) => {
                    const icons: Record<string, any> = { ALL: null, ACTIVE: Play, PAUSED: Pause, DRAFT: Clock };
                    const Icon = icons[tab];
                    const colors: Record<string, string> = {
                        ALL: 'text-slate-700',
                        ACTIVE: 'text-emerald-600',
                        PAUSED: 'text-amber-600',
                        DRAFT: 'text-slate-500',
                    };
                    return (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${filter === tab
                                ? 'bg-white shadow-sm text-slate-800'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {Icon && <Icon className={`w-3 h-3 ${colors[tab]}`} />}
                            <span>{tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                            <span className="ml-1 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                                {statusCounts[tab]}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Table */}
            <div className="bg-white border rounded-3xl shadow-sm overflow-hidden border-slate-200">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/80 text-[10px] font-bold border-b text-slate-500 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-5">Workflow Name</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5">Execution Status</th>
                            <th className="px-6 py-5 text-right pr-10">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                        {filteredCampaigns.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-20 text-center">
                                    <div className="mb-4 bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-slate-200">
                                        <Plus className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 font-bold">
                                        {filter === 'ALL' ? "You don't have any campaigns here" : `No ${filter.toLowerCase()} campaigns`}
                                    </p>
                                    <Link href="/campaigns/new/builder" className="text-indigo-600 text-sm font-black uppercase tracking-tighter hover:underline mt-2 inline-block">Start a campaign →</Link>
                                </td>
                            </tr>
                        ) : filteredCampaigns.map((campaign) => (
                            <tr key={campaign.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-5">
                                    <Link href={`/campaigns/${campaign.id}/builder`} className="font-black text-slate-900 hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                        {campaign.name}
                                    </Link>
                                    <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1">ID: {campaign.id.slice(0, 8)}...</p>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center space-x-2">
                                        {campaign.status === 'ACTIVE' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter border shadow-sm ${campaign.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            campaign.status === 'PAUSED' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                'bg-slate-50 text-slate-600 border-slate-100'
                                            }`}>
                                            {campaign.status}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-sm">
                                    <div className="flex items-center space-x-2 text-slate-500 font-medium">
                                        <Clock className="w-4 h-4 text-slate-300" />
                                        <span>Last active just now</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right pr-10">
                                    <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => fetchStatus(campaign.id)}
                                            className="p-3 hover:bg-indigo-50 border rounded-xl transition-all shadow-sm hover:shadow-md"
                                            title="View Status"
                                        >
                                            <Info className="w-4 h-4 text-indigo-500" />
                                        </button>
                                        <button
                                            onClick={() => toggleStatus(campaign.id, campaign.status)}
                                            className="p-3 hover:bg-white border rounded-xl transition-all shadow-sm hover:shadow-md"
                                        >
                                            {campaign.status === 'ACTIVE' ? (
                                                <Pause className="w-4 h-4 text-amber-600 fill-amber-600" />
                                            ) : (
                                                <Play className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => deleteCampaign(campaign.id)}
                                            className="p-3 hover:bg-red-50 border rounded-xl transition-all group/del"
                                            title="Delete Campaign"
                                        >
                                            <Trash2 className="w-4 h-4 text-slate-300 group-hover/del:text-red-500" />
                                        </button>
                                        <Link
                                            href={`/campaigns/${campaign.id}/builder`}
                                            className="p-3 hover:bg-white border rounded-xl transition-all shadow-sm hover:shadow-md"
                                        >
                                            <MoreVertical className="w-4 h-4 text-slate-400" />
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Status Panel Modal */}
            {statusPanel && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-8 py-5 border-b bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                    Campaign Status
                                </h3>
                                {statusPanel.data && (
                                    <p className="text-sm text-slate-500 font-medium mt-0.5">
                                        {statusPanel.data.campaign.name}
                                        <span className={`ml-2 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${statusPanel.data.campaign.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                                            }`}>{statusPanel.data.campaign.status}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setStatusPanel(null)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto px-8 py-6">
                            {statusLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                </div>
                            ) : statusPanel.data?.leads?.length === 0 ? (
                                <div className="text-center py-20">
                                    <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-500 font-bold">No leads enrolled in this campaign yet.</p>
                                    <p className="text-slate-400 text-sm mt-1">Start the campaign with leads to see status here.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {statusPanel.data?.leads?.map((lead: any) => (
                                        <div key={lead.campaignLeadId} className="border rounded-2xl p-5 hover:shadow-sm transition-shadow">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-black text-slate-800 uppercase tracking-tight">
                                                        {lead.lead.firstName} {lead.lead.lastName}
                                                    </p>
                                                    <a
                                                        href={lead.lead.linkedinUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-indigo-500 hover:underline"
                                                    >
                                                        {lead.lead.linkedinUrl}
                                                    </a>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase border ${lead.isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}>
                                                    {lead.isCompleted ? 'Completed' : 'In Progress'}
                                                </span>
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                                <div className="bg-slate-50 rounded-xl px-4 py-2">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Step</p>
                                                    <p className="text-slate-700 font-semibold text-xs mt-0.5">{lead.currentStepId?.slice(0, 12) || 'N/A'}</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-xl px-4 py-2">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Action</p>
                                                    <p className="text-slate-700 font-semibold text-xs mt-0.5">
                                                        {lead.nextActionDate ? new Date(lead.nextActionDate).toLocaleString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Ice-breaker */}
                                            {lead.personalization && (
                                                <div className="mt-3 bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3">
                                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">AI Ice-breaker</p>
                                                    <p className="text-sm text-indigo-900 leading-relaxed">{lead.personalization}</p>
                                                </div>
                                            )}

                                            {/* Recent Logs */}
                                            {lead.recentLogs?.length > 0 && (
                                                <div className="mt-3">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Recent Activity</p>
                                                    <div className="space-y-1">
                                                        {lead.recentLogs.map((log: any, idx: number) => (
                                                            <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg hover:bg-slate-50">
                                                                <div className="flex items-center space-x-2">
                                                                    <CheckCircle2 className={`w-3 h-3 ${log.status === 'SUCCESS' ? 'text-emerald-500' : log.status === 'FAILED' ? 'text-red-500' : 'text-slate-300'}`} />
                                                                    <span className="font-bold text-slate-600">{log.actionType.replace(/_/g, ' ')}</span>
                                                                </div>
                                                                <div className="flex items-center space-x-3">
                                                                    <span className={`font-bold ${log.status === 'SUCCESS' ? 'text-emerald-600' : log.status === 'FAILED' ? 'text-red-600' : 'text-slate-400'}`}>
                                                                        {log.status}
                                                                    </span>
                                                                    <span className="text-slate-400">{new Date(log.executedAt).toLocaleTimeString()}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Campaign Name Modal */}
            <CampaignNameModal
                isOpen={!!pendingCreate}
                defaultName={pendingCreate?.defaultName || 'New Campaign'}
                onConfirm={handleConfirmCreate}
                onCancel={() => setPendingCreate(null)}
            />
        </div>
    );
}
