import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'delete_workflow_node',
  description: 'Remove a node and all its connected threads from the workflow graph.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the node to delete.' },
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
  if (!nodes[nodeId]) {
    return { error: `Node "${nodeId}" not found in workflow "${workflowId}".` };
  }

  delete nodes[nodeId];

  const threads = (resolved.workflowData.threads || []).filter(
    (th) => th.from !== nodeId && th.to !== nodeId
  );

  const updatedWorkflowData = {
    ...resolved.workflowData,
    nodes,
    threads,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    deleted: true,
    workflow_id: workflowId,
    node_id: nodeId,
    updatedWorkflowNodes: nodes,
    updatedWorkflowThreads: threads,
    updatedWorkflowsData,
  };
}
