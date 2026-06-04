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

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}

function mermaidLabel(subType: string, label?: string): string {
  const icon = NODE_ICONS[subType] || '';
  const text = label?.replace(/[<>"']/g, '') || subType;
  return `${icon} ${text}`;
}

interface FlowNode {
  id: string;
  subType: string;
  data?: Record<string, any>;
  type?: string;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export function generateMermaid(nodes: FlowNode[], edges: FlowEdge[]): string {
  const lines: string[] = ['graph TD'];

  for (const node of nodes) {
    const sid = sanitizeId(node.id);
    const label = mermaidLabel(node.subType, node.data?.label);

    if (node.subType === 'IF_ELSE') {
      lines.push(`    ${sid}{${label}}`);
    } else if (node.subType === 'START') {
      lines.push(`    ${sid}(([${label}]))`);
    } else if (node.subType === 'END' || node.subType === 'SUCCESS' || node.subType === 'REPLIED') {
      lines.push(`    ${sid}([${label}])`);
    } else if (node.subType === 'WAIT') {
      lines.push(`    ${sid}[${label}]`);
    } else {
      lines.push(`    ${sid}[${label}]`);
    }
  }

  for (const edge of edges) {
    const src = sanitizeId(edge.source);
    const tgt = sanitizeId(edge.target);

    if (edge.sourceHandle === 'true') {
      lines.push(`    ${src} -->|Yes| ${tgt}`);
    } else if (edge.sourceHandle === 'false') {
      lines.push(`    ${src} -->|No| ${tgt}`);
    } else {
      lines.push(`    ${src} --> ${tgt}`);
    }
  }

  return lines.join('\n');
}
