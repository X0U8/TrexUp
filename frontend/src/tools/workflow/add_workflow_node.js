import { resolveWorkflow, generateNextNodeId, WORKFLOW_NODE_TYPES } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'add_workflow_node',
  description: 'Add a new node (agent, engine, input, output, or router) to the workflow canvas at coordinates.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      type: { type: 'string', enum: ['agent', 'engine', 'input', 'output', 'router'], description: 'Category of node.' },
      title: { type: 'string', description: 'Display title for the node.' },
      x: { type: 'number', description: 'X coordinate on the canvas.' },
      y: { type: 'number', description: 'Y coordinate on the canvas.' },
      sub: { type: 'string', description: 'Subtitle or description.' },
      model_id: { type: 'string', description: 'Model ID if type is agent (e.g. "muse-spark-1.3").' },
      engine_id: { type: 'string', description: 'Engine ID if type is engine (e.g. "file_detection").' },
      tools: { type: 'boolean', description: 'Whether tool calling is active for this agent (default: true).' },
    },
    required: ['workflow_id', 'type', 'title', 'x', 'y'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const type = String(args?.type || '').toLowerCase();
  const title = String(args?.title || '').trim();
  const x = Number(args?.x);
  const y = Number(args?.y);

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!WORKFLOW_NODE_TYPES.includes(type)) {
    return { error: `Invalid node type "${type}". Allowed types: ${WORKFLOW_NODE_TYPES.join(', ')}` };
  }
  if (!title) return { error: 'Node title is required' };
  if (isNaN(x) || isNaN(y)) return { error: 'Coordinates x and y must be numbers' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = { ...resolved.workflowData.nodes };
  const nodeId = generateNextNodeId(nodes, type);

  const newNode = {
    id: nodeId,
    title,
    sub: args?.sub || (type === 'agent' ? args?.model_id || 'Muse Spark' : type === 'engine' ? args?.engine_id || 'Python engine' : ''),
    type,
    x,
    y,
    width: 185,
    height: 56,
  };

  if (type === 'agent') {
    newNode.modelId = args?.model_id || 'muse-spark-1.3';
    newNode.modelName = args?.model_id || 'Muse Spark 1.3';
    newNode.systemPrompt = 'You are a workflow agent. Process input and produce structured output.';
    newNode.temperature = 0.2;
    newNode.reasoningEffort = 'minimal';
    newNode.inputSource = 'previous';
    newNode.tools = typeof args?.tools === 'boolean' ? args.tools : true;
  } else if (type === 'engine') {
    newNode.engineId = args?.engine_id || 'file_detection';
    newNode.inputSource = 'previous';
  } else if (type === 'input') {
    newNode.trigger = 'manual';
    newNode.acceptedTypes = ['canvas_nodes', 'files'];
    newNode.sourceScope = 'canvas_nodes';
  } else if (type === 'output') {
    newNode.inputSource = 'previous';
  }

  nodes[nodeId] = newNode;

  const updatedWorkflowData = {
    ...resolved.workflowData,
    nodes,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    added: true,
    workflow_id: workflowId,
    node: newNode,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
