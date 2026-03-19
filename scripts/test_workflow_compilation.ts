/**
 * This script demonstrates the compilation of a React Flow graph into a linear sequence
 * that the worker can understand. It mimics the logic used to save the workflow.
 */

interface FlowNode {
    id: string;
    type: string;
    data: any;
}

interface FlowEdge {
    source: string;
    target: string;
}

function compileWorkflow(nodes: FlowNode[], edges: FlowEdge[]) {
    const sequence: any[] = [];
    const visited = new Set<string>();

    // 1. Find the trigger node
    const trigger = nodes.find(n => n.type === 'TRIGGER');
    if (!trigger) return [];

    let currentNodeId = trigger.id;
    visited.add(currentNodeId);

    // 2. Traverse the graph linearly
    // Simple linear traversal for MVP. More complex branching (CONDITION nodes) 
    // would require a tree/graph structure instead of a flat array.
    while (true) {
        const edge = edges.find(e => e.source === currentNodeId);
        if (!edge) break;

        const nextNode = nodes.find(n => n.id === edge.target);
        if (!nextNode || visited.has(nextNode.id)) break;

        sequence.push({
            id: nextNode.id,
            type: nextNode.data.subType || nextNode.type,
            label: nextNode.data.label,
            ...nextNode.data
        });

        currentNodeId = nextNode.id;
        visited.add(currentNodeId);
    }

    return sequence;
}

// Example Data
const mockNodes = [
    { id: 't1', type: 'TRIGGER', data: { label: 'Start' } },
    { id: 'v1', type: 'ACTION', data: { label: 'Visit', subType: 'VISIT' } },
    { id: 'i1', type: 'ACTION', data: { label: 'Invite', subType: 'INVITE', message: 'Hello!' } },
    { id: 'w1', type: 'DELAY', data: { label: 'Wait', subType: 'WAIT', days: 2 } },
];

const mockEdges = [
    { source: 't1', target: 'v1' },
    { source: 'v1', target: 'i1' },
    { source: 'i1', target: 'w1' },
];

const result = compileWorkflow(mockNodes, mockEdges);
console.log('--- COMPILED WORKFLOW SEQUENCE ---');
console.log(JSON.stringify(result, null, 2));

if (result.length === 3) {
    console.log('\nSUCCESS: Workflow compiled correctly.');
} else {
    console.log('\nFAILURE: Compilation error.');
}
