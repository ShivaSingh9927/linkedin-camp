"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PREBUILT_TEMPLATES } from '@/lib/prebuilt-templates';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { CampaignNameModal } from '@/components/CampaignNameModal';

export default function TemplatesGalleryPage() {
    const router = useRouter();
    const [pendingTemplate, setPendingTemplate] = useState<typeof PREBUILT_TEMPLATES[0] | null>(null);

    const handleUseTemplate = (template: typeof PREBUILT_TEMPLATES[0]) => {
        setPendingTemplate(template);
    };

    const handleConfirmCreate = async (name: string) => {
        if (!pendingTemplate) return;
        const template = pendingTemplate;
        setPendingTemplate(null);
        try {
            const workflowJson = {
                nodes: template.nodes.map(n => ({
                    id: n.id,
                    type: n.data?.type || 'TRIGGER',
                    subType: n.data?.subType || 'START',
                    data: n.data || {},
                    position: n.position,
                })),
                edges: template.edges,
            };
            const res = await api.post('/campaigns', { name, workflowJson });
            router.push(`/campaigns/${res.data.id}/builder`);
        } catch (err) {
            console.error('Failed to create campaign from template:', err);
            alert('Error creating campaign. Make sure the backend is running.');
        }
    };

    const categories = [
        { key: 'linkedin', label: 'LinkedIn', color: 'bg-blue-100 text-blue-700' },
        { key: 'email', label: 'Email', color: 'bg-emerald-100 text-emerald-700' },
        { key: 'multi-channel', label: 'Multi-Channel', color: 'bg-amber-100 text-amber-700' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center space-x-4">
                <Link href="/campaigns" className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Prebuilt Templates</h1>
                    <p className="text-slate-500 font-medium">Choose a ready-made workflow and start your campaign in seconds.</p>
                </div>
            </div>

            {categories.map((cat) => {
                const templates = PREBUILT_TEMPLATES.filter(t => t.category === cat.key);
                if (templates.length === 0) return null;
                return (
                    <div key={cat.key} className="space-y-4">
                        <div className="flex items-center space-x-3">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${cat.color}`}>
                                {cat.label}
                            </span>
                            <span className="text-sm text-slate-400 font-bold">{templates.length} templates</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {templates.map((tpl) => (
                                <div
                                    key={tpl.id}
                                    className="bg-white rounded-3xl border shadow-sm hover:shadow-lg transition-all overflow-hidden group"
                                >
                                    <div className={`h-2 bg-gradient-to-r ${tpl.color}`} />
                                    <div className="p-6 space-y-4">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-3xl">{tpl.icon}</span>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase tracking-tight">{tpl.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tpl.category}</p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-500 leading-relaxed">{tpl.description}</p>

                                        {/* Workflow preview */}
                                        <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Workflow Steps</p>
                                            {tpl.nodes.filter(n => n.data.subType !== 'START').map((node, idx) => (
                                                <div key={node.id} className="flex items-center space-x-2 text-xs">
                                                    <span className="w-5 h-5 rounded-full bg-white border flex items-center justify-center text-[10px] font-bold text-slate-400 flex-shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <span className={`font-bold ${node.data.subType === 'WAIT' ? 'text-amber-600' :
                                                        node.data.subType === 'MESSAGE' || node.data.subType === 'EMAIL' ? 'text-pink-600' :
                                                            node.data.subType === 'INVITE' ? 'text-purple-600' :
                                                                node.data.subType === 'AI_PERSONALIZE' ? 'text-indigo-600' :
                                                                    'text-blue-600'
                                                        }`}>
                                                        {node.data.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-center space-x-2 text-xs text-slate-400">
                                            <span className="bg-slate-50 px-2 py-1 rounded-full font-bold">{tpl.nodes.length - 1} steps</span>
                                            <span className="bg-slate-50 px-2 py-1 rounded-full font-bold">{tpl.nodes.filter(n => n.data.subType === 'WAIT').length} delays</span>
                                        </div>

                                        <button
                                            onClick={() => handleUseTemplate(tpl)}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                                        >
                                            Use This Template
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Campaign Name Modal */}
            <CampaignNameModal
                isOpen={!!pendingTemplate}
                defaultName={pendingTemplate?.name || 'New Campaign'}
                onConfirm={handleConfirmCreate}
                onCancel={() => setPendingTemplate(null)}
            />
        </div>
    );
}
