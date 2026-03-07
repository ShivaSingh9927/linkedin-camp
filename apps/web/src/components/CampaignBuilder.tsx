"use client";

import React, { useCallback, useState } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    addEdge,
    Connection,
    Edge,
    Node,
    OnNodesChange,
    OnEdgesChange,
    ConnectionMode,
} from '@xyflow/react';
import {
    UserCircle,
    Mail,
    MessageSquare,
    Clock,
    GitBranch,
    Trash2,
    Sparkles,
    ThumbsUp,
    UserPlus,
    Award,
    Eye,
    MailCheck,
    Tag,
    Webhook,
    FlaskConical,
    ChevronDown,
    FileText,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import api from '@/lib/api';

interface CampaignBuilderProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
    setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
}

// Action categories
const ACTION_CATEGORIES = [
    {
        name: 'LinkedIn',
        color: 'blue',
        actions: [
            { subType: 'PROFILE_VISIT', label: 'Visit Profile', icon: UserCircle, desc: 'View lead\'s profile' },
            { subType: 'INVITE', label: 'Send Invite', icon: UserPlus, desc: 'Send connection request' },
            { subType: 'MESSAGE', label: 'Message', icon: MessageSquare, desc: 'Send a direct message' },
            { subType: 'FOLLOW', label: 'Follow', icon: Eye, desc: 'Follow the profile' },
            { subType: 'LIKE_POST', label: 'Like Post', icon: ThumbsUp, desc: 'Like latest post' },
            { subType: 'ENDORSE', label: 'Endorse Skill', icon: Award, desc: 'Endorse a top skill' },
        ],
    },
    {
        name: 'Email',
        color: 'emerald',
        actions: [
            { subType: 'EMAIL', label: 'Send Email', icon: Mail, desc: 'Send an email' },
            { subType: 'CHECK_REPLY', label: 'Check Reply', icon: MailCheck, desc: 'Wait for email reply' },
        ],
    },
    {
        name: 'Flow',
        color: 'amber',
        actions: [
            { subType: 'WAIT', label: 'Delay', icon: Clock, desc: 'Wait before next step', type: 'DELAY' },
            { subType: 'IF_CONNECTED', label: 'If Connected', icon: GitBranch, desc: 'Branch on status', type: 'CONDITION' },
            { subType: 'IF_REPLIED', label: 'If Replied', icon: GitBranch, desc: 'Branch on reply', type: 'CONDITION' },
            { subType: 'TAG_LEAD', label: 'Tag Lead', icon: Tag, desc: 'Assign a tag' },
        ],
    },
    {
        name: 'AI',
        color: 'indigo',
        actions: [
            { subType: 'AI_PERSONALIZE', label: 'AI Personalize', icon: Sparkles, desc: 'Generate icebreakers' },
            { subType: 'AB_TEST', label: 'A/B Test', icon: FlaskConical, desc: 'Test message variants' },
        ],
    },
];

const colorMap: Record<string, { bg: string; border: string; text: string; hover: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', hover: 'hover:border-blue-300 hover:text-blue-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', hover: 'hover:border-emerald-300 hover:text-emerald-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', hover: 'hover:border-amber-300 hover:text-amber-700' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', hover: 'hover:border-indigo-300 hover:text-indigo-700' },
};

