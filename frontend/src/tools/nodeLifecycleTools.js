/**
 * Node Lifecycle Tools for the Exploration Canvas
 * Mirroring the exact Meta project tool schema and contract with exploration_id support.
 */

export const NODE_TYPES = [
  'topic',
  'subtopic',
  'claim',
  'hypothesis',
  'finding',
  'evidence',
  'document',
  'open_question',
];

export const NODE_STATUSES = [
  'proposed',
  'under_review',
  'verified',
  'contradicted',
  'unresolved',
];

export const LIST_EXPLORATIONS_DEFINITION = {
  type: 'function',
  name: 'list_explorations',
  description:
    'List all exploration canvases available in the workspace. Returns exploration IDs, names, descriptions, and node counts.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};

export const SEARCH_NODES_DEFINITION = {
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

export const CREATE_NODE_DEFINITION = {
  type: 'function',
  name: 'create_node',
  description:
    'Create a new topic, subtopic, claim, hypothesis, finding, evidence, or document node in a specific exploration canvas. The exploration_id, title, and description are required.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      exploration_id: {
        type: 'string',
        description:
          "The unique ID of the exploration canvas to create this node in (e.g. 'exploration_01', 'exp_01').",
      },
      title: {
        type: 'string',
        description:
          "Short, clear title summarizing the node (e.g. 'Chamber Seal Failure at 420K').",
      },
      description: {
        type: 'string',
        description: 'Detailed explanation of the observation, claim, or hypothesis.',
      },
      node_type: {
        type: 'string',
        enum: NODE_TYPES,
        description: 'The category/type of the node.',
      },
      status: {
        type: 'string',
        enum: NODE_STATUSES,
        description: "Initial status of the node (defaults to 'proposed').",
      },
      metadata: {
        type: 'object',
        description: 'Optional arbitrary metadata (e.g. source document, page, tags).',
      },
    },
    required: ['exploration_id', 'title', 'description', 'node_type'],
  },
};

export const GET_NODE_DEFINITION = {
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

export const UPDATE_NODE_DEFINITION = {
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

export const UPDATE_NODE_STATUS_DEFINITION = {
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

export const DELETE_NODE_DEFINITION = {
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

export const RELATIONSHIP_TYPES = [
  'supports',
  'refutes',
  'caused_by',
  'related_to',
  'derives_from',
  'evidences',
  'depends_on',
  'contradicts',
];

export const CONNECT_NODES_DEFINITION = {
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

export const GET_CONNECTIONS_DEFINITION = {
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

export const UPDATE_CONNECTION_DEFINITION = {
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

export const REMOVE_CONNECTION_DEFINITION = {
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

export const NODE_LIFECYCLE_DEFINITIONS = [
  LIST_EXPLORATIONS_DEFINITION,
  SEARCH_NODES_DEFINITION,
  CREATE_NODE_DEFINITION,
  GET_NODE_DEFINITION,
  UPDATE_NODE_DEFINITION,
  UPDATE_NODE_STATUS_DEFINITION,
  DELETE_NODE_DEFINITION,
  CONNECT_NODES_DEFINITION,
  GET_CONNECTIONS_DEFINITION,
  UPDATE_CONNECTION_DEFINITION,
  REMOVE_CONNECTION_DEFINITION,
];

/**
 * Executes a node tool against the active exploration nodes collection or multi-exploration dataset
 */
export function executeNodeTool(explorationsData, activeExpId, toolName, args) {
  const targetExpId = args.exploration_id || activeExpId;
  const currentExp = explorationsData[targetExpId] || { nodes: {}, connections: {} };
  const updatedNodes = { ...(currentExp.nodes || {}) };
  const updatedConnections = { ...(currentExp.connections || {}) };

  switch (toolName) {
    case 'list_explorations': {
      const list = Object.keys(explorationsData).map((id) => ({
        exploration_id: id,
        name: id,
        node_count: Object.keys(explorationsData[id]?.nodes || {}).length,
      }));
      return { success: true, explorations: list };
    }

    case 'search_nodes':
    case 'search_investigation': {
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

    case 'create_node': {
      const title = (args.title || '').trim();
      const description = (args.description || '').trim();
      const nodeType = args.node_type || 'finding';
      const status = args.status || 'proposed';

      if (!title) return { error: 'title cannot be empty' };
      if (!description) return { error: 'description cannot be empty' };

      const prefixMap = {
        hypothesis: 'hypo',
        finding: 'find',
        claim: 'claim',
        topic: 'topic',
        subtopic: 'subtopic',
        evidence: 'evid',
        document: 'doc',
        open_question: 'quest',
      };
      const prefix = prefixMap[nodeType] || 'node';
      const shortId = Math.random().toString(36).substring(2, 8);
      const id = `node_${prefix}_${shortId}`;

      const isDoc = nodeType === 'document';
      const cleanTitle = title.replace(/\.node$/i, '');

      const newNode = {
        id,
        node_id: id,
        exploration_id: targetExpId,
        name: cleanTitle,
        title: cleanTitle,
        description,
        type: nodeType,
        category: isDoc ? 'resource' : 'info',
        status,
        x: args.x !== undefined ? args.x : 200 + Math.random() * 200,
        y: args.y !== undefined ? args.y : 150 + Math.random() * 150,
        width: 280,
        height: 72,
        metadata: args.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      updatedNodes[id] = newNode;
      return {
        success: true,
        created: true,
        exploration_id: targetExpId,
        node: newNode,
        updatedNodes,
      };
    }

function resolveNodeId(updatedNodes, idOrQuery) {
  if (!idOrQuery) return null;
  const raw = String(idOrQuery).trim();
  if (updatedNodes[raw]) return raw;

  const clean = raw
    .toLowerCase()
    .replace(/\.node$/i, '')
    .replace(/^the\s+/i, '')
    .replace(/\s+node$/i, '')
    .trim();

  for (const [key, n] of Object.entries(updatedNodes)) {
    const title = (n.title || '').toLowerCase().replace(/\.node$/i, '').trim();
    const name = (n.name || '').toLowerCase().replace(/\.node$/i, '').trim();
    if (title === clean || name === clean || key.toLowerCase() === clean) {
      return key;
    }
  }

  for (const [key, n] of Object.entries(updatedNodes)) {
    const title = (n.title || '').toLowerCase();
    const name = (n.name || '').toLowerCase();
    if (title.includes(clean) || name.includes(clean) || clean.includes(title)) {
      return key;
    }
  }

  return raw;
}

    case 'get_node': {
      const id = resolveNodeId(updatedNodes, args.node_id);
      if (!id || !updatedNodes[id]) {
        return { error: `Node with id '${args.node_id}' does not exist in exploration '${targetExpId}'.` };
      }
      return { success: true, exploration_id: targetExpId, node: updatedNodes[id] };
    }

    case 'update_node': {
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

    case 'update_node_status': {
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

    case 'delete_node': {
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

      let removedConnsCount = 0;
      for (const id of idsToDelete) {
        delete updatedNodes[id];

        // Cascade delete connections attached to this node
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

    case 'connect_nodes': {
      const srcId = resolveNodeId(updatedNodes, args.source_node_id);
      if (!srcId || !updatedNodes[srcId]) {
        return { error: `Source node '${args.source_node_id}' does not exist in exploration '${targetExpId}'.` };
      }

      const desc = (args.description || '').trim();
      if (!desc) {
        return { error: 'description is required: you must explain the reasoning for connecting these nodes.' };
      }

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

        // Avoid exact duplicate connection
        const exists = Object.values(updatedConnections).some(
          (c) => c.source_node_id === srcId && c.target_node_id === tid
        );
        if (exists) continue;

        const cid = `conn_${Math.random().toString(36).substring(2, 8)}`;
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

    case 'get_connections': {
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

    case 'update_connection': {
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

    case 'remove_connection': {
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

    default:
      return { error: `Unknown tool: '${toolName}'` };
  }
}
