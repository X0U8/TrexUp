import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'configure_output_node',
  description: 'Configure workflow exit destination and canvas mapping targets.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the output node.' },
      destination: { type: 'string', enum: ['canvas', 'documents', 'notification', 'exploration_graph'], description: 'Exit target.' },
      title: { type: 'string', description: 'Display title for output.' },
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
  if (targetNode.type !== 'output') {
    return { error: `Node "${nodeId}" is of type "${targetNode.type}", not "output".` };
  }

  const updatedNode = { ...targetNode };

  if (args?.destination) {
    updatedNode.destination = args.destination;
    updatedNode.sub = args.destination.replace('_', ' ');
  }

  if (args?.title) {
    updatedNode.title = args.title;
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
