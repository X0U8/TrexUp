import { NODE_TYPES, NODE_STATUSES, getExplorationContext } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'search_nodes',
  description:
    'Search for existing nodes in a specific exploration canvas by title keyword, id, or node type. Returns matching node IDs and details. Always use this to discover node IDs before updating, connecting, or inspecting nodes.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      exploration_id: {
        type: 'string',
        description: 'The unique ID of the exploration canvas to search in (e.g. "exploration_01").',
      },
      query: {
        type: 'string',
        description:
          'Optional keyword or title to search for (e.g. "test", "friction", "node_find"). If omitted, returns all nodes in the exploration.',
      },
      node_type: {
        type: 'string',
        enum: NODE_TYPES,
        description: 'Optional filter by node type.',
      },
      status: {
        type: 'string',
        enum: NODE_STATUSES,
        description: 'Optional filter by verification status.',
      },
    },
    required: ['exploration_id'],
  },
};

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes } = getExplorationContext(ctx, args);
  const q = (args.query || '').trim().toLowerCase();
  const nodeType = args.node_type;
  const status = args.status;

  const matches = Object.values(updatedNodes).filter((n) => {
    if (nodeType && n.type !== nodeType) return false;
    if (status && n.status !== status) return false;
    if (q) {
      const title = (n.title || '').toLowerCase();
      const name = (n.name || '').toLowerCase();
      const desc = (n.description || '').toLowerCase();
      const id = (n.id || '').toLowerCase();
      return title.includes(q) || name.includes(q) || desc.includes(q) || id.includes(q);
    }
    return true;
  });

  return {
    success: true,
    searched: true,
    exploration_id: targetExpId,
    query: args.query || '',
    count: matches.length,
    nodes: matches.map((n) => ({
      id: n.id,
      node_id: n.id,
      title: n.title || n.name,
      type: n.type,
      status: n.status,
      description: n.description || '',
    })),
  };
}
