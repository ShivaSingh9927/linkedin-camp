import type { Node, Edge } from '@xyflow/react';

// Layered top-to-bottom auto-layout for the campaign builder canvas.
//
// Stored node positions drifted badly (fixed y-steps smaller than the node
// height → overlap; branch children stacked on top of each other). Rather than
// trust those, we recompute a clean layout on load: each node's level is its
// longest distance from a root, nodes in a level spread horizontally and
// centered, so an IF_ELSE's true/false children sit side by side instead of
// overlapping. Deterministic and dependency-free.

const VGAP = 150;   // vertical gap between levels
const HGAP = 300;   // horizontal gap between siblings within a level
const ORIGIN_X = 280;
const ORIGIN_Y = 40;

export function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length <= 1) return nodes;

  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => { indeg.set(n.id, 0); adj.set(n.id, []); });
  edges.forEach((e) => {
    if (!adj.has(e.source) || !indeg.has(e.target)) return;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
  });

  // Longest-path levelization. Seed roots (indegree 0); fall back to the first
  // node if the graph has no clean root (e.g. a cycle).
  const level = new Map<string, number>();
  const remaining = new Map(indeg);
  const queue: string[] = [];
  nodes.forEach((n) => { if ((remaining.get(n.id) || 0) === 0) { level.set(n.id, 0); queue.push(n.id); } });
  if (queue.length === 0) { level.set(nodes[0].id, 0); queue.push(nodes[0].id); }

  let guard = 0;
  const maxIters = nodes.length * (edges.length + 1) + nodes.length + 5;
  while (queue.length && guard++ < maxIters) {
    const id = queue.shift()!;
    const lv = level.get(id) || 0;
    for (const child of adj.get(id) || []) {
      level.set(child, Math.max(level.get(child) ?? 0, lv + 1));
      const d = (remaining.get(child) ?? 1) - 1;
      remaining.set(child, d);
      if (d <= 0) queue.push(child);
    }
  }

  // Place any still-unleveled (disconnected) nodes below everything else.
  let maxLv = 0;
  level.forEach((v) => { if (v > maxLv) maxLv = v; });
  nodes.forEach((n) => { if (!level.has(n.id)) level.set(n.id, ++maxLv); });

  const byLevel = new Map<number, string[]>();
  nodes.forEach((n) => {
    const lv = level.get(n.id) || 0;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(n.id);
  });

  const pos = new Map<string, { x: number; y: number }>();
  byLevel.forEach((ids, lv) => {
    ids.forEach((id, i) => {
      pos.set(id, {
        x: ORIGIN_X + (i - (ids.length - 1) / 2) * HGAP,
        y: ORIGIN_Y + lv * VGAP,
      });
    });
  });

  return nodes.map((n) => ({ ...n, position: pos.get(n.id) || n.position }));
}
