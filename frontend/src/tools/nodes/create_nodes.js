import {
  NODE_TYPES,
  NODE_STATUSES,
  RELATIONSHIP_TYPES,
  getNodeDefaultDimensions,
  resolveNodeId,
  generateSequentialNodeId,
  generateSequentialThreadId,
  getExplorationContext,
} from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'create_nodes',
  description:
    'Create multiple topic, subtopic, claim, hypothesis, finding, evidence, or document nodes simultaneously on a specific exploration canvas in a single batch operation. Automatically organizes and fans out nodes cleanly on the canvas without overlaps.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      exploration_id: {
        type: 'string',
        description: 'The unique ID of the exploration canvas to create these nodes in (e.g. "exploration_01").',
      },
      connect_to_source_id: {
        type: 'string',
        description: 'Optional default source node ID (e.g. the source document node ID) to connect all created nodes to.',
      },
      nodes: {
        type: 'array',
        description: 'The list of node objects to create in batch.',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Short, clear title summarizing the node.',
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
            node_id: {
              type: 'string',
              description: 'Optional custom unique node ID (e.g. topic_01, finding_01).',
            },
            connect_to_source_id: {
              type: 'string',
              description: 'Optional ID of an existing node (e.g. source document node ID or parent topic) to connect this node to.',
            },
            relationship_type: {
              type: 'string',
              enum: RELATIONSHIP_TYPES,
              description: 'Optional relationship type (default: "derives_from").',
            },
            status: {
              type: 'string',
              enum: NODE_STATUSES,
              description: 'Initial status of the node (defaults to "proposed").',
            },
            metadata: {
              type: 'object',
              description: 'Optional arbitrary metadata.',
            },
          },
          required: ['title', 'description', 'node_type'],
        },
      },
    },
    required: ['exploration_id', 'nodes'],
  },
};

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes, updatedConnections } = getExplorationContext(ctx, args);
  const rawNodes = Array.isArray(args.nodes) ? args.nodes : [];
  if (rawNodes.length === 0) {
    return { error: 'nodes array cannot be empty' };
  }

  const createdNodes = [];
  const createdConns = [];

  for (let i = 0; i < rawNodes.length; i++) {
    const item = rawNodes[i];
    const title = (item.title || '').trim();
    const description = (item.description || '').trim();
    const nodeType = item.node_type || 'finding';
    const status = item.status || 'proposed';

    if (!title || !description) continue;

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
    const prefix = prefixMap[nodeType] || nodeType || 'node';
    let id = (item.node_id || item.id || '').trim();
    if (!id || updatedNodes[id]) {
      id = generateSequentialNodeId(prefix, updatedNodes);
    }

    const isDoc = nodeType === 'document';
    const cleanTitle = title.replace(/\.node$/i, '');

    const connectSrcRaw =
      item.connect_to_source_id ||
      item.source_node_id ||
      item.connect_to_node_id ||
      args.connect_to_source_id;
    const srcId = connectSrcRaw ? resolveNodeId(updatedNodes, connectSrcRaw) : null;
    const srcNode = srcId && updatedNodes[srcId] ? updatedNodes[srcId] : null;

    let spawnX = item.x;
    let spawnY = item.y;

    if (spawnX === undefined || spawnY === undefined) {
      if (srcNode) {
        const fanSlots = [
          { dx: 360, dy: -60 },
          { dx: 360, dy: 80 },
          { dx: 190, dy: -200 },
          { dx: -190, dy: -200 },
          { dx: -360, dy: -60 },
          { dx: -360, dy: 80 },
          { dx: -190, dy: 220 },
          { dx: 190, dy: 220 },
          { dx: 720, dy: -130 },
          { dx: 720, dy: 0 },
          { dx: 720, dy: 130 },
          { dx: 1080, dy: -70 },
          { dx: 1080, dy: 70 },
          { dx: 720, dy: -250 },
          { dx: 720, dy: 250 },
        ];

        const existingCount = Object.values(updatedConnections).filter(
          (c) => c.source_node_id === srcId || c.target_node_id === srcId
        ).length;
        const slotIdx = existingCount;
        const slot = fanSlots[slotIdx % fanSlots.length];
        const cycle = Math.floor(slotIdx / fanSlots.length);
        const cycleOffset = cycle * 60;

        spawnX = Math.round(srcNode.x + slot.dx + cycleOffset);
        spawnY = Math.round(srcNode.y + slot.dy + (cycle % 2 === 0 ? cycleOffset : -cycleOffset));
      } else {
        const nodeCount = Object.keys(updatedNodes).length;
        const col = Math.floor(nodeCount / 5);
        const row = nodeCount % 5;
        spawnX = 300 + col * 340;
        spawnY = 150 + row * 110;
      }

      let attempts = 0;
      while (attempts < 20) {
        const collides = Object.values(updatedNodes).some((n) => {
          if (!n || n.x === undefined || n.y === undefined) return false;
          return Math.abs(n.x - spawnX) < 290 && Math.abs(n.y - spawnY) < 85;
        });
        if (!collides) break;
        spawnY += 95;
        attempts++;
      }
    }

    const dims = getNodeDefaultDimensions(nodeType, isDoc);
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
      x: spawnX,
      y: spawnY,
      width: dims.width,
      height: dims.height,
      metadata: item.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updatedNodes[id] = newNode;
    createdNodes.push(newNode);

    if (srcId && srcNode && srcId !== id) {
      const cid = generateSequentialThreadId('conn', updatedConnections);
      const relType = item.relationship_type || 'derives_from';
      const conn = {
        id: cid,
        connection_id: cid,
        exploration_id: targetExpId,
        source_node_id: srcId,
        target_node_id: id,
        relationship_type: relType,
        description: `Derived from source ${srcNode.title || srcId}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedConnections[cid] = conn;
      createdConns.push(conn);
    }
  }

  return {
    success: true,
    created: true,
    batch: true,
    exploration_id: targetExpId,
    count: createdNodes.length,
    nodes: createdNodes,
    connections: createdConns,
    updatedNodes,
    updatedConnections,
  };
}
