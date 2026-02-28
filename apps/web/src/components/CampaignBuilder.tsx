"use client";

import React, { useCallback } from 'react';
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
    applyNodeChanges,
    applyEdgeChanges,
} from '@xyflow/react';
import {
    UserCircle,
    Mail,
    MessageSquare,
    Clock,
    GitBranch,
    Trash2
} from 'lucide-react';
import '@xyflow/react/dist/style.css';

interface CampaignBuilderProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
    setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
}

export function CampaignBuilder({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges
}: CampaignBuilderProps) {

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const addNode = (type: 'ACTION' | 'DELAY' | 'CONDITION', subType: string, label: string) => {
        const id = `node_${Date.now()}`;
        const newNode: Node = {
            id,
            position: { x: 250, y: nodes.length * 100 + 50 },
            data: {
                label,
                type,
                subType,
                data: {}
            },
            type: undefined, // Type is already handled by node data
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const deleteSelected = useCallback(() => {
        setNodes((nds) => nds.filter((node) => !node.selected));
        setEdges((eds) => eds.filter((edge) => !edge.selected));
    }, [setNodes, setEdges]);

    return (
        <div className="h-full w-full border rounded-2xl bg-[#f8fafc] relative overflow-hidden shadow-inner group">
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 max-w-2xl bg-white/80 backdrop-blur-md p-2 rounded-2xl border shadow-sm transition-all hover:bg-white hover:shadow-md">
                <button
                    onClick={() => addNode('ACTION', 'PROFILE_VISIT', 'Visit Profile')}
                    className="bg-white border text-xs font-bold px-3 py-2 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 hover:text-blue-700 transition-all flex items-center space-x-2 border-blue-100"
                >
                    <UserCircle className="w-4 h-4" />
                    <span>Visit Profile</span>
                </button>
                <button
                    onClick={() => addNode('ACTION', 'INVITE', 'Send Invite')}
                    className="bg-white border text-xs font-bold px-3 py-2 rounded-xl shadow-sm hover:shadow-md hover:border-purple-300 hover:text-purple-700 transition-all flex items-center space-x-2 border-purple-100"
                >
                    <Mail className="w-4 h-4" />
                    <span>Send Invite</span>
                </button>
                <button
                    onClick={() => addNode('ACTION', 'MESSAGE', 'Send Message')}
                    className="bg-white border text-xs font-bold px-3 py-2 rounded-xl shadow-sm hover:shadow-md hover:border-pink-300 hover:text-pink-700 transition-all flex items-center space-x-2 border-pink-100"
                >
                    <MessageSquare className="w-4 h-4" />
                    <span>Message</span>
                </button>
                <button
                    onClick={() => addNode('DELAY', 'WAIT', 'Wait 24h')}
                    className="bg-white border text-xs font-bold px-3 py-2 rounded-xl shadow-sm hover:shadow-md hover:border-amber-300 hover:text-amber-700 transition-all flex items-center space-x-2 border-amber-100"
                >
                    <Clock className="w-4 h-4" />
                    <span>Delay</span>
                </button>
                <button
                    onClick={() => addNode('CONDITION', 'IF_CONNECTED', 'Is Connected?')}
                    className="bg-white border text-xs font-bold px-3 py-2 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-300 hover:text-emerald-700 transition-all flex items-center space-x-2 border-emerald-100"
                >
                    <GitBranch className="w-4 h-4" />
                    <span>Condition</span>
                </button>

                <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

                <button
                    onClick={deleteSelected}
                    className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold px-3 py-2 rounded-xl shadow-sm hover:bg-red-600 hover:text-white hover:border-red-600 transition-all flex items-center space-x-2"
                    title="Delete selected nodes (or press Backspace)"
                >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                </button>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
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
    );
}
