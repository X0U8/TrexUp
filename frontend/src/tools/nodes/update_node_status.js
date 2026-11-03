import { NODE_STATUSES, resolveNodeId, getExplorationContext } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'update_node_status',
  description:
    'Update the verification status of a node within an exploration canvas. A clear justification explaining what evidence or finding caused the status change is strictly required.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      exploration_id: {
        type: 'string',
        description: 'The unique ID of the exploration canvas containing the node.',
      },
      node_id: {
        type: 'string',
        description: 'The unique ID of the node.',
      },
      status: {
        type: 'string',
        enum: NODE_STATUSES,
        description: 'The new verification status.',
      },
      justification: {
        type: 'string',
        description:
          "Mandatory explanation of why this node is now marked as this status (e.g. 'Verified by Table 2 in CALDERA-0434 showing thermal limits match').",
      },
    },
    required: ['exploration_id', 'node_id', 'status', 'justification'],
  },
};

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes } = getExplorationContext(ctx, args);
  const id = resolveNodeId(updatedNodes, args.node_id);
  const status = (args.status || '').trim();
  const justification = (args.justification || '').trim();

  if (!id || !updatedNodes[id]) {
    return { error: `Node with id '${args.node_id}' does not exist in exploration '${targetExpId}'.` };
  }
  if (!justification || justification.length < 6) {
    return {
      error:
        'status update refused: justification must explain the reason (min 6 characters)',
    };
  }

  const node = { ...updatedNodes[id] };
  const prevStatus = node.status || 'proposed';
  node.status = status;
  node.updatedAt = new Date().toISOString();
  node.statusHistory = [
    ...(node.statusHistory || []),
    { status, previousStatus: prevStatus, justification, timestamp: new Date().toISOString() },
  ];

  updatedNodes[id] = node;
  return {
    success: true,
    updated: true,
    exploration_id: targetExpId,
    node_id: id,
    previous_status: prevStatus,
    new_status: status,
    justification,
    updatedNodes,
  };
}
