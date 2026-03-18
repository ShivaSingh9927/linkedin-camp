'use client';

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Connection,
  addEdge,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  Panel,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TriggerNode, ActionNode, ConditionNode, DelayNode } from './WorkflowNodes';
import { Plus, MousePointer2, Mail, UserPlus, Clock, Zap, GitBranch } from 'lucide-react';

const nodeTypes = {
  TRIGGER: TriggerNode,
  ACTION: ActionNode,
  CONDITION: ConditionNode,
  DELAY: DelayNode,
};

interface CampaignBuilderProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
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
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds)),
    [setEdges],
  );

  const addNode = (subType: string, label: string, type: 'ACTION' | 'CONDITION' | 'DELAY' | 'TRIGGER') => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label,
        subType,
        type // backend expects type inside data too
      },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div className="w-full h-full bg-slate-50 relative group">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#cbd5e1', strokeWidth: 2 }
        }}
        className="bg-slate-50/50"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls className="!bg-white !border-slate-200 !shadow-sm !rounded-xl overflow-hidden" />

        <Panel position="top-right" className="flex flex-col gap-2 p-4 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 max-w-[200px]">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Plus className="w-3 h-3" />
            Build Sequence
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => addNode('VISIT', 'Profile Visit', 'ACTION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-amber-50 text-slate-600 hover:text-amber-600 border border-transparent hover:border-amber-100 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-amber-100 rounded text-amber-600"><MousePointer2 className="w-3 h-3" /></div>
              Visit Profile
            </button>

            <button
              onClick={() => addNode('INVITE', 'Connect Request', 'ACTION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-transparent hover:border-blue-100 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-blue-100 rounded text-blue-600"><UserPlus className="w-3 h-3" /></div>
              Send Invite
            </button>

            <button
              onClick={() => addNode('MESSAGE', 'Send Message', 'ACTION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 border border-transparent hover:border-emerald-100 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-emerald-100 rounded text-emerald-600"><Mail className="w-3 h-3" /></div>
              Send Message
            </button>

            <button
              onClick={() => addNode('WAIT', 'Delay', 'DELAY')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-slate-200 rounded text-slate-600"><Clock className="w-3 h-3" /></div>
              Wait / Delay
            </button>

            <button
              onClick={() => addNode('REPLIED', 'If Replied', 'CONDITION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-purple-50 text-slate-600 hover:text-purple-600 border border-transparent hover:border-purple-100 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-purple-100 rounded text-purple-600"><GitBranch className="w-3 h-3" /></div>
              Check Reply
            </button>
          </div>
        </Panel>

        <Panel position="bottom-left" className="bg-white/80 backdrop-blur-md px-3 py-1.5 border border-slate-200 rounded-full shadow-lg text-[10px] font-bold text-slate-400 flex items-center gap-2">
          <Zap className="w-3 h-3 text-indigo-500 fill-current" />
          AUTOMATION CANVAS V2.0
        </Panel>
      </ReactFlow>
    </div>
  );
}
