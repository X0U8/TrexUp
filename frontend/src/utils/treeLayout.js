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
const FALLBACK_H = 42;

const widthOf = (n) => n.width || FALLBACK_W;
const heightOf = (n) => n.height || FALLBACK_H;
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
        next[k] = { ...child, x: Math.round(x), y: Math.round(top + (blockHeight[k] - heightOf(child)) / 2) };
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
export function getSubtreeNodeIds(rootId, connections, nodes = {}) {
  if (!rootId) return new Set();
  const result = new Set([rootId]);
  const queue = [rootId];

  const adj = {};
  for (const c of Object.values(connections || {})) {
    if (!c || !c.source_node_id || !c.target_node_id) continue;
    (adj[c.source_node_id] ||= []).push(c.target_node_id);
    (adj[c.target_node_id] ||= []).push(c.source_node_id);
  }

  const isOtherResource = (id) => {
    if (id === rootId) return false;
    const n = nodes[id];
    if (!n) return false;
    return (
      n.category === 'resource' ||
      n.type === 'document' ||
      n.type === 'resource' ||
      Boolean(n.cloudinaryUrl) ||
      Boolean(n.fileSize)
    );
  };

  while (queue.length > 0) {
    const curr = queue.shift();
    const neighbors = adj[curr] || [];
    for (const neighborId of neighbors) {
      if (!result.has(neighborId) && !isOtherResource(neighborId)) {
        result.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return result;
}
