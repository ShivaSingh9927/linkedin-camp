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

    const handleSave = async (shouldStart = false) => {
        setSaving(true);
        const workflowJson = {
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
                    await api.post(`/campaigns/${id}/start`);
                    setStatus('ACTIVE');
                    alert('Campaign Started Successfully!');
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
                        onClick={() => handleSave(true)}
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
        </div>
    );
}
