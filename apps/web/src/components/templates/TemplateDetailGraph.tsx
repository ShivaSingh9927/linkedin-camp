'use client';

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const NODE_ICONS: Record<string, string> = {
  PROFILE_VISIT: '👤',
  WAIT: '⏳',
  CONNECT: '🔗',
  MESSAGE: '💬',
  LIKE: '👍',
  COMMENT: '💭',
  EMAIL_FINDER: '📡',
  EMAIL: '📧',
  FOLLOW: '👣',
  CRM_SYNC: '📊',
  IF_ELSE: '🔀',
  START: '▶',
  END: '✅',
};

const NODE_COLORS: Record<string, string> = {
  PROFILE_VISIT: '#3b82f6',
  WAIT: '#f59e0b',
  CONNECT: '#8b5cf6',
  MESSAGE: '#ec4899',
  LIKE: '#ef4444',
  COMMENT: '#f97316',
  EMAIL_FINDER: '#06b6d4',
  EMAIL: '#10b981',
  FOLLOW: '#6b7280',
  CRM_SYNC: '#6366f1',
  IF_ELSE: '#14b8a6',
  START: '#22c55e',
  END: '#22c55e',
};

interface NodeData {
  subType: string;
  label?: string;
  delayDays?: number;
  hours?: number;
  [key: string]: unknown;
}

function ActionNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  const color = NODE_COLORS[d.subType] || '#94a3b8';
  return (
    <div className="px-4 py-2.5 rounded-xl border-2 shadow-sm bg-white" style={{ borderColor: color }}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span className="text-lg">{NODE_ICONS[d.subType] || '•'}</span>
        <span className="text-xs font-bold text-slate-700 whitespace-nowrap">{d.label || d.subType}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function ConditionNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  const color = NODE_COLORS[d.subType] || '#14b8a6';
  return (
    <div
      className="px-4 py-3 rounded-xl border-2 shadow-sm bg-white flex items-center justify-center"
      style={{ borderColor: color, transform: 'rotate(45deg)', width: 80, height: 80 }}
    >
      <div style={{ transform: 'rotate(-45deg)' }} className="flex flex-col items-center">
        <Handle type="target" position={Position.Top} />
        <span className="text-lg">{NODE_ICONS[d.subType] || '🔀'}</span>
        <span className="text-[9px] font-bold text-slate-600 text-center leading-tight mt-0.5">
          {d.label || 'Branch'}
        </span>
        <Handle type="source" position={Position.Bottom} id="true" />
        <Handle type="source" position={Position.Right} id="false" style={{ top: '50%', right: -8 }} />
      </div>
    </div>
  );
}

function DelayNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  return (
    <div className="px-4 py-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 shadow-sm">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span className="text-lg">⏳</span>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-amber-700 whitespace-nowrap">{d.label}</span>
          <span className="text-[10px] text-amber-500 font-semibold">{d.delayDays || d.hours ? `${d.delayDays || d.hours}d` : ''}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function TerminalNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  const label = d.label || '';
  const isSuccess = d.subType === 'SUCCESS' || label.toLowerCase().includes('success') || label.toLowerCase().includes('replied');
  const color = isSuccess ? '#22c55e' : '#ef4444';
  return (
    <div className="px-4 py-2 rounded-full border-2 shadow-sm bg-white" style={{ borderColor: color }}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{isSuccess ? '✅' : '❌'}</span>
        <span className="text-[10px] font-bold whitespace-nowrap" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  TRIGGER: ActionNode,
  ACTION: ActionNode,
  DELAY: DelayNode,
  CONDITION: ConditionNode,
  TERMINAL: TerminalNode,
};

interface TemplateDetailGraphProps {
  nodes: { id: string; type?: string; subType: string; data?: Record<string, any>; position?: { x: number; y: number } }[];
  edges: { id: string; source: string; target: string; sourceHandle?: string | null }[];
}

const NODE_W = 180;
const NODE_H = 60;
const CONDITION_SIZE = 100;
const COL_GAP = 80;
const ROW_GAP = 60;
const BRANCH_X_OFFSET = 200;

function getNodeSize(n: { subType: string }): { w: number; h: number } {
  if (n.subType === 'IF_ELSE') return { w: CONDITION_SIZE, h: CONDITION_SIZE };
  if (n.subType === 'END' || n.subType === 'SUCCESS' || n.subType === 'REPLIED' || n.subType === 'TERMINAL') {
    return { w: 140, h: 50 };
  }
  return { w: NODE_W, h: NODE_H };
}

interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  width: number;
  height: number;
}

