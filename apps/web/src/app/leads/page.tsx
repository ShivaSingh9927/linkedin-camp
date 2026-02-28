"use client";

import { useState, useEffect } from 'react';
import {
    Search,
    Filter,
    Download,
    Linkedin,
    ChevronRight,
    Plus,
    Check,
    Zap,
    Loader2
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Lead {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    company: string;
    status: string;
    linkedinUrl: string;
}

interface Campaign {
    id: string;
    name: string;
    status: string;
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);

    useEffect(() => {
        fetchLeads();
        fetchCampaigns();
    }, []);

    const fetchLeads = async () => {
        try {
            const response = await api.get('/leads');
            setLeads(response.data);
        } catch (error) {
            console.error('Failed to fetch leads:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCampaigns = async () => {
        try {
            const response = await api.get('/campaigns');
            setCampaigns(response.data.filter((c: any) => c.status !== 'COMPLETED'));
        } catch (error) {
            console.error('Failed to fetch campaigns:', error);
        }
    };

    const generateDemo = async () => {
        setActionLoading(true);
        try {
            await api.post('/leads/demo');
            await fetchLeads();
        } catch (error) {
            alert('Demo generation failed. Ensure backend and DB are running.');
        } finally {
            setActionLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedLeads.size === leads.length) {
            setSelectedLeads(new Set());
        } else {
            setSelectedLeads(new Set(leads.map(l => l.id)));
        }
    };

    const toggleSelectLead = (id: string) => {
        const newSelected = new Set(selectedLeads);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedLeads(newSelected);
    };

    const assignToCampaign = async (campaignId: string) => {
        try {
            await api.post(`/campaigns/${campaignId}/start`, {
                leadIds: Array.from(selectedLeads)
            });
            alert(`Success! ${selectedLeads.size} leads assigned to campaign.`);
            setSelectedLeads(new Set());
            setShowAssignModal(false);
        } catch (error) {
            console.error('Failed to assign leads:', error);
            alert('Error assigning leads.');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold">Leads</h2>
                    <p className="text-muted-foreground">Manage your LinkedIn contacts and prospects.</p>
                </div>
                <div className="flex space-x-3">
                    {leads.length === 0 && !loading && (
                        <button
                            onClick={generateDemo}
                            disabled={actionLoading}
                            className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 border border-indigo-100 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors shadow-sm"
                        >
                            {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                            <span>Generate Demo Data</span>
                        </button>
                    )}
                    {selectedLeads.size > 0 && (
                        <button
                            onClick={() => setShowAssignModal(true)}
                            className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 animate-in fade-in slide-in-from-right-4"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Assign {selectedLeads.size} leads</span>
                        </button>
                    )}
                    <button className="flex items-center space-x-2 bg-white border border-slate-200 px-4 py-2 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                        <Download className="w-5 h-5 text-slate-400" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <div className="flex space-x-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search leads by name, title, or company..."
                        className="w-full pl-12 pr-4 py-3 border rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>
                <button className="flex items-center space-x-2 px-6 py-3 border rounded-2xl bg-white hover:bg-slate-50 transition-colors text-slate-600 shadow-sm font-bold">
                    <Filter className="w-5 h-5 text-slate-400" />
                    <span>Filters</span>
                </button>
            </div>

            <div className="bg-white border rounded-3xl shadow-sm overflow-hidden border-slate-200">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 text-[10px] font-bold border-b text-slate-500 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4 w-10">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    checked={leads.length > 0 && selectedLeads.size === leads.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Title & Company</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">LinkedIn</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                        {loading ? (
                            <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></td></tr>
                        ) : leads.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-20 text-center space-y-4">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Linkedin className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <p className="text-slate-500 font-medium">Your lead database is currently empty.</p>
                                    <p className="text-sm text-slate-400 max-w-xs mx-auto">Use the Waalaxy Chrome extension to import leads from LinkedIn search results.</p>
                                </td>
                            </tr>
                        ) : leads.map((lead) => (
                            <tr
                                key={lead.id}
                                className={cn(
                                    "hover:bg-slate-50 transition-colors cursor-pointer group",
                                    selectedLeads.has(lead.id) && "bg-indigo-50/50"
                                )}
                                onClick={() => toggleSelectLead(lead.id)}
                            >
                                <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                        checked={selectedLeads.has(lead.id)}
                                        onChange={() => toggleSelectLead(lead.id)}
                                    />
                                </td>
                                <td className="px-6 py-5">
                                    <span className="font-bold text-slate-900">{lead.firstName} {lead.lastName}</span>
                                </td>
                                <td className="px-6 py-5 text-sm">
                                    <p className="font-semibold text-slate-800">{lead.jobTitle}</p>
                                    <p className="text-slate-500">{lead.company}</p>
                                </td>
                                <td className="px-6 py-5">
                                    <span className={cn(
                                        "text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter shadow-sm border",
                                        lead.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            lead.status === 'INVITE_PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                'bg-slate-50 text-slate-600 border-slate-100'
                                    )}>
                                        {lead.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-5">
                                    <a
                                        href={lead.linkedinUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-slate-400 hover:text-blue-600 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Linkedin className="w-5 h-5" />
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Basic Assign Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 border animate-in zoom-in-95 duration-200">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Assign to Campaign</h3>
                        <p className="text-sm text-slate-500 mb-8 font-medium">Select target campaign for <span className="text-indigo-600 font-bold">{selectedLeads.size}</span> prospects.</p>

                        <div className="space-y-3 max-h-[350px] overflow-y-auto mb-8 pr-2 custom-scrollbar">
                            {campaigns.length === 0 ? (
                                <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border-2 border-dashed">
                                    <p className="text-slate-500 font-bold italic mb-2">No campaigns found.</p>
                                    <Link href="/campaigns" className="text-indigo-600 font-bold hover:underline">Create your first campaign →</Link>
                                </div>
                            ) : campaigns.map(campaign => (
                                <button
                                    key={campaign.id}
                                    onClick={() => assignToCampaign(campaign.id)}
                                    className="w-full flex items-center justify-between p-5 border-2 border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-indigo-600/20 transition-all text-left group"
                                >
                                    <div>
                                        <p className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-sm">{campaign.name}</p>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{campaign.status}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all" />
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowAssignModal(false)}
                            className="w-full py-4 rounded-2xl bg-slate-100 font-black text-slate-600 hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest"
                        >
                            Nevermind
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
