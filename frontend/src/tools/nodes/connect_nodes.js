import {
  RELATIONSHIP_TYPES,
  resolveNodeId,
  generateSequentialThreadId,
  getExplorationContext,
} from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'connect_nodes',
  description:
    'Create a relationship between nodes in an exploration canvas. Supports connecting a source node to one or multiple target nodes simultaneously (batch mode). A clear reasoning description is strictly required.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      exploration_id: {
        type: 'string',
        description: 'The unique ID of the exploration canvas containing the nodes.',
      },
      source_node_id: {
        type: 'string',
        description: 'The unique ID of the source node.',
      },
      target_node_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'A list of target node IDs to connect to simultaneously.',
      },
      target_node_id: {
        type: 'string',
        description: 'Alternative single target node ID (use target_node_ids for multiple).',
      },
      relationship_type: {
        type: 'string',
        enum: RELATIONSHIP_TYPES,
        description: 'Semantic relationship type (default: "related_to").',
      },
      description: {
        type: 'string',
        description: 'Mandatory reasoning explaining why these nodes are connected.',
      },
      metadata: {
        type: 'object',
        description: 'Optional arbitrary metadata.',
      },
    },
    required: ['exploration_id', 'source_node_id', 'description'],
  },
};

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes, updatedConnections } = getExplorationContext(ctx, args);
  const srcId = resolveNodeId(updatedNodes, args.source_node_id);
  if (!srcId || !updatedNodes[srcId]) {
    return { error: `Source node '${args.source_node_id}' does not exist in exploration '${targetExpId}'.` };
  }

  const desc = (args.description || args.reasoning || 'Connected related exploration nodes').trim();

  let targets = args.target_node_ids || [];
  if (typeof targets === 'string') targets = [targets];
  if (!targets.length && args.target_node_id) targets = [args.target_node_id];

  if (!targets.length) {
    return { error: 'target_node_ids or target_node_id is required.' };
  }

  const relType = args.relationship_type || 'related_to';
  const createdConns = [];

  for (const rawTid of targets) {
    const tid = resolveNodeId(updatedNodes, rawTid);
    if (!tid || !updatedNodes[tid]) {
      return { error: `Target node '${rawTid}' does not exist in exploration '${targetExpId}'.` };
    }
    if (tid === srcId) {
      return { error: 'Cannot connect a node to itself.' };
    }

    const exists = Object.values(updatedConnections).some(
      (c) => c.source_node_id === srcId && c.target_node_id === tid
    );
    if (exists) continue;

    const cid = generateSequentialThreadId('conn', updatedConnections);
    const conn = {
      id: cid,
      connection_id: cid,
      exploration_id: targetExpId,
      source_node_id: srcId,
      target_node_id: tid,
      relationship_type: relType,
      description: desc,
      metadata: args.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updatedConnections[cid] = conn;
    createdConns.push(conn);
  }

  return {
    success: true,
    connected: true,
    exploration_id: targetExpId,
    source_node_id: srcId,
    count: createdConns.length,
    connections: createdConns,
    updatedConnections,
    updatedNodes,
  };
}
