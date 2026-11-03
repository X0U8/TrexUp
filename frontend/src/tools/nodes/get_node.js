import { resolveNodeId, getExplorationContext } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'get_node',
  description:
    'Retrieve an existing node by its unique node_id from a specified exploration canvas.',
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
        description: "The unique ID of the node to retrieve (e.g. 'node_find_4a2c').",
      },
    },
    required: ['exploration_id', 'node_id'],
  },
};

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes } = getExplorationContext(ctx, args);
  const id = resolveNodeId(updatedNodes, args.node_id);
  if (!id || !updatedNodes[id]) {
    return { error: `Node with id '${args.node_id}' does not exist in exploration '${targetExpId}'.` };
  }
  return { success: true, exploration_id: targetExpId, node: updatedNodes[id] };
}
