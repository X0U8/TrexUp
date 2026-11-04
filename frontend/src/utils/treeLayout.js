/**
 * Tree layout for AI-generated nodes on the exploration canvas.
 *
 * Resources (and any node without `autoLayout`, or that the user dragged: `userMoved`) are
 * anchors and never move. AI-generated nodes (`autoLayout: true`) are arranged to the right of
 * their parent: one column per level, children stacked above and below, parent centered.
 *
 * Pure function: returns a new nodes object; the inputs are not mutated.
 */

const GAP_X = 90;
const GAP_Y = 22;
const FALLBACK_W = 185;
const FALLBACK_H = 30;

/**
 * Computes exact width and height for any canvas node based on its title and type.
 * Synchronized across MovableNode, Thread connections, and layout.
 */
export function getNodeResolvedDimensions(node) {
  if (!node) return { width: 185, height: 30 };

  const isWorkflow =
    node.type === 'engine' ||
    node.type === 'agent' ||
    (node.type === 'input' && !node.category) ||
    (node.type === 'output' && !node.category) ||
    Boolean(node.engineId) ||
    Boolean(node.modelId);

  if (isWorkflow) {
    return {
      width: typeof node.width === 'number' && !Number.isNaN(node.width) ? node.width : 185,
      height: 56,
    };
  }

  const isDoc =
    node.category === 'resource' ||
    node.type === 'document' ||
    node.type === 'resource' ||
    Boolean(node.cloudinaryUrl) ||
    Boolean(node.fileSize);

  if (isDoc) {
    return { width: 280, height: 60 };
  }

  const rawTitle = (node.title || node.name || 'Node').replace(/\.node$/i, '');
  const type = node.type || 'finding';

  const isTopic = type === 'topic';
  const charWidth = isTopic ? 7.2 : 6.6;
  const padding = 34; // comfortable clearance from left & right port dots
  const contentWidth = Math.ceil(rawTitle.length * charWidth) + padding;

  const minW = isTopic ? 170 : 150;
  const maxW = isTopic ? 320 : 300;
  const resolvedWidth = Math.max(minW, Math.min(contentWidth, maxW));
  const resolvedHeight = isTopic ? 34 : 28;

  return { width: resolvedWidth, height: resolvedHeight };
}

const widthOf = (n) => (n ? getNodeResolvedDimensions(n).width : FALLBACK_W);
const heightOf = (n) => (n ? getNodeResolvedDimensions(n).height : FALLBACK_H);
const isMovable = (n) => Boolean(n) && n.autoLayout === true && n.userMoved !== true;

export function layoutAutoNodes(nodes, connections) {
  const ids = Object.keys(nodes || {});
  if (ids.length === 0) return nodes;

  const edges = Object.values(connections || {}).filter(
    (c) => c && nodes[c.source_node_id] && nodes[c.target_node_id] && c.source_node_id !== c.target_node_id
  );
  const outgoing = {};
  const hasIncoming = new Set();
  for (const e of edges) {
    (outgoing[e.source_node_id] ||= []).push(e.target_node_id);
    hasIncoming.add(e.target_node_id);
  }

  // Breadth-first from the roots: a node is placed under the first (shallowest) parent that reaches it.
  const roots = ids.filter((id) => !isMovable(nodes[id]) || !hasIncoming.has(id));
  const children = {};
  const visited = new Set(roots);
  const queue = [...roots];
  while (queue.length) {
    const u = queue.shift();
    for (const v of outgoing[u] || []) {
      if (visited.has(v)) continue;
      visited.add(v);
      (children[u] ||= []).push(v);
      queue.push(v);
    }
  }

  const movableKids = (id) => (children[id] || []).filter((c) => isMovable(nodes[c]));

  // Height of the block a node's subtree needs.
  const blockHeight = {};
  const measure = (id) => {
    const kids = movableKids(id);
    const kidsTotal = kids.reduce((sum, k) => sum + measure(k), 0) + GAP_Y * Math.max(kids.length - 1, 0);
    blockHeight[id] = Math.max(heightOf(nodes[id]), kidsTotal);
    return blockHeight[id];
  };

  const next = { ...nodes };
  const place = (id) => {
    const parent = next[id];
    const kids = movableKids(id);
    if (kids.length > 0) {
      const total = kids.reduce((sum, k) => sum + blockHeight[k], 0) + GAP_Y * (kids.length - 1);
      const centerY = parent.y + heightOf(parent) / 2;
      const x = parent.x + widthOf(parent) + GAP_X;
      let top = centerY - total / 2;
      for (const k of kids) {
        const child = next[k];
        next[k] = {
          ...child,
          x: Math.round(x),
          y: Math.round(top + (blockHeight[k] - heightOf(child)) / 2),
          width: widthOf(child),
          height: heightOf(child),
        };
        top += blockHeight[k] + GAP_Y;
        place(k);
      }
    }
    // Pinned children keep their position but still anchor their own AI-generated descendants.
    for (const c of children[id] || []) {
      if (!isMovable(nodes[c])) place(c);
    }
  };

  // Measure every subtree hanging off a root, then place from the roots down.
  for (const r of roots) measure(r);
  for (const r of roots) place(r);

  return next;
}

