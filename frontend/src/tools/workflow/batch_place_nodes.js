import { resolveWorkflow, generateNextNodeId, WORKFLOW_NODE_TYPES } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'batch_place_nodes',
  description: 'Place multiple workflow nodes and relative coordinates in a single structured operation.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['agent', 'engine', 'input', 'output', 'router'] },
            title: { type: 'string' },
            x: { type: 'number' },
            y: { type: 'number' },
            sub: { type: 'string' },
            model_id: { type: 'string' },
            engine_id: { type: 'string' },
          },
          required: ['type', 'title', 'x', 'y'],
        },
        description: 'Array of node placement specifications.',
      },
    },
    required: ['workflow_id', 'nodes'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const rawList = Array.isArray(args?.nodes) ? args.nodes : [];

  if (!workflowId) return { error: 'workflow_id is required' };
  if (rawList.length === 0) return { error: 'nodes array cannot be empty' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = { ...resolved.workflowData.nodes };
  const createdNodes = [];

  for (const item of rawList) {
    const type = String(item.type || '').toLowerCase();
    const title = String(item.title || '').trim();
    const x = Number(item.x);
    const y = Number(item.y);

    if (!WORKFLOW_NODE_TYPES.includes(type) || !title || isNaN(x) || isNaN(y)) continue;

    const nodeId = generateNextNodeId(nodes, type);
    const newNode = {
      id: nodeId,
      title,
      sub: item.sub || (type === 'agent' ? item.model_id || 'Muse Spark' : type === 'engine' ? item.engine_id || 'Python engine' : ''),
      type,
      x,
      y,
      width: 185,
      height: 56,
    };

    if (type === 'agent') {
      newNode.modelId = item.model_id || 'muse-spark-1.3';
      newNode.modelName = item.model_id || 'Muse Spark 1.3';
      newNode.systemPrompt = 'You are a workflow agent. Process input and produce structured output.';
      newNode.temperature = 0.2;
      newNode.reasoningEffort = 'minimal';
      newNode.inputSource = 'previous';
    } else if (type === 'engine') {
      newNode.engineId = item.engine_id || 'file_detection';
      newNode.inputSource = 'previous';
    }

    nodes[nodeId] = newNode;
    createdNodes.push(newNode);
  }

  const updatedWorkflowData = {
    ...resolved.workflowData,
    nodes,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    placed: true,
    workflow_id: workflowId,
    placed_count: createdNodes.length,
    nodes: createdNodes,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
