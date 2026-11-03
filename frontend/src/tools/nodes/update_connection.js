import { RELATIONSHIP_TYPES, getExplorationContext } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'update_connection',
  description:
    "Modify an existing connection's relationship type or justification description.",
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      exploration_id: {
        type: 'string',
        description: 'The unique ID of the exploration canvas.',
      },
      connection_id: {
        type: 'string',
        description: 'The unique ID of the connection to update.',
      },
      relationship_type: {
        type: 'string',
        enum: RELATIONSHIP_TYPES,
        description: 'New relationship type.',
      },
      description: {
        type: 'string',
        description: 'Updated reasoning description.',
      },
    },
    required: ['exploration_id', 'connection_id'],
  },
};

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes, updatedConnections } = getExplorationContext(ctx, args);
  const cid = (args.connection_id || '').trim();
  if (!cid || !updatedConnections[cid]) {
    return { error: `Connection '${cid}' does not exist in exploration '${targetExpId}'.` };
  }

  const conn = { ...updatedConnections[cid] };
  if (args.relationship_type) conn.relationship_type = args.relationship_type.trim();
  if (args.description) conn.description = args.description.trim();
  if (args.metadata) conn.metadata = { ...(conn.metadata || {}), ...args.metadata };
  conn.updatedAt = new Date().toISOString();

  updatedConnections[cid] = conn;
  return {
    success: true,
    updated: true,
    exploration_id: targetExpId,
    connection: conn,
    updatedConnections,
    updatedNodes,
  };
}
