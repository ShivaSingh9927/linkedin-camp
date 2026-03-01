"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PREBUILT_TEMPLATES } from '@/lib/prebuilt-templates';
import { Sparkles, FileText, MessageSquare, Mail, Linkedin, Plus } from 'lucide-react';
import api from '@/lib/api';
import { CampaignNameModal } from '@/components/CampaignNameModal';

type Tab = 'workflows' | 'messages';

// Sample message templates (for demo)
const MESSAGE_TEMPLATES = [
    { id: 1, name: 'Professional Intro', channel: 'linkedin', type: 'message', content: 'Hi {firstName}, I came across your profile and was impressed by your work at {company}. Would love to connect and exchange insights!' },
    { id: 2, name: 'Event Follow-up', channel: 'linkedin', type: 'message', content: 'Hi {firstName}, great connecting at the event! I really enjoyed our conversation about {jobTitle} trends. Would love to continue the discussion.' },
    { id: 3, name: 'Invite with Value', channel: 'linkedin', type: 'invite', content: 'Hi {firstName}, I noticed we share interests in the same space. I\'d love to connect and share some resources I think you\'d find valuable.' },
    { id: 4, name: 'Cold Email Opener', channel: 'email', type: 'email', content: 'Hi {firstName},\n\nI hope this email finds you well. I came across {company} and was intrigued by your approach.\n\nI\'d love to schedule a quick 15-minute call to discuss how we might collaborate.\n\nBest regards' },
    { id: 5, name: 'Follow-up Email', channel: 'email', type: 'email', content: 'Hi {firstName},\n\nJust wanted to follow up on my previous email. I understand you\'re busy, but I believe there\'s real value in connecting.\n\nWould any time this week work for a brief chat?\n\nBest' },
];

export default function TemplatesHubPage() {
    const [tab, setTab] = useState<Tab>('workflows');
    const [msgFilter, setMsgFilter] = useState<string>('all');
    const [pendingTemplate, setPendingTemplate] = useState<typeof PREBUILT_TEMPLATES[0] | null>(null);
    const router = useRouter();

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
            alert('Error creating campaign. Make sure the backend is running.');
        }
    };

    const filteredMessages = msgFilter === 'all'
        ? MESSAGE_TEMPLATES
        : MESSAGE_TEMPLATES.filter(m => m.channel === msgFilter);

    const categories = [
        { key: 'linkedin', label: 'LinkedIn', color: 'bg-blue-100 text-blue-700' },
        { key: 'email', label: 'Email', color: 'bg-emerald-100 text-emerald-700' },
        { key: 'multi-channel', label: 'Multi-Channel', color: 'bg-amber-100 text-amber-700' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Templates Hub</h1>
                <p className="text-slate-500 font-medium">Prebuilt workflows and reusable message templates.</p>
            </div>

            {/* Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 rounded-2xl p-1 w-fit">
                <button
                    onClick={() => setTab('workflows')}
                    className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tab === 'workflows' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Sparkles className="w-4 h-4" />
                    <span>Workflow Templates</span>
                    <span className="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full text-[10px]">{PREBUILT_TEMPLATES.length}</span>
                </button>
                <button
                    onClick={() => setTab('messages')}
                    className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tab === 'messages' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    <span>Message Templates</span>
                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">{MESSAGE_TEMPLATES.length}</span>
                </button>
            </div>

            {/* ══════════════════════════════════════ */}
            {/* Workflow Templates Tab */}
            {/* ══════════════════════════════════════ */}
            {tab === 'workflows' && (
                <div className="space-y-8">
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

                                                {/* Step preview */}
                                                <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Steps</p>
                                                    {tpl.nodes.filter(n => n.data.subType !== 'START').map((node, idx) => (
                                                        <div key={node.id} className="flex items-center space-x-2 text-xs">
                                                            <span className="w-5 h-5 rounded-full bg-white border flex items-center justify-center text-[10px] font-bold text-slate-400 flex-shrink-0">{idx + 1}</span>
                                                            <span className={`font-bold ${node.data.subType === 'WAIT' ? 'text-amber-600' :
                                                                    node.data.subType === 'MESSAGE' || node.data.subType === 'EMAIL' ? 'text-pink-600' :
                                                                        node.data.subType === 'INVITE' ? 'text-purple-600' :
                                                                            node.data.subType === 'AI_PERSONALIZE' ? 'text-indigo-600' : 'text-blue-600'
                                                                }`}>{node.data.label}</span>
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
                </div>
            )}

            {/* ══════════════════════════════════════ */}
            {/* Message Templates Tab */}
            {/* ══════════════════════════════════════ */}
            {tab === 'messages' && (
                <div className="space-y-6">
                    {/* Channel filters */}
                    <div className="flex items-center space-x-2">
                        {[
                            { key: 'all', label: 'All', icon: FileText },
                            { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
                            { key: 'email', label: 'Email', icon: Mail },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setMsgFilter(f.key)}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${msgFilter === f.key
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <f.icon className="w-3.5 h-3.5" />
                                <span>{f.label}</span>
                            </button>
                        ))}
                        <button className="ml-auto flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                            <Plus className="w-4 h-4" />
                            <span>New Template</span>
                        </button>
                    </div>

                    {/* Message list */}
                    <div className="space-y-4">
                        {filteredMessages.map(msg => (
                            <div key={msg.id} className="bg-white border rounded-2xl p-5 hover:shadow-md transition-all group">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className={`p-2 rounded-xl ${msg.channel === 'linkedin' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                                            {msg.channel === 'linkedin'
                                                ? <Linkedin className="w-4 h-4 text-blue-600" />
                                                : <Mail className="w-4 h-4 text-emerald-600" />
                                            }
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{msg.name}</p>
                                            <div className="flex items-center space-x-2 mt-0.5">
                                                <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full border ${msg.channel === 'linkedin' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    }`}>
                                                    {msg.channel}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{msg.type}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Edit
                                    </button>
                                </div>
                                <div className="mt-3 bg-slate-50 rounded-xl p-4">
                                    <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
