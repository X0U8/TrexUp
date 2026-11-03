import { getExplorationContext } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'remove_connection',
  description: 'Remove an existing connection by connection_id.',
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
        description: 'The unique ID of the connection to remove.',
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

  delete updatedConnections[cid];
  return {
    success: true,
    deleted: true,
    exploration_id: targetExpId,
    connection_id: cid,
    updatedConnections,
    updatedNodes,
  };
}