export function CampaignBuilder({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges
}: CampaignBuilderProps) {
    const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
    const [expandedCat, setExpandedCat] = useState<string | null>('LinkedIn');
    const [templates, setTemplates] = useState<any[]>([]);

    React.useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await api.get('/inbox/templates');
                setTemplates(res.data || []);
            } catch (err) {
                console.error('Failed to fetch templates:', err);
            }
        };
        fetchTemplates();
    }, []);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onNodeClick = useCallback((_: any, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    const updateNodeData = (id: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, ...newData } };
                }
                return node;
            })
        );
    };

    const insertVariable = (variable: string) => {
        if (!selectedNodeId || !selectedNode) return;
        const currentMessage = (selectedNode.data as any).message || '';
        updateNodeData(selectedNodeId, { message: currentMessage + `{${variable}}` });
    };

    const addNode = (type: string, subType: string, label: string) => {
        const id = `node_${Date.now()}`;
        const nodeType = type === 'DELAY' ? 'DELAY' : type === 'CONDITION' ? 'CONDITION' : 'ACTION';
        const hasMessage = ['MESSAGE', 'INVITE', 'EMAIL'].includes(subType);
        const newNode: Node = {
            id,
            position: { x: 250, y: nodes.length * 100 + 50 },
            data: {
                label,
                type: nodeType,
                subType,
                message: hasMessage ? '' : undefined,
            },
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const deleteSelected = useCallback(() => {
        setNodes((nds) => nds.filter((node) => !node.selected));
        setEdges((eds) => eds.filter((edge) => !edge.selected));
        setSelectedNodeId(null);
    }, [setNodes, setEdges]);

    const selectedSubType = (selectedNode?.data as any)?.subType;
    const showSettingsPanel = selectedNode && ['MESSAGE', 'INVITE', 'EMAIL'].includes(selectedSubType);

    return (
        <div className="h-full w-full border rounded-2xl bg-[#f8fafc] relative overflow-hidden shadow-inner group flex">
            <div className="flex-1 relative">
                {/* Toolbar — categorized accordion */}
                <div className="absolute top-4 left-4 z-10 w-56 bg-white/95 backdrop-blur-md rounded-2xl border shadow-lg overflow-hidden max-h-[calc(100%-2rem)] overflow-y-auto">
                    <div className="p-3 border-b bg-slate-50/80">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Workflow Actions</p>
                    </div>
                    {ACTION_CATEGORIES.map((cat) => {
                        const c = colorMap[cat.color];
                        const isExpanded = expandedCat === cat.name;
                        return (
                            <div key={cat.name} className="border-b last:border-b-0">
                                <button
                                    onClick={() => setExpandedCat(isExpanded ? null : cat.name)}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-black uppercase tracking-wider ${c.text} hover:bg-slate-50 transition-colors`}
                                >
                                    <span>{cat.name}</span>
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {isExpanded && (
                                    <div className="px-2 pb-2 space-y-1 animate-in slide-in-from-top-2 duration-150">
                                        {cat.actions.map((action) => (
                                            <button
                                                key={action.subType}
                                                onClick={() => addNode(action.type || 'ACTION', action.subType, action.label)}
                                                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl border ${c.border} ${c.hover} bg-white text-xs font-bold text-slate-600 transition-all hover:shadow-sm group/btn`}
                                            >
                                                <action.icon className={`w-4 h-4 ${c.text} flex-shrink-0`} />
                                                <div className="text-left">
                                                    <p className="font-bold text-[11px]">{action.label}</p>
                                                    <p className="text-[9px] text-slate-400 font-medium">{action.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Delete */}
                    <div className="p-2 border-t">
                        <button
                            onClick={deleteSelected}
                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl border border-red-100 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                            title="Delete selected nodes"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete Selected</span>
                        </button>
                    </div>
                </div>

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    connectionMode={ConnectionMode.Loose}
                    fitView
                >
                    <Controls showInteractive={false} className="bg-white border shadow-xl rounded-2xl overflow-hidden" />
                    <MiniMap className="bg-white border rounded-2xl overflow-hidden shadow-xl" zoomable pannable />
                    <Background gap={24} size={1} color="#cbd5e1" />
                </ReactFlow>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-slate-900/10 backdrop-blur rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest pointer-events-none">
                    Tip: Select a node and press <kbd className="bg-white px-1 rounded border shadow-sm">Backspace</kbd> to delete
                </div>
            </div>

            {/* Settings Panel */}
            {showSettingsPanel && (
                <div className="w-80 border-l bg-white animate-in slide-in-from-right duration-300 shadow-2xl z-20 flex flex-col">
                    <div className="p-6 border-b">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-1">Step Settings</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{String((selectedNode?.data as any)?.label)}</p>
                    </div>

                    <div className="p-6 space-y-6 flex-1 overflow-auto text-sm">
                        {templates.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center space-x-2">
                                    <FileText className="w-3 h-3" />
                                    <span>Load Template</span>
                                </label>
                                <select
                                    onChange={(e) => {
                                        const tpl = templates.find(t => t.id === e.target.value);
                                        if (tpl) updateNodeData(selectedNode!.id, { message: tpl.content });
                                        e.target.value = ""; // Reset selector
                                    }}
                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:ring-0 transition-all text-xs font-bold text-slate-600 shadow-sm"
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select a saved template...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {selectedSubType === 'EMAIL' ? 'Email Body' : 'Message Text'}
                            </label>
                            <textarea
                                value={String((selectedNode?.data as any)?.message || '')}
                                onChange={(e) => updateNodeData(selectedNode!.id, { message: e.target.value })}
                                className="w-full h-40 p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:ring-0 transition-all text-sm font-medium placeholder:text-slate-300 resize-none"
                                placeholder={selectedSubType === 'EMAIL' ? 'Hi {firstName}, ...' : 'Hi {firstName}, ...'}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Insert Variables</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['firstName', 'lastName', 'company', 'jobTitle', 'icebreaker'].map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => insertVariable(v)}
                                        className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 uppercase tracking-tighter"
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t bg-slate-50">
                        <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest">Auto-saved to builder state</p>
                    </div>
                </div>
            )}
        </div>
    );
}
