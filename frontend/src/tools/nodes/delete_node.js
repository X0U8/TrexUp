import { resolveNodeId, getExplorationContext } from './_shared';
import { getSubtreeNodeIds } from '../../utils/treeLayout';

export const DEFINITION = {
  type: 'function',
  name: 'delete_node',
  description:
    'Delete one or more nodes from a specific exploration canvas. Can delete a single node by node_id, multiple nodes by node_ids array, or all nodes by setting node_id: "all" or delete_all: true.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      exploration_id: {
        type: 'string',
        description: 'The unique ID of the exploration canvas containing the node(s).',
      },
      node_id: {
        type: 'string',
        description:
          'The unique ID of the node to delete, or "all" to delete all nodes in this exploration.',
      },
      node_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of node IDs to delete in batch.',
      },
      delete_all: {
        type: 'boolean',
        description: 'Set to true to delete all nodes in this exploration canvas.',
      },
      cascade_connections: {
        type: 'boolean',
        description:
          'Whether to automatically remove all connections linked to this node (default: true).',
      },
    },
    required: ['exploration_id'],
  },
};

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes, updatedConnections } = getExplorationContext(ctx, args);
  let idsToDelete = [];
  const nidStr = (typeof args.node_id === 'string' ? args.node_id : '').trim().toLowerCase();

  if (args.delete_all || nidStr === 'all' || nidStr === '*') {
    idsToDelete = Object.keys(updatedNodes);
  } else if (Array.isArray(args.node_ids) && args.node_ids.length > 0) {
    idsToDelete = args.node_ids.map((nid) => resolveNodeId(updatedNodes, nid)).filter(Boolean);
  } else if (args.node_id) {
    const id = resolveNodeId(updatedNodes, args.node_id);
    if (id && updatedNodes[id]) {
      idsToDelete = [id];
    } else {
      return { error: `Node with id '${args.node_id}' does not exist in exploration '${targetExpId}'.` };
    }
  }

  if (idsToDelete.length === 0) {
    return { error: `No matching nodes found to delete in exploration '${targetExpId}'.` };
  }

  // When deleting a source document or when cascade_tree is true, delete the entire tree rooted at that document
  const allIdsToDelete = new Set();
  for (const id of idsToDelete) {
    allIdsToDelete.add(id);
    const n = updatedNodes[id];
    if (n && (n.category === 'resource' || n.type === 'document' || args.cascade_tree)) {
      const subtree = getSubtreeNodeIds(id, updatedConnections, updatedNodes);
      subtree.forEach((subId) => allIdsToDelete.add(subId));
    }
  }
  idsToDelete = Array.from(allIdsToDelete);

  let removedConnsCount = 0;
  for (const id of idsToDelete) {
    delete updatedNodes[id];

    if (args.cascade_connections !== false) {
      Object.keys(updatedConnections).forEach((cid) => {
        const c = updatedConnections[cid];
        if (c.source_node_id === id || c.target_node_id === id) {
          delete updatedConnections[cid];
          removedConnsCount++;
        }
      });
    }
  }

  return {
    success: true,
    deleted: true,
    exploration_id: targetExpId,
    node_id: idsToDelete.length === 1 ? idsToDelete[0] : undefined,
    node_ids: idsToDelete,
    count: idsToDelete.length,
    removed_connections_count: removedConnsCount,
    updatedNodes,
    updatedConnections,
  };
}
