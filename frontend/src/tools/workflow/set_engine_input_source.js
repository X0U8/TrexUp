import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'set_engine_input_source',
  description: 'Define whether the engine node receives the original input payload, previous output, or both.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the engine node.' },
      input_source: { type: 'string', enum: ['original', 'previous', 'both'], description: 'Input source mode.' },
    },
    required: ['workflow_id', 'node_id', 'input_source'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const nodeId = String(args?.node_id || '').trim();
  const inputSource = String(args?.input_source || '').trim();

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!nodeId) return { error: 'node_id is required' };
  if (!['original', 'previous', 'both'].includes(inputSource)) {
    return { error: 'input_source must be "original", "previous", or "both"' };
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
    inputSource,
  };

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
    input_source: inputSource,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
