const campaignJson = {
  "edges": [
    {"id": "e1-2", "source": "node_1", "target": "node_2"},
    {"id": "e2-3", "source": "node_2", "target": "node_3"}
  ],
  "nodes": [
    {"id": "node_1", "data": {"type": "TRIGGER", "label": "Trigger: Lead Added", "subType": "START"}, "type": "input", "position": {"x": 250, "y": 50}},
    {"id": "node_2", "data": {"type": "ACTION", "label": "Visit Profile", "subType": "PROFILE_VISIT"}, "position": {"x": 250, "y": 150}},
    {"id": "node_3", "data": {"text": "Hi {firstName}! Great connecting.", "type": "ACTION", "label": "Send Message", "subType": "MESSAGE"}, "position": {"x": 250, "y": 250}}
  ]
};

const config: any = campaignJson;

// Convert React Flow graph (nodes/edges) into a linear flow array for the engine
if (config.nodes && config.edges && !config.flow) {
    const orderedNodes: any[] = [];
    let currentNodeId = config.nodes.find((n: any) => 
        n.type === 'TRIGGER' || 
        n.id === 'trigger' || 
        n.data?.subType === 'START' ||
        n.subType === 'START'
    )?.id;
    
    while (currentNodeId) {
        const edge = config.edges.find((e: any) => e.source === currentNodeId);
        if (!edge) break;
        
        currentNodeId = edge.target;
        const targetNode = config.nodes.find((n: any) => n.id === currentNodeId);
        if (targetNode) orderedNodes.push(targetNode);
    }

    config.flow = orderedNodes.map((node: any) => {
        const data = node.data || {};
        const rawSubType = (data.subType || node.subType || node.type || '').toUpperCase();
        let mappedNodeType = rawSubType;
        
        switch(rawSubType) {
            case 'VISIT':
            case 'PROFILE_VISIT':
                mappedNodeType = 'profile-visit'; 
                break;
            case 'MESSAGE': 
                mappedNodeType = 'send-message'; break;
            case 'LIKE_POST': mappedNodeType = 'like-nth-post'; break;
            case 'COMMENT_POST': mappedNodeType = 'comment-nth-post'; break;
            case 'CONNECT': mappedNodeType = 'connect'; break;
            case 'DELAY': mappedNodeType = 'delay'; break;
        }

        return {
            ...data,
            node: mappedNodeType
        };
    });

    console.log('✅ Flow created successfully!');
    console.log('Flow nodes:', config.flow.map((n:any) => n.node));
}