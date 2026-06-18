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

import { TriggerNode, ActionNode, ConditionNode, DelayNode, BuilderLockContext } from './WorkflowNodes';
import { Plus, MousePointer2, Mail, UserPlus, Clock, Zap, GitBranch, X, Edit3, Heart, MessageCircle, Info, Database, AtSign, FileText, Sparkles, UserCheck, Eye, Lock, Save } from 'lucide-react';
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
  // Locked = template-derived / quick-launch campaign: content-only, no
  // structural editing. Custom-builder campaigns pass locked={false}.
  locked?: boolean;
  // Persists the whole campaign (used by the Step Settings "Save" button).
  onSaveCampaign?: () => void | Promise<void>;
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
  setEdges,
  locked = false,
  onSaveCampaign,
}: CampaignBuilderProps) {
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const messageRef = React.useRef<HTMLTextAreaElement>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  // Insert a personalization tag at the caret in the message textarea. Writing
  // a tag is part of authoring your own copy, so it also switches AI off.
  const insertTag = (tag: string) => {
    if (!selectedNode) return;
    const ta = messageRef.current;
    const cur = String((selectedNode.data as any).message || '');
    let next = cur + tag;
    if (ta && typeof ta.selectionStart === 'number') {
      const s = ta.selectionStart, e = ta.selectionEnd;
      next = cur.slice(0, s) + tag + cur.slice(e);
      requestAnimationFrame(() => { ta.focus(); const p = s + tag.length; ta.setSelectionRange(p, p); });
    }
    updateNodeData(selectedNode.id, { message: next, aiEnabled: false });
  };

  // Tags the engine actually resolves (camelCase single-brace → {{...}}).
  const MESSAGE_TAGS = [
    { label: 'First name', tag: '{firstName}' },
    { label: 'Last name', tag: '{lastName}' },
    { label: 'Full name', tag: '{name}' },
    { label: 'Company', tag: '{company}' },
    { label: 'Job title', tag: '{jobTitle}' },
  ];

  // B.4 — connection-gate warning. Returns true when the selected node is
  // one that requires a 1st-degree connection (MESSAGE / EMAIL_FINDER) AND
  // there is no upstream CONNECT or CHECK_CONNECTION reachable via reverse
  // graph walk. Used by the warning banner + B.5 auto-insert button.
  const gapAnalysis = useMemo(() => {
    if (!selectedNode) return { needsGate: false, hasUpstreamGate: false };
    const sub = String((selectedNode.data as any).subType || '').toUpperCase();
    const needsGate = ['MESSAGE', 'SEND_MESSAGE', 'EMAIL_FINDER', 'FIND_EMAIL'].includes(sub);
    if (!needsGate) return { needsGate: false, hasUpstreamGate: false };

    // Reverse BFS from selectedNode through incoming edges. Stop when we
    // find a CONNECT, CHECK_CONNECTION, or an IF_ELSE whose condition
    // already branches on connection state — any of those satisfies the
    // gate requirement.
    const incoming = new Map<string, string[]>();
    for (const e of edges) {
      if (!incoming.has(e.target)) incoming.set(e.target, []);
      incoming.get(e.target)!.push(e.source);
    }
    const seen = new Set<string>();
    const queue: string[] = [selectedNode.id];
    let hasUpstreamGate = false;
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const ancestors = incoming.get(id) || [];
      for (const aId of ancestors) {
        if (seen.has(aId)) continue;
        const a = nodes.find(n => n.id === aId);
        if (!a) continue;
        const aSub = String((a.data as any).subType || '').toUpperCase();
        if (aSub === 'CONNECT' || aSub === 'INVITE' || aSub === 'CHECK_CONNECTION') {
          hasUpstreamGate = true; break;
        }
        if (aSub === 'IF_ELSE' || aSub === 'CONDITION') {
          const cond = (a.data as any).condition;
          if (cond?.source === 'connectionState' || cond?.field === 'connectionDegree' || cond?.field === 'connected') {
            hasUpstreamGate = true; break;
          }
        }
        queue.push(aId);
      }
      if (hasUpstreamGate) break;
    }
    return { needsGate, hasUpstreamGate };
  }, [selectedNode, nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (locked) return; // locked campaigns can't be rewired
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds));
    },
    [setEdges, locked],
  );

  // B.5 — One-click "Add Connection Gate". Inserts CONNECT → DELAY 1d →
  // CHECK_CONNECTION → IF_ELSE around the selected node so it only runs
  // on 1st-degree leads. Rewires the existing inbound edge to point at
  // the new CONNECT, and routes the IF_ELSE 'true' branch into the
  // original node. The 'false' branch terminates (no MESSAGE on cold
  // leads). User can later wire the false branch to a fallback step
  // (FOLLOW, secondary DELAY, etc.).
  const insertConnectionGate = useCallback((targetId: string) => {
    const target = nodes.find(n => n.id === targetId);
    if (!target) return;
    const baseX = target.position.x;
    const baseY = target.position.y;
    const stamp = Date.now();
    const ids = {
      connect: `node_${stamp}_gate_connect`,
      wait:    `node_${stamp}_gate_wait`,
      check:   `node_${stamp}_gate_check`,
      branch:  `node_${stamp}_gate_branch`,
    };

    // Push the target node down 4 step-heights so the gate fits above.
    const STEP_HEIGHT = 110;
    const shiftedNodes = nodes.map(n => n.id === targetId
      ? { ...n, position: { x: baseX, y: baseY + STEP_HEIGHT * 4 } }
      : n);

    const newNodes: Node[] = [
      ...shiftedNodes,
      {
        id: ids.connect,
        type: 'ACTION',
        position: { x: baseX, y: baseY },
        data: { label: 'Send Invite', subType: 'CONNECT', type: 'ACTION', message: '' },
      } as any,
      {
        id: ids.wait,
        type: 'DELAY',
        position: { x: baseX, y: baseY + STEP_HEIGHT },
        data: { label: 'Wait 1 day', subType: 'WAIT', type: 'DELAY', delayDays: 1 },
      } as any,
      {
        id: ids.check,
        type: 'ACTION',
        position: { x: baseX, y: baseY + STEP_HEIGHT * 2 },
        data: { label: 'Check Connection', subType: 'CHECK_CONNECTION', type: 'ACTION' },
      } as any,
      {
        id: ids.branch,
        type: 'CONDITION',
        position: { x: baseX, y: baseY + STEP_HEIGHT * 3 },
        data: {
          label: 'Connected?',
          subType: 'IF_ELSE',
          type: 'CONDITION',
          condition: {
            source: 'connectionState',
            field: 'connectionDegree',
            operator: 'equals',
            value: 1,
            probeOnNull: true,
          },
        },
      } as any,
    ];

    // Rewire edges: every edge that previously pointed AT target now points
    // at the new CONNECT. Then add the gate chain edges, plus the true-branch
    // edge from IF_ELSE into the original target.
    const rewired = edges.map(e => e.target === targetId ? { ...e, target: ids.connect } : e);
    const gateEdges: Edge[] = [
      { id: `e-${stamp}-1`, source: ids.connect, target: ids.wait,   animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } } as any,
      { id: `e-${stamp}-2`, source: ids.wait,    target: ids.check,  animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } } as any,
      { id: `e-${stamp}-3`, source: ids.check,   target: ids.branch, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } } as any,
      { id: `e-${stamp}-4`, source: ids.branch,  target: targetId,   sourceHandle: 'true',  animated: true, style: { stroke: '#16a34a', strokeWidth: 2 } } as any,
    ];

    setNodes(newNodes);
    setEdges([...rewired, ...gateEdges]);
    toast.success('Connection gate inserted. Wire the "false" branch to a fallback step (FOLLOW, END, etc.).');
  }, [nodes, edges, setNodes, setEdges]);

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
        // AI is on by default for any step that writes copy — the user can
        // uncheck it (or just start typing, which auto-disables it).
        aiEnabled: ['MESSAGE', 'EMAIL', 'COMMENT_POST'].includes(subType),
        tone: 'professional',
        cta: 'connect',
        // IF_ELSE / CONDITION default — branch on connection state with
        // the most common pattern (only proceed down 'true' if 1st-degree).
        // Users override via the condition editor in the properties panel.
        condition: subType === 'IF_ELSE' || subType === 'REPLIED'
          ? { source: 'connectionState', field: 'connected', operator: 'is_true' }
          : undefined,
      },
    };

    addNodes(newNode);
    toast.success(`Added ${label} step!`);
  };

  // Live-applies edits to canvas state (no toast — that fired on every
  // keystroke). Persisting to the backend is the explicit "Save" button.
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

  const [savingStep, setSavingStep] = React.useState(false);
  const handleSaveStep = useCallback(async () => {
    if (!onSaveCampaign) { setSelectedNodeId(null); return; }
    try {
      setSavingStep(true);
      await onSaveCampaign();
      toast.success('Step saved');
      setSelectedNodeId(null);
    } catch {
      toast.error('Could not save step');
    } finally {
      setSavingStep(false);
    }
  }, [onSaveCampaign]);

  return (
    <BuilderLockContext.Provider value={locked}>
    <div className="w-full h-full bg-slate-50 relative group flex flex-row overflow-hidden">
      <div className="flex-1 relative">
        {/* Locked badge replaces the build menu for template/quick-launch campaigns */}
        {locked && (
          <div className="absolute top-4 left-4 z-50 flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-lg max-w-[240px]">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500"><Lock className="w-3.5 h-3.5" /></div>
            <div>
              <p className="text-[11px] font-bold text-slate-700">Structure locked</p>
              <p className="text-[10px] text-slate-400 leading-tight">Click any step to edit its content &amp; AI settings.</p>
            </div>
          </div>
        )}
        {/* Floating Menu (hidden when locked) */}
        {!locked && (
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
              onClick={() => addNode('IF_ELSE', 'Branch', 'CONDITION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-purple-50 text-slate-600 hover:text-purple-600 border border-transparent hover:border-purple-100 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-purple-100 rounded text-purple-600"><GitBranch className="w-3 h-3" /></div>
              Branch (If / Else)
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

            <button
              onClick={() => addNode('FOLLOW', 'Follow', 'ACTION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-transparent hover:border-indigo-100 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-indigo-100 rounded text-indigo-600"><Eye className="w-3 h-3" /></div>
              Follow
            </button>

            <div className="h-px bg-slate-100 my-2" />
            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 px-1">Gates</div>

            <button
              onClick={() => addNode('CHECK_CONNECTION', 'Check Connection', 'ACTION')}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-teal-50 text-slate-600 hover:text-teal-600 border border-transparent hover:border-teal-100 transition-all text-xs font-bold"
            >
              <div className="p-1 bg-teal-100 rounded text-teal-600"><UserCheck className="w-3 h-3" /></div>
              Check Connection
            </button>
          </div>
        </div>
        )}

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
            nodesDraggable={!locked}
            nodesConnectable={!locked}
            edgesReconnectable={!locked}
            deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
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
            {/* B.4 — Connection-gate warning. Surfaces when this step requires
                a 1st-degree connection AND no upstream CONNECT / CHECK_CONNECTION
                exists. B.5 "Add Gate" button auto-inserts the gate. */}
            {gapAnalysis.needsGate && !gapAnalysis.hasUpstreamGate && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-amber-100 rounded text-amber-700 mt-0.5">
                    <Info className="w-3 h-3" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider">Needs Connection Gate</p>
                    <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                      This step only works on 1st-degree connections. For any lead you're not connected to, it will silently skip. Add a Connect → Wait → Check Connection gate upstream so cold leads get an invite first.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => insertConnectionGate(selectedNode.id)}
                  className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors"
                >
                  + Add Connection Gate
                </button>
              </div>
            )}

            {(
              ['EMAIL', 'SEND EMAIL'].includes((((selectedNode.data as any).subType || '') as string).toUpperCase()) ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('EMAIL')
            ) && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <Mail className="w-3 h-3 text-indigo-500" />
                    Subject
                  </label>
                  <input
                    type="text"
                    value={(selectedNode.data as any).subject || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { subject: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    placeholder="Quick question, {firstName}"
                  />
                </div>
              )}

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
                    ref={messageRef}
                    value={(selectedNode.data as any).message || ''}
                    onChange={(e) => {
                      // Writing your own copy turns AI off automatically — you're
                      // either AI-generating or writing it yourself, not both.
                      const patch: any = { message: e.target.value };
                      if (e.target.value && (selectedNode.data as any).aiEnabled) patch.aiEnabled = false;
                      updateNodeData(selectedNode.id, patch);
                    }}
                    className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                    placeholder={(selectedNode.data as any).aiEnabled ? 'AI is writing this step. Start typing to write it yourself instead…' : 'e.g. Hi {firstName}, saw your work at {company}…'}
                  />
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Insert Tag</div>
                    <div className="flex flex-wrap gap-1.5">
                      {MESSAGE_TAGS.map((t) => (
                        <button
                          key={t.tag}
                          type="button"
                          onClick={() => insertTag(t.tag)}
                          title={`Insert ${t.tag}`}
                          className="px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100 hover:border-indigo-200 transition-colors"
                        >
                          + {t.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-400 leading-relaxed">
                      Click a tag to drop it at your cursor — it fills in from each lead automatically.
                    </p>
                  </div>
                </div>
              )}

            {(
              ['MESSAGE', 'COMMENT_POST', 'EMAIL'].includes((((selectedNode.data as any).subType || '') as string).toUpperCase()) ||
              ((selectedNode.data as any).label || '').toUpperCase().includes('EMAIL')
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
                      <div>
                        <label className="text-[10px] font-bold text-purple-600 uppercase">Instructions for AI (this step)</label>
                        <textarea
                          value={(selectedNode.data as any).aiPrompt || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { aiPrompt: e.target.value })}
                          placeholder={
                            (((selectedNode.data as any).subType || '') as string).toUpperCase() === 'EMAIL'
                              ? 'e.g. "Final value-add email. Open with a specific insight about their company. Lead with a useful resource, NOT a meeting ask. Keep it under 6 sentences."'
                              : 'e.g. "Light opener — reference one detail from their profile. No ask yet. Max 2 sentences."'
                          }
                          className="w-full mt-1 p-2 h-24 bg-white border border-purple-200 rounded-lg text-xs font-medium resize-none"
                        />
                        <div className="mt-1 text-[9px] text-slate-500 leading-relaxed">
                          Tell the AI what this specific step is for. The AI also sees the lead's profile, your business context, past messages sent in this campaign, and where this step sits in the sequence — so focus on what makes THIS step different.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            {(['IF_ELSE', 'REPLIED', 'CONDITION'].includes(String((selectedNode.data as any).subType || '').toUpperCase()) ||
              String((selectedNode.data as any).type || '').toUpperCase() === 'CONDITION') && (() => {
                const cond = (selectedNode.data as any).condition || { source: 'connectionState', field: 'connected', operator: 'is_true' };
                const updateCond = (patch: any) => updateNodeData(selectedNode.id, { condition: { ...cond, ...patch } });
                const isStored = cond.source === 'storedOutputs';
                // Operators that require a literal value comparison.
                const needsValue = ['equals', 'not_equals'].includes(cond.operator);
                return (
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">Branch Condition</div>

                    <div>
                      <label className="text-[10px] font-bold text-purple-600 uppercase">Source</label>
                      <select
                        value={cond.source || 'connectionState'}
                        onChange={(e) => {
                          const nextSource = e.target.value;
                          // Reset field to a sensible default when switching source so
                          // we don't leave a connectionState field selected after the
                          // user picked storedOutputs (or vice versa).
                          const nextField = nextSource === 'storedOutputs' ? 'email-finder.email' : 'connected';
                          updateCond({ source: nextSource, field: nextField });
                        }}
                        className="w-full mt-1 p-2 bg-white border border-purple-200 rounded-lg text-xs font-medium"
                      >
                        <option value="connectionState">Connection state (live)</option>
                        <option value="storedOutputs">Step output (data from upstream node)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-purple-600 uppercase">Field</label>
                      {isStored ? (
                        <input
                          type="text"
                          value={cond.field || ''}
                          onChange={(e) => updateCond({ field: e.target.value })}
                          placeholder="e.g. email-finder.email"
                          className="w-full mt-1 p-2 bg-white border border-purple-200 rounded-lg text-xs font-medium"
                        />
                      ) : (
                        <select
                          value={cond.field || 'connected'}
                          onChange={(e) => updateCond({ field: e.target.value })}
                          className="w-full mt-1 p-2 bg-white border border-purple-200 rounded-lg text-xs font-medium"
                        >
                          <option value="connected">connected (boolean)</option>
                          <option value="connectionStatus">connectionStatus (not_connected / pending / connected)</option>
                          <option value="connectionDegree">connectionDegree (1st / 3rd+)</option>
                        </select>
                      )}
                      {isStored && (
                        <div className="mt-1 text-[9px] text-slate-400 leading-relaxed">
                          Dotted path. Common: <span className="font-mono">email-finder.email</span>, <span className="font-mono">profile-visit.connected</span>, <span className="font-mono">check-connection.connected</span>, <span className="font-mono">follow.alreadyFollowing</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-purple-600 uppercase">Operator</label>
                      <select
                        value={cond.operator || 'is_true'}
                        onChange={(e) => updateCond({ operator: e.target.value })}
                        className="w-full mt-1 p-2 bg-white border border-purple-200 rounded-lg text-xs font-medium"
                      >
                        <option value="is_true">is true</option>
                        <option value="is_false">is false</option>
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="is_null">is null / missing</option>
                        <option value="is_not_null">is not null</option>
                        <option value="is_empty">is empty</option>
                        <option value="is_not_empty">is not empty</option>
                      </select>
                    </div>

                    {needsValue && (
                      <div>
                        <label className="text-[10px] font-bold text-purple-600 uppercase">Value</label>
                        <input
                          type="text"
                          value={String(cond.value ?? '')}
                          onChange={(e) => updateCond({ value: e.target.value })}
                          placeholder="e.g. connected"
                          className="w-full mt-1 p-2 bg-white border border-purple-200 rounded-lg text-xs font-medium"
                        />
                      </div>
                    )}

                    <div className="p-2 bg-purple-50 rounded-lg border border-purple-100 text-[10px] text-purple-600 leading-relaxed">
                      💡 Wire the <strong>true</strong> and <strong>false</strong> handles on this node to different downstream steps. The engine evaluates the condition and only walks one branch per lead.
                    </div>
                  </div>
                );
              })()}

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

          <div className="p-6 border-t bg-slate-50 mt-auto flex items-center gap-2">
            <button
              onClick={() => setSelectedNodeId(null)}
              className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all"
            >
              Close
            </button>
            <button
              onClick={handleSaveStep}
              disabled={savingStep}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {savingStep ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
    </BuilderLockContext.Provider>
  );
}