/**
 * Traverses connections to find all nodes in the connected tree rooted at rootId,
 * including topics, subtopics, findings, and claims, without crossing into other resource roots.
 */
export function getSubtreeNodeIds(rootId, arg2, arg3) {
  if (!rootId) return new Set();

  // Support both (rootId, connections, nodes) and (rootId, nodes, connections)
  let connections = arg2;
  let nodes = arg3 || {};

  const v2 = Object.values(arg2 || {})[0];
  const v3 = Object.values(arg3 || {})[0];
  if (v2 && (v2.x !== undefined || v2.title !== undefined || v2.name !== undefined) && !v2.source_node_id && !v2.source) {
    // arg2 is nodes, arg3 is connections
    nodes = arg2 || {};
    connections = arg3 || {};
  } else if (v3 && (v3.source_node_id || v3.source || v3.startNodeId)) {
    connections = arg3 || {};
    nodes = arg2 || {};
  }

  const result = new Set([rootId]);
  const queue = [rootId];

  // Build directed parent -> child mapping
  const children = {};
  for (const c of Object.values(connections || {})) {
    if (!c) continue;
    const src = c.source_node_id || c.source || c.startNodeId;
    const tgt = c.target_node_id || c.target || c.endNodeId;
    if (!src || !tgt || src === tgt) continue;

    const srcNode = nodes[src];
    const tgtNode = nodes[tgt];

    const isSrcResource =
      srcNode?.category === 'resource' ||
      srcNode?.type === 'document' ||
      srcNode?.type === 'resource' ||
      Boolean(srcNode?.cloudinaryUrl) ||
      Boolean(srcNode?.fileSize);

    const isTgtResource =
      tgtNode?.category === 'resource' ||
      tgtNode?.type === 'document' ||
      tgtNode?.type === 'resource' ||
      Boolean(tgtNode?.cloudinaryUrl) ||
      Boolean(tgtNode?.fileSize);

    let parent = src;
    let child = tgt;

    // If one is resource and other is not, resource is strictly the parent
    if (isTgtResource && !isSrcResource) {
      parent = tgt;
      child = src;
    } else if (!isSrcResource && !isTgtResource && srcNode && tgtNode) {
      // If src is clearly to the right of tgt, connection was drawn right-to-left
      if (typeof srcNode.x === 'number' && typeof tgtNode.x === 'number' && srcNode.x > tgtNode.x + 50) {
        parent = tgt;
        child = src;
      }
    }

    (children[parent] ||= []).push(child);
  }

  while (queue.length > 0) {
    const curr = queue.shift();
    const kids = children[curr] || [];
    for (const kid of kids) {
      if (!result.has(kid)) {
        result.add(kid);
        queue.push(kid);
      }
    }
  }

  return result;
}
