"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Plus,
    MoreVertical,
    Play,
    Pause,
    Clock,
    CheckCircle2,
    Loader2,
    Trash2
} from 'lucide-react';
import api from '@/lib/api';

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCampaigns();
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
            fetchCampaigns();
        } catch (error) {
            console.error('Failed to delete campaign:', error);
        }
    };

    if (loading) return (
        <div className="flex h-full items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Your Campaigns</h2>
                    <p className="text-slate-500 font-medium">Manage and monitor your automated LinkedIn workflows.</p>
                </div>
                <Link
                    href="/campaigns/new/builder"
                    className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                    <Plus className="w-5 h-5" />
                    <span>Create New</span>
                </Link>
            </div>

            <div className="bg-white border rounded-3xl shadow-sm overflow-hidden border-slate-200">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/80 text-[10px] font-bold border-b text-slate-500 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-5">Workflow Name</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5">Execution Status</th>
                            <th className="px-6 py-5 text-right pr-10">Command</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                        {campaigns.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-20 text-center">
                                    <div className="mb-4 bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-slate-200">
                                        <Plus className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 font-bold">No campaigns created yet.</p>
                                    <Link href="/campaigns/new/builder" className="text-indigo-600 text-sm font-black uppercase tracking-tighter hover:underline mt-2 inline-block">Build your first →</Link>
                                </td>
                            </tr>
                        ) : campaigns.map((campaign) => (
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
        </div>
    );
}
