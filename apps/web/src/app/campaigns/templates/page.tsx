"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileText, MessageSquare, Mail, Linkedin, Plus, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { CampaignNameModal } from '@/components/CampaignNameModal';

type Tab = 'workflows' | 'messages';

interface TemplateSummary {
    id: string;
    name: string;
    description: string;
    useCase: string;
    recommendedFor: string[];
    category: 'linkedin' | 'email' | 'multi-channel';
    icon: string;
    color: string;
    durationDays: number;
    aiStrategyHint: {
        objective: string;
        description: string;
        cta: string;
        toneOverride: string;
    };
}

interface FullTemplate extends TemplateSummary {
    workflow: {
        nodes: any[];
        edges: any[];
    };
}

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
    const [templates, setTemplates] = useState<TemplateSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingTemplate, setPendingTemplate] = useState<TemplateSummary | null>(null);
    const [creating, setCreating] = useState(false);
    const router = useRouter();

    useEffect(() => {
        api.get('/templates')
            .then(res => setTemplates(res.data.templates || []))
            .catch(err => console.error('Failed to load templates:', err))
            .finally(() => setLoading(false));
    }, []);

    const handleUseTemplate = (template: TemplateSummary) => {
        setPendingTemplate(template);
    };

    const handleConfirmCreate = async (name: string) => {
        if (!pendingTemplate) return;
        const summary = pendingTemplate;
        setPendingTemplate(null);
        setCreating(true);
        try {
            // Fetch the full template (with workflow) at the moment of use,
            // so the list endpoint stays light.
            const full = await api.get<{ template: FullTemplate }>(`/templates/${summary.id}`);
            const tpl = full.data.template;
            const res = await api.post('/campaigns', {
                name,
                workflowJson: tpl.workflow,
                objective: tpl.aiStrategyHint.objective,
                description: tpl.aiStrategyHint.description,
                cta: tpl.aiStrategyHint.cta,
                toneOverride: tpl.aiStrategyHint.toneOverride,
            });
            router.push(`/campaigns/${res.data.id}/builder`);
        } catch (err) {
            console.error(err);
            alert('Error creating campaign from template.');
        } finally {
            setCreating(false);
        }
    };

    const filteredMessages = msgFilter === 'all'
        ? MESSAGE_TEMPLATES
        : MESSAGE_TEMPLATES.filter(m => m.channel === msgFilter);

    const categories: { key: TemplateSummary['category']; label: string; color: string }[] = [
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
                    <span className="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full text-[10px]">{templates.length}</span>
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

            {/* Workflow Templates Tab */}
            {tab === 'workflows' && (
                <div className="space-y-8">
                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    )}
                    {!loading && templates.length === 0 && (
                        <div className="bg-white border rounded-3xl p-12 text-center">
                            <p className="text-slate-500 font-bold">No templates available yet.</p>
                        </div>
                    )}
                    {!loading && categories.map((cat) => {
                        const inCat = templates.filter(t => t.category === cat.key);
                        if (inCat.length === 0) return null;
                        return (
                            <div key={cat.key} className="space-y-4">
                                <div className="flex items-center space-x-3">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${cat.color}`}>
                                        {cat.label}
                                    </span>
                                    <span className="text-sm text-slate-400 font-bold">{inCat.length} template{inCat.length === 1 ? '' : 's'}</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {inCat.map((tpl) => (
                                        <div
                                            key={tpl.id}
                                            className="bg-white rounded-3xl border shadow-sm hover:shadow-lg transition-all overflow-hidden group flex flex-col"
                                        >
                                            <div className={`h-2 bg-gradient-to-r ${tpl.color}`} />
                                            <div className="p-6 space-y-4 flex flex-col flex-1">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-3xl">{tpl.icon}</span>
                                                    <div>
                                                        <p className="font-black text-slate-800 uppercase tracking-tight">{tpl.name}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tpl.category} · {tpl.durationDays}d</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-500 leading-relaxed">{tpl.description}</p>

                                                <div className="bg-indigo-50/60 rounded-2xl p-4 space-y-2 border border-indigo-100">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Best for</p>
                                                    <ul className="space-y-1">
                                                        {tpl.recommendedFor.map((r, i) => (
                                                            <li key={i} className="text-xs text-slate-600 flex items-start">
                                                                <span className="text-indigo-400 mr-2">·</span>
                                                                <span>{r}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                <div className="mt-auto">
                                                    <button
                                                        onClick={() => handleUseTemplate(tpl)}
                                                        disabled={creating}
                                                        className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                                    >
                                                        {creating ? 'Creating…' : 'Use This Template'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Message Templates Tab */}
            {tab === 'messages' && (
                <div className="space-y-6">
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

            <CampaignNameModal
                isOpen={!!pendingTemplate}
                defaultName={pendingTemplate?.name || 'New Campaign'}
                onConfirm={handleConfirmCreate}
                onCancel={() => setPendingTemplate(null)}
            />
        </div>
    );
}