function layoutWorkflow(
  rawNodes: TemplateDetailGraphProps['nodes'],
  rawEdges: TemplateDetailGraphProps['edges']
): LayoutResult {
  if (rawNodes.length === 0) return { positions: {}, width: 0, height: 0 };

  const idToNode = new Map(rawNodes.map(n => [n.id, n]));

  // adjacency: source -> [{target, handle}]
  const outgoing = new Map<string, Array<{ target: string; handle: string | null }>>();
  for (const n of rawNodes) outgoing.set(n.id, []);
  for (const e of rawEdges) {
    const list = outgoing.get(e.source);
    if (list) list.push({ target: e.target, handle: e.sourceHandle ?? null });
  }

  // Find trigger / start node
  const trigger = rawNodes.find(n => n.type === 'TRIGGER' || n.subType === 'START');
  if (!trigger) {
    // fallback: use first node
    return { positions: { [rawNodes[0].id]: { x: 0, y: 0 } }, width: NODE_W, height: NODE_H };
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const sizes: Record<string, { w: number; h: number }> = {};
  for (const n of rawNodes) sizes[n.id] = getNodeSize(n);

  // BFS from trigger. When we hit an IF_ELSE, recurse into both branches
  // tracking horizontal offset. The IF_ELSE itself sits on the parent column;
  // its true/false children shift right/left by BRANCH_X_OFFSET and get
  // their own subtree laid out.
  //
  // We compute x by accumulating branch offsets and y by depth.

  type SubPos = { x: number; y: number };
  const placed = new Set<string>();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  function placeSubtree(rootId: string, baseX: number, baseY: number, parentBranchOffset: number) {
    // BFS layering, but following the same branch for chains.
    // For IF_ELSE roots we recurse twice with offsets.
    const queue: Array<{ id: string; x: number; y: number }> = [{ id: rootId, x: baseX, y: baseY }];
    while (queue.length) {
      const { id, x, y } = queue.shift()!;
      if (placed.has(id)) continue;
      const sz = sizes[id]!;
      const cx = x - sz.w / 2;
      const cy = y - sz.h / 2;
      positions[id] = { x: cx, y: cy };
      placed.add(id);
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx + sz.w);
      minY = Math.min(minY, cy);
      maxY = Math.max(maxY, cy + sz.h);

      const node = idToNode.get(id);
      if (!node) continue;
      const outs = outgoing.get(id) || [];

      if (node.subType === 'IF_ELSE') {
        const trueEdge = outs.find(o => o.handle === 'true');
        const falseEdge = outs.find(o => o.handle === 'false');
        const childY = y + sz.h / 2 + ROW_GAP + (CONDITION_SIZE / 2);
        if (trueEdge) {
          // shift right: but if parent already shifted, keep it
          const childX = x + BRANCH_X_OFFSET;
          queue.push({ id: trueEdge.target, x: childX, y: childY });
        }
        if (falseEdge) {
          const childX = x - BRANCH_X_OFFSET;
          queue.push({ id: falseEdge.target, x: childX, y: childY });
        }
      } else {
        // Single (or no) outgoing: stack straight down, inheriting x
        for (const out of outs) {
          if (placed.has(out.target)) continue;
          const childY = y + sz.h / 2 + ROW_GAP + (sizes[out.target]!.h / 2);
          queue.push({ id: out.target, x, y: childY });
        }
      }
    }
  }

  placeSubtree(trigger.id, 0, 0, 0);

  // Any orphans (unreachable from trigger): stack to the right
  let orphanX = maxX + COL_GAP * 2;
  for (const n of rawNodes) {
    if (placed.has(n.id)) continue;
    placeSubtree(n.id, orphanX, 0, 0);
    orphanX = maxX + COL_GAP * 2;
  }

  return {
    positions,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function TemplateDetailGraph({ nodes, edges }: TemplateDetailGraphProps) {
  const layout = layoutWorkflow(nodes, edges);

  const flowNodes: Node[] = nodes.map((n) => {
    let nodeTypeLabel = n.type || 'ACTION';
    if (n.subType === 'WAIT') nodeTypeLabel = 'DELAY';
    else if (n.subType === 'IF_ELSE') nodeTypeLabel = 'CONDITION';
    else if (n.subType === 'END' || n.subType === 'SUCCESS' || n.subType === 'REPLIED') nodeTypeLabel = 'TERMINAL';
    else if (n.type === 'TRIGGER') nodeTypeLabel = 'TRIGGER';

    return {
      id: n.id,
      type: nodeTypeLabel,
      position: layout.positions[n.id] || n.position || { x: 0, y: 0 },
      data: { label: n.data?.label || n.subType, subType: n.subType, ...n.data },
    };
  });

  const flowEdges: Edge[] = edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || undefined,
    animated: false,
    style: {
      stroke: e.sourceHandle === 'true' ? '#22c55e' : e.sourceHandle === 'false' ? '#ef4444' : '#94a3b8',
      strokeWidth: 2,
    },
    label: e.sourceHandle === 'true' ? 'Yes' : e.sourceHandle === 'false' ? 'No' : undefined,
    labelStyle: { fontSize: 10, fontWeight: 700, fill: '#64748b' },
  }));

  return (
    <div className="w-full h-full rounded-2xl border bg-white overflow-hidden">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        panOnDrag
        zoomOnScroll
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        className="bg-slate-50/50"
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeColor="#94a3b8"
          nodeColor="#f1f5f9"
          maskColor="rgba(0,0,0,0.05)"
          style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
        />
      </ReactFlow>
    </div>
  );
}
