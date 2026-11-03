import { resolveNodeId, getExplorationContext } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'get_connections',
  description:
    'Retrieve relationships connected to a specific node, or all connections on the exploration canvas. Supports filtering by direction.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      exploration_id: {
        type: 'string',
        description: 'The unique ID of the exploration canvas.',
      },
      node_id: {
        type: 'string',
        description: 'Optional node ID to inspect connections for. If omitted, returns all connections.',
      },
      direction: {
        type: 'string',
        enum: ['both', 'outgoing', 'incoming'],
        description: 'Direction of connections relative to node_id (default: "both").',
      },
    },
    required: ['exploration_id'],
  },
};

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes, updatedConnections } = getExplorationContext(ctx, args);
  const rawNid = args.node_id ? resolveNodeId(updatedNodes, args.node_id) : null;
  const dir = (args.direction || 'both').toLowerCase();
  let list = Object.values(updatedConnections);

  if (rawNid) {
    if (dir === 'outgoing') {
      list = list.filter((c) => c.source_node_id === rawNid);
    } else if (dir === 'incoming') {
      list = list.filter((c) => c.target_node_id === rawNid);
    } else {
      list = list.filter((c) => c.source_node_id === rawNid || c.target_node_id === rawNid);
    }
  }

  return {
    success: true,
    exploration_id: targetExpId,
    node_id: rawNid,
    count: list.length,
    connections: list,
  };
}
