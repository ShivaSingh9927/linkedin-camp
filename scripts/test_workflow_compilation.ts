import { Node, Edge } from '@xyflow/react';

/**
 * Compiles a React Flow graph into a linear sequence for the LinkedIn Worker.
 * If branches exist, it takes the 'YES' path by default for this simple version.
 */
export function compileWorkflow(nodes: Node[], edges: Edge[]) {
    const sequence: any[] = [];
    let currentNode = nodes.find(n => n.type === 'TRIGGER');

    if (!currentNode) {
        console.error("No Trigger node found!");
        return [];
    }

    const visited = new Set<string>();

    while (currentNode && !visited.has(currentNode.id)) {
        visited.add(currentNode.id);

        // Add to sequence if it's an Action or Delay
        if (currentNode.type === 'ACTION' || currentNode.type === 'DELAY') {
            sequence.push({
                id: currentNode.id,
                type: (currentNode.data as any).subType || currentNode.type,
                text: (currentNode.data as any).message, // Worker expects .text
                note: (currentNode.data as any).message,  // For invites
                days: (currentNode.data as any).days
            });
        }

        // Find next node
        const edge = edges.find(e => e.source === currentNode?.id);
        if (!edge) break;

        currentNode = nodes.find(n => n.id === edge.target);
    }

    return sequence;
}

// Mock Data for Testing
const mockNodes: Node[] = [
    { id: '1', type: 'TRIGGER', position: { x: 0, y: 0 }, data: { label: 'Start' } },
    { id: '2', type: 'ACTION', position: { x: 0, y: 100 }, data: { label: 'Send Message', subType: 'MESSAGE', message: 'Hello {firstName}' } },
    { id: '3', type: 'DELAY', position: { x: 0, y: 200 }, data: { label: 'Wait', subType: 'WAIT', days: 2 } }
];

const mockEdges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' }
];

console.log("Compiling Workflow...");
const result = compileWorkflow(mockNodes, mockEdges);
console.log("Compiled Sequence:", JSON.stringify(result, null, 2));

if (result.length === 2 && result[0].type === 'MESSAGE' && result[1].days === 2) {
    console.log("✅ Test Passed: Workflow compiled correctly.");
} else {
    console.error("❌ Test Failed: Compilation mismatch.");
    process.exit(1);
}
