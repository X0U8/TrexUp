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
      node_id: {
        type: 'string',
        description: 'Optional custom unique node ID (e.g. topic_01, finding_01).',
      },
      connect_to_source_id: {
        type: 'string',
        description: 'Optional ID of an existing node (e.g. source document node ID) to automatically connect this new node to.',
      },
      relationship_type: {
        type: 'string',
        enum: RELATIONSHIP_TYPES,
        description: 'Optional relationship type when connect_to_source_id is provided (default: "derives_from").',
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

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes, updatedConnections } = getExplorationContext(ctx, args);
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
  const prefix = prefixMap[nodeType] || nodeType || 'node';
  let id = (args.node_id || args.id || '').trim();
  if (!id || updatedNodes[id]) {
    id = generateSequentialNodeId(prefix, updatedNodes);
  }

  const isDoc = nodeType === 'document';
  const cleanTitle = title.replace(/\.node$/i, '');

  const connectSrcRaw = args.connect_to_source_id || args.source_node_id || args.connect_to_node_id;
  const srcId = connectSrcRaw ? resolveNodeId(updatedNodes, connectSrcRaw) : null;
  const srcNode = srcId && updatedNodes[srcId] ? updatedNodes[srcId] : null;

  let spawnX = args.x;
  let spawnY = args.y;

  if (spawnX === undefined || spawnY === undefined) {
    if (srcNode) {
      const existingConns = Object.values(updatedConnections).filter(
        (c) => c.source_node_id === srcId || c.target_node_id === srcId
      );
      const childIdx = existingConns.length;

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

      const slot = fanSlots[childIdx % fanSlots.length];
      const cycle = Math.floor(childIdx / fanSlots.length);
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
    metadata: args.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  updatedNodes[id] = newNode;

  if (srcId && srcNode && srcId !== id) {
    const cid = generateSequentialThreadId('conn', updatedConnections);
    const relType = args.relationship_type || 'derives_from';
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
  }

  return {
    success: true,
    created: true,
    exploration_id: targetExpId,
    node: newNode,
    updatedNodes,
    updatedConnections,
  };
}
