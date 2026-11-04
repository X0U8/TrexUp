import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'move_workflow_node',
  description: 'Reposition an existing workflow node to new coordinates on the visual canvas.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the node to move.' },
      x: { type: 'number', description: 'New X position.' },
      y: { type: 'number', description: 'New Y position.' },
    },
    required: ['workflow_id', 'node_id', 'x', 'y'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const nodeId = String(args?.node_id || '').trim();
  const x = Number(args?.x);
  const y = Number(args?.y);

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!nodeId) return { error: 'node_id is required' };
  if (isNaN(x) || isNaN(y)) return { error: 'Coordinates x and y must be numbers' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = { ...resolved.workflowData.nodes };
  if (!nodes[nodeId]) {
    return { error: `Node "${nodeId}" not found in workflow "${workflowId}".` };
  }

  nodes[nodeId] = {
    ...nodes[nodeId],
    x,
    y,
  };

  const updatedWorkflowData = {
    ...resolved.workflowData,
    nodes,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    moved: true,
    workflow_id: workflowId,
    node_id: nodeId,
    x,
    y,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
