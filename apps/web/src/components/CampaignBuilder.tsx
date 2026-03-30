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
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TriggerNode, ActionNode, ConditionNode, DelayNode } from './WorkflowNodes';
import { Plus, MousePointer2, Mail, UserPlus, Clock, Zap, GitBranch, X, Edit3, Heart, MessageCircle, Info, Database, AtSign, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

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

export function CampaignBuilder(props: CampaignBuilderProps) {
  return (
    <ReactFlowProvider>
      <CampaignBuilderInner {...props} />
    </ReactFlowProvider>
  );
}

function CampaignBuilderInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges
}: CampaignBuilderProps) {
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds)),
    [setEdges],
  );

  const { addNodes } = useReactFlow();

  const addNode = (subType: string, label: string, type: string) => {
    const newNode: Node = {
      id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: type,
      position: {
        x: 400 + (nodes.length * 20),
        y: 200 + (nodes.length * 20)
      },
      data: {
        label,
        subType,
        type,
        days: subType === 'WAIT' ? 1 : undefined,
        message: (subType === 'MESSAGE' || subType === 'COMMENT_POST') ? 'Hi {firstName}, noticed your profile and wanted to connect!' : undefined,
        enrichCompany: subType === 'VISIT' ? true : false,
        enrichContact: subType === 'VISIT' ? false : false,
        enrichAbout: subType === 'VISIT' ? true : false,
        enrichPosts: subType === 'VISIT' ? false : false,
        aiEnabled: false,
        tone: 'professional',
        cta: 'connect',
      },
    };

    addNodes(newNode);
    toast.success(`Added ${label} step!`);
  };

  const updateNodeData = (id: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
    toast.success('Step updated');
  };

  return (
    <div className="w-full h-full bg-slate-50 relative group flex flex-row overflow-hidden">
      <div className="flex-1 relative">
        {/* Floating Menu */}
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-2 p-4 bg-white border border-slate-200 rounded-2xl shadow-xl max-w-[200px]">
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
              Profile Visit
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

            <button
              onClick={() => addNode('EMAIL', 'Send Email', 'ACTION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-slate-200 rounded text-slate-600"><Mail className="w-3 h-3" /></div>
              Send Email
            </button>

            <div className="h-px bg-slate-100 my-2" />
            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 px-1">Engagement</div>

            <button
              onClick={() => addNode('LIKE_POST', 'Like Post', 'ACTION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-transparent hover:border-rose-100 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-rose-100 rounded text-rose-600"><Heart className="w-3 h-3" /></div>
              Like Recent Post
            </button>

            <button
              onClick={() => addNode('COMMENT_POST', 'Comment Post', 'ACTION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-cyan-50 text-slate-600 hover:text-cyan-600 border border-transparent hover:border-cyan-100 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-cyan-100 rounded text-cyan-600"><MessageCircle className="w-3 h-3" /></div>
              Comment on Post
            </button>
          </div>
        </div>

        <div className="w-full h-[700px] border-t bg-slate-50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
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

            <Panel position="bottom-left" className="bg-white/80 backdrop-blur-md px-3 py-1.5 border border-slate-200 rounded-full shadow-lg text-[10px] font-bold text-slate-400 flex items-center gap-2">
              <Zap className="w-3 h-3 text-indigo-500 fill-current" />
              AUTOMATION CANVAS V2.0
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedNode && (
        <div className="w-80 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Step Settings</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{(selectedNode.data as any).label}</p>
            </div>
            <button onClick={() => setSelectedNodeId(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            {(
              ['MESSAGE', 'SEND MESSAGE', 'COMMENT_POST', 'EMAIL', 'SEND EMAIL'].includes((((selectedNode.data as any).subType || '') as string).toUpperCase()) ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('MESSAGE') ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('COMMENT') ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('EMAIL')
            ) && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <Mail className="w-3 h-3 text-indigo-500" />
                    {((selectedNode.data as any).subType === 'COMMENT_POST' ? 'Comment Content' : 
                      (selectedNode.data as any).subType === 'EMAIL' ? 'Email Body' : 'Message Content')}
                  </label>
                  <textarea
                    value={(selectedNode.data as any).message || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                    className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                    placeholder="Type your content here..."
                  />
                  <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100 text-[10px] text-indigo-600 font-medium leading-relaxed">
                    💡 Tip: You can use <span className="font-bold underline">{'{firstName}'}</span> to personalize your content.
                  </div>
                </div>
              )}

            {(
              ['MESSAGE', 'COMMENT_POST'].includes((((selectedNode.data as any).subType || '') as string).toUpperCase())
            ) && (
                <div className="space-y-3">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">AI Settings</div>
                  
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-purple-100 rounded text-purple-600"><Sparkles className="w-3 h-3" /></div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">AI Generate</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Auto-write message</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={(selectedNode.data as any).aiEnabled || false}
                      onChange={(e) => updateNodeData(selectedNode.id, { aiEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                  </div>

                  {(selectedNode.data as any).aiEnabled && (
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-purple-600 uppercase">Tone</label>
                        <select 
                          value={(selectedNode.data as any).tone || 'professional'}
                          onChange={(e) => updateNodeData(selectedNode.id, { tone: e.target.value })}
                          className="w-full mt-1 p-2 bg-white border border-purple-200 rounded-lg text-xs font-medium"
                        >
                          <option value="professional">Professional</option>
                          <option value="friendly">Friendly</option>
                          <option value="casual">Casual</option>
                          <option value="formal">Formal</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-purple-600 uppercase">Call to Action</label>
                        <select 
                          value={(selectedNode.data as any).cta || 'connect'}
                          onChange={(e) => updateNodeData(selectedNode.id, { cta: e.target.value })}
                          className="w-full mt-1 p-2 bg-white border border-purple-200 rounded-lg text-xs font-medium"
                        >
                          <option value="connect">Connect</option>
                          <option value="reply">Reply</option>
                          <option value="demo">Book Demo</option>
                          <option value="learn_more">Learn More</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

            {(selectedNode.data as any).subType === 'VISIT' && (
              <div className="space-y-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">Enrichment Settings</div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-100 rounded text-blue-600"><Database className="w-3 h-3" /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Company & Job Title</p>
                      <p className="text-[9px] text-slate-400 uppercase font-bold">Recommended</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={(selectedNode.data as any).enrichCompany}
                    onChange={(e) => updateNodeData(selectedNode.id, { enrichCompany: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-emerald-100 rounded text-emerald-600"><AtSign className="w-3 h-3" /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Email & Phone</p>
                      <p className="text-[9px] text-slate-400 uppercase font-bold text-rose-500">Requires Connection</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={(selectedNode.data as any).enrichContact}
                    onChange={(e) => updateNodeData(selectedNode.id, { enrichContact: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-amber-100 rounded text-amber-600"><Info className="w-3 h-3" /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">About Section</p>
                      <p className="text-[9px] text-slate-400 uppercase font-bold">Deep Persona</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={(selectedNode.data as any).enrichAbout}
                    onChange={(e) => updateNodeData(selectedNode.id, { enrichAbout: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-purple-100 rounded text-purple-600"><FileText className="w-3 h-3" /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Latest Posts</p>
                      <p className="text-[9px] text-slate-400 uppercase font-bold">For smarter comments</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={(selectedNode.data as any).enrichPosts}
                    onChange={(e) => updateNodeData(selectedNode.id, { enrichPosts: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {(
              ['WAIT', 'DELAY'].includes((((selectedNode.data as any).subType || '') as string).toUpperCase()) ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('DELAY') ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('WAIT')
            ) && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <Clock className="w-3 h-3 text-amber-500" />
                    Delay Duration
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={(selectedNode.data as any).days || 1}
                      onChange={(e) => updateNodeData(selectedNode.id, { days: parseInt(e.target.value) })}
                      className="w-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-slate-800"
                    />
                    <span className="text-sm font-bold text-slate-400 uppercase">Days</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">The sequence will pause for this many days before moving to the next step.</p>
                </div>
              )}

            {selectedNode.data.type === 'TRIGGER' && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 bg-indigo-100 rounded-full text-indigo-600">
                  <Zap className="w-8 h-8 fill-current" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-800 uppercase">Input: Lead Import</p>
                  <p className="text-[10px] text-slate-400 max-w-[150px]">The campaign begins as soon as leads are imported.</p>
                </div>
              </div>
            )}

            {!(
              ['MESSAGE', 'SEND MESSAGE', 'WAIT', 'DELAY', 'TRIGGER'].includes((((selectedNode.data as any).subType || selectedNode.data.type || '') as string).toUpperCase()) ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('MESSAGE') ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('DELAY') ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('WAIT')
            ) && (
                <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                  <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                    <Edit3 className="w-8 h-8" />
                  </div>
                  <p className="text-[10px] font-black text-slate-500 mt-4">NO SETTINGS AVAILABLE</p>
                </div>
              )}
          </div>

          <div className="p-6 border-t bg-slate-50 mt-auto">
            <button
              onClick={() => setSelectedNodeId(null)}
              className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
            >
              Close Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
