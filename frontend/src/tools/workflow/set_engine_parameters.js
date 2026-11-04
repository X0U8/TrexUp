import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'set_engine_parameters',
  description: 'Configure static parameter inputs, runtime options, and timeouts for an engine node.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the engine node.' },
      parameters: { type: 'object', description: 'Key-value map of engine parameters.' },
      timeout_ms: { type: 'number', description: 'Maximum execution time in milliseconds.' },
    },
    required: ['workflow_id', 'node_id', 'parameters'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const nodeId = String(args?.node_id || '').trim();

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!nodeId) return { error: 'node_id is required' };
  if (!args?.parameters || typeof args.parameters !== 'object') {
    return { error: 'parameters object is required' };
  }

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = { ...resolved.workflowData.nodes };
  const targetNode = nodes[nodeId];

  if (!targetNode) {
    return { error: `Node "${nodeId}" not found in workflow "${workflowId}".` };
  }
  if (targetNode.type !== 'engine') {
    return { error: `Node "${nodeId}" is of type "${targetNode.type}", not "engine".` };
  }

  const updatedNode = {
    ...targetNode,
    parameters: {
      ...(targetNode.parameters || {}),
      ...args.parameters,
    },
  };

  if (typeof args?.timeout_ms === 'number' && !isNaN(args.timeout_ms)) {
    updatedNode.timeoutMs = Math.max(1000, Math.min(600000, args.timeout_ms));
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
    updated: true,
    workflow_id: workflowId,
    node: updatedNode,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
