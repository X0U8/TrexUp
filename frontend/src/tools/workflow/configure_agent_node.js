import { resolveWorkflow, AVAILABLE_AGENT_MODELS } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'configure_agent_node',
  description: 'Set intelligence parameters including model, system prompt, temperature, and reasoning effort.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the agent node.' },
      model_id: { type: 'string', description: 'AI model identifier (e.g. "muse-spark-1.3").' },
      system_prompt: { type: 'string', description: 'System instruction prompt for the agent.' },
      temperature: { type: 'number', description: 'Sampling temperature between 0.0 and 1.0.' },
      reasoning_effort: { type: 'string', enum: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'], description: 'Reasoning depth level.' },
      tools: { type: 'boolean', description: 'Whether tool calling is enabled for this agent.' },
      selected_tools: { type: 'array', items: { type: 'string' }, description: 'Allowed tool names for this agent.' },
    },
    required: ['workflow_id', 'node_id'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const nodeId = String(args?.node_id || '').trim();

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!nodeId) return { error: 'node_id is required' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = { ...resolved.workflowData.nodes };
  const targetNode = nodes[nodeId];

  if (!targetNode) {
    return { error: `Node "${nodeId}" not found in workflow "${workflowId}".` };
  }
  if (targetNode.type !== 'agent') {
    return { error: `Node "${nodeId}" is of type "${targetNode.type}", not "agent".` };
  }

  const updatedNode = { ...targetNode };

  if (args?.model_id) {
    const matchedModel = AVAILABLE_AGENT_MODELS.find((m) => m.id === args.model_id);
    updatedNode.modelId = args.model_id;
    updatedNode.modelName = matchedModel?.name || args.model_id;
    updatedNode.sub = matchedModel?.name || args.model_id;
  }

  if (typeof args?.system_prompt === 'string') {
    updatedNode.systemPrompt = args.system_prompt;
  }

  if (typeof args?.temperature === 'number' && !isNaN(args.temperature)) {
    updatedNode.temperature = Math.max(0, Math.min(1, args.temperature));
  }

  if (args?.reasoning_effort) {
    updatedNode.reasoningEffort = args.reasoning_effort;
  }

  if (typeof args?.tools === 'boolean') {
    updatedNode.tools = args.tools;
  }

  if (Array.isArray(args?.selected_tools)) {
    updatedNode.selectedTools = args.selected_tools;
    if (args.selected_tools.length > 0 && updatedNode.tools === undefined) {
      updatedNode.tools = true;
    }
  }

  nodes[nodeId] = updatedNode;

  const updatedWorkflowData = {
    ...resolved.workflowData,
    nodes,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    configured: true,
    workflow_id: workflowId,
    node: updatedNode,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
