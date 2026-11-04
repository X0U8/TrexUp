import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'auto_layout_workflow',
  description: 'Automatically compute clean topological coordinates for all nodes to eliminate crossing and overlap.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      direction: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Layout direction (default horizontal).' },
    },
    required: ['workflow_id'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  if (!workflowId) return { error: 'workflow_id is required' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = { ...resolved.workflowData.nodes };
  const threads = resolved.workflowData.threads || [];
  const nodeIds = Object.keys(nodes);

  if (nodeIds.length === 0) {
    return { error: 'Workflow has no nodes to arrange' };
  }

  // Build adjacency
  const inDegree = {};
  const adj = {};
  nodeIds.forEach((id) => {
    inDegree[id] = 0;
    adj[id] = [];
  });

  threads.forEach((th) => {
    if (nodes[th.from] && nodes[th.to]) {
      adj[th.from].push(th.to);
      inDegree[th.to] = (inDegree[th.to] || 0) + 1;
    }
  });

  // Assign layers
  const layers = {};
  const queue = nodeIds.filter((id) => inDegree[id] === 0 || nodes[id].type === 'input');
  if (queue.length === 0 && nodeIds.length > 0) queue.push(nodeIds[0]);

  queue.forEach((id) => {
    layers[id] = 0;
  });

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const currLayer = layers[curr] || 0;
    (adj[curr] || []).forEach((next) => {
      if (layers[next] === undefined || layers[next] < currLayer + 1) {
        layers[next] = currLayer + 1;
        queue.push(next);
      }
    });
  }

  nodeIds.forEach((id) => {
    if (layers[id] === undefined) layers[id] = 1;
  });

  // Group nodes by layer
  const layerGroups = {};
  nodeIds.forEach((id) => {
    const l = layers[id];
    if (!layerGroups[l]) layerGroups[l] = [];
    layerGroups[l].push(id);
  });

  // Assign coordinates
  const sortedLayers = Object.keys(layerGroups).map(Number).sort((a, b) => a - b);
  sortedLayers.forEach((layerIdx) => {
    const group = layerGroups[layerIdx];
    const totalInLayer = group.length;
    const startY = 260 - ((totalInLayer - 1) * 110) / 2;

    group.forEach((nodeId, idx) => {
      nodes[nodeId] = {
        ...nodes[nodeId],
        x: 60 + layerIdx * 260,
        y: Math.max(80, startY + idx * 110),
      };
    });
  });

  const updatedWorkflowData = {
    ...resolved.workflowData,
    nodes,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    arranged: true,
    workflow_id: workflowId,
    node_count: nodeIds.length,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
