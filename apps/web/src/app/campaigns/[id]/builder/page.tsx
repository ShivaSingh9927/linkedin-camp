"use client";

import React, { useState, useEffect, use } from 'react';
import { CampaignBuilder } from "@/components/CampaignBuilder";
import { ArrowLeft, Save, Play, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useNodesState, useEdgesState, Node, Edge } from '@xyflow/react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function CampaignBuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [campaignName, setCampaignName] = useState('New Campaign');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<string>('DRAFT');

    // Lead Selection Modal state
    const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
    const [availableLeads, setAvailableLeads] = useState<any[]>([]);
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [loadingLeads, setLoadingLeads] = useState(false);

    useEffect(() => {
        fetchCampaign();
    }, [id]);

    const fetchCampaign = async () => {
        if (id === 'new') {
            setNodes([
                { id: 'node_1', position: { x: 250, y: 50 }, data: { label: 'Trigger: Lead Added' }, type: 'input' }
            ]);
            setLoading(false);
            return;
        }

        try {
            const response = await api.get(`/campaigns/${id}`);
            const campaign = response.data;
            setCampaignName(campaign.name);
            setStatus(campaign.status);

            if (campaign.workflowJson) {
                setNodes(campaign.workflowJson.nodes || []);
                setEdges(campaign.workflowJson.edges || []);
            }
        } catch (error) {
            console.error('Failed to fetch campaign:', error);
        } finally {
            setLoading(false);
        }
    };

    const getWorkflowJson = () => {
        return {
            nodes: nodes.map(n => ({
                id: n.id,
                type: n.data?.type || 'TRIGGER',
                subType: n.data?.subType || 'START',
                data: n.data?.data || {},
                position: n.position
            })),
            edges: edges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target
            }))
        };
    };

    const handleSave = async (shouldStart = false, leadIds?: string[]) => {
        setSaving(true);
        const workflowJson = getWorkflowJson();

        try {
            if (id === 'new') {
                const response = await api.post('/campaigns', {
                    name: campaignName,
                    workflowJson
                });
                alert('Campaign Created Successfully!');
                router.push(`/campaigns/${response.data.id}/builder`);
            } else {
                await api.put(`/campaigns/${id}`, {
                    name: campaignName,
                    workflowJson
                });

                if (shouldStart) {
                    const res = await api.post(`/campaigns/${id}/start`, { leadIds });
                    setStatus('ACTIVE');

                    const meta = res.data?.meta;
                    let message = 'Campaign Started Successfully!';
                    if (meta && meta.skippedCount > 0) {
                        message += `\n\nNotification: ${meta.skippedCount} leads were skipped securely because they are already active in another campaign!`;
                    }
                    alert(message);
                    setIsLaunchModalOpen(false);
                } else {
                    alert('Campaign Saved Successfully!');
                }
            }
        } catch (error) {
            console.error('Failed to save campaign:', error);
            alert('Error saving campaign.');
        } finally {
            setSaving(false);
        }
    };

    const openLaunchModal = async () => {
        setIsLaunchModalOpen(true);
        setLoadingLeads(true);
        try {
            const res = await api.get('/leads');
            const leads = res.data.leads || res.data; // Handle pagination if any
            setAvailableLeads(Array.isArray(leads) ? leads : []);
            // reset selection
            setSelectedLeadIds([]);
        } catch (error) {
            console.error('Failed to fetch leads:', error);
            alert('Failed to load leads');
        } finally {
            setLoadingLeads(false);
        }
    };

    const toggleLeadSelection = (leadId: string) => {
        setSelectedLeadIds(prev =>
            prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
        );
    };

    const handleLaunchConfirm = () => {
        if (selectedLeadIds.length === 0) {
            alert('Please select at least one lead to launch the campaign.');
            return;
        }
        handleSave(true, selectedLeadIds);
    };

    if (loading) return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 border-b bg-card rounded-2xl shadow-sm">
                <div className="flex items-center space-x-4">
                    <Link href="/campaigns" className="p-2 hover:bg-slate-100 rounded-full transition-all">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Link>
                    <div className="space-y-1">
                        <input
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                            className="text-xl font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-800 placeholder:text-slate-400"
                            placeholder="Campaign Name"
                        />
                        <div className="flex items-center space-x-2 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                status === 'PAUSED' ? 'bg-amber-100 text-amber-700' :
                                    status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                                        'bg-blue-100 text-blue-700'
                                }`}>
                                {status}
                            </span>
                            <span className="text-slate-400">ID: {id}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => handleSave(false)}
                        disabled={saving}
                        className="flex items-center space-x-2 px-5 py-2.5 border rounded-xl font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all text-sm"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>{id === 'new' ? 'Create Draft' : 'Save Changes'}</span>
                    </button>

                    <button
                        onClick={openLaunchModal}
                        disabled={saving || status === 'ACTIVE'}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all text-sm"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Launch Campaign</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 relative rounded-2xl overflow-hidden border">
                <CampaignBuilder
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    setNodes={setNodes}
                    setEdges={setEdges}
                />
            </div>

            {/* Launch Modal */}
            {isLaunchModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Select Leads</h2>
                                <p className="text-sm font-medium text-slate-500">Choose the leads you want to enroll in this campaign.</p>
                            </div>
                            <button onClick={() => setIsLaunchModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors">
                                <ArrowLeft className="w-5 h-5 rotate-180" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-white">
                            {loadingLeads ? (
                                <div className="flex justify-center items-center py-12">
                                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                </div>
                            ) : availableLeads.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 font-medium">
                                    No leads found. Please import some leads first.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{availableLeads.length} Available</span>
                                        <button
                                            onClick={() => setSelectedLeadIds(
                                                selectedLeadIds.length === availableLeads.length
                                                    ? []
                                                    : availableLeads.map(l => l.id)
                                            )}
                                            className="text-indigo-600 text-sm font-bold hover:text-indigo-700"
                                        >
                                            {selectedLeadIds.length === availableLeads.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    {availableLeads.map((lead) => (
                                        <label
                                            key={lead.id}
                                            className="flex items-center space-x-4 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedLeadIds.includes(lead.id)}
                                                onChange={() => toggleLeadSelection(lead.id)}
                                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-800 truncate">{lead.firstName} {lead.lastName}</p>
                                                <p className="text-xs text-slate-500 truncate">{lead.jobTitle} @ {lead.company}</p>
                                            </div>
                                            <div className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded drop-shadow-sm">
                                                {lead.status}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t bg-slate-50 flex justify-between items-center">
                            <span className="font-bold text-slate-600">
                                {selectedLeadIds.length} lead(s) selected
                            </span>
                            <div className="space-x-3">
                                <button
                                    onClick={() => setIsLaunchModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleLaunchConfirm}
                                    disabled={saving || selectedLeadIds.length === 0}
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all flex items-center space-x-2"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                                    <span>Confirm & Launch</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}