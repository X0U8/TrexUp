import { resolveNodeId, getExplorationContext } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'update_node',
  description:
    "Modify an existing node's title, description, or metadata within a specified exploration canvas.",
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
        description: 'The unique ID of the node to update.',
      },
      title: {
        type: 'string',
        description: 'New title for the node (optional).',
      },
      description: {
        type: 'string',
        description: 'New detailed description for the node (optional).',
      },
      metadata: {
        type: 'object',
        description: 'Additional or updated metadata to merge into the node (optional).',
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

  const node = { ...updatedNodes[id] };
  if (args.title !== undefined) {
    node.title = args.title.trim().replace(/\.node$/i, '');
    node.name = node.title;
  }
  if (args.description !== undefined) {
    node.description = args.description.trim();
  }
  if (args.metadata) {
    node.metadata = { ...(node.metadata || {}), ...args.metadata };
  }
  node.updatedAt = new Date().toISOString();

  updatedNodes[id] = node;
  return { success: true, updated: true, exploration_id: targetExpId, node, updatedNodes };
}
