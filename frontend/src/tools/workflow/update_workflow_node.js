import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'update_workflow_node',
  description: 'Update the title, subtitle, or description of an existing workflow node.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the node to update.' },
      title: { type: 'string', description: 'New title or display name for the node.' },
      subtitle: { type: 'string', description: 'New subtitle or description for the node.' },
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

  const existingNode = nodes[nodeId];
  const updatedNode = {
    ...existingNode,
    title: typeof args?.title === 'string' && args.title.trim() ? args.title.trim() : existingNode.title,
    sub: typeof args?.subtitle === 'string' ? args.subtitle.trim() : existingNode.sub,
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
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
