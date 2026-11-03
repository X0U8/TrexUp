import { generateSequentialNodeId, generateSequentialThreadId } from '../../utils/nodeIdUtils';

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

export function getNodeDefaultDimensions(type, isDoc) {
  if (isDoc || type === 'document' || type === 'resource') {
    return { width: 275, height: 68 };
  }
  if (type === 'topic') {
    return { width: 190, height: 44 };
  }
  if (type === 'subtopic') {
    return { width: 150, height: 36 };
  }
  if (type === 'evidence') {
    return { width: 170, height: 40 };
  }
  if (type === 'claim') {
    return { width: 185, height: 42 };
  }
  if (type === 'hypothesis' || type === 'finding') {
    return { width: 185, height: 42 };
  }
  return { width: 185, height: 42 };
}

export function resolveNodeId(updatedNodes, idOrQuery) {
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

export function getExplorationContext(ctx, args) {
  const explorationsData = ctx.explorationsData || ctx.explorations || ctx;
  const activeExpId = ctx.activeExpId || args.exploration_id;
  const targetExpId = args.exploration_id || activeExpId;
  const currentExp = explorationsData[targetExpId] || { nodes: {}, connections: {} };
  const updatedNodes = { ...(currentExp.nodes || {}) };
  const updatedConnections = { ...(currentExp.connections || {}) };

  return {
    explorationsData,
    targetExpId,
    updatedNodes,
    updatedConnections,
  };
}

export { generateSequentialNodeId, generateSequentialThreadId };
