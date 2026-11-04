import { getExplorationContext } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'canvas_outline',
  description:
    'Show the canvas as a text tree: each resource at the root, its children indented beneath it, with node IDs, types and statuses. Also lists orphan nodes (no connection), counts by type and structural problems. Call it once to see what exists, and again after your changes to check the result.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      exploration_id: {
        type: 'string',
        description: 'Canvas to outline. Defaults to the active exploration.',
      },
    },
  },
};

const isResource = (n) =>
  n.category === 'resource' || n.type === 'document' || n.type === 'resource';

export function run(ctx, args = {}) {
  const { targetExpId, updatedNodes, updatedConnections } = getExplorationContext(ctx, args);
  const nodes = updatedNodes;
  const ids = Object.keys(nodes);

  if (ids.length === 0) {
    return {
      success: true,
      exploration_id: targetExpId,
      outline: '(canvas is empty)',
      counts: {},
      orphans: [],
      problems: ['Canvas is empty.'],
    };
  }

  const children = {};
  const hasParent = new Set();
  for (const c of Object.values(updatedConnections || {})) {
    if (!c || !nodes[c.source_node_id] || !nodes[c.target_node_id]) continue;
    if (c.source_node_id === c.target_node_id) continue;
    (children[c.source_node_id] ||= []).push(c.target_node_id);
    hasParent.add(c.target_node_id);
  }

  const roots = ids.filter((id) => isResource(nodes[id]));
  const otherRoots = ids.filter(
    (id) => !hasParent.has(id) && !roots.includes(id) && (children[id] || []).length > 0
  );

  const seen = new Set();
  const lines = [];
  const render = (id, depth) => {
    if (seen.has(id)) {
      lines.push(`${'  '.repeat(depth)}└─ [${id}] (already shown)`);
      return;
    }
    seen.add(id);
    const n = nodes[id];
    const title = (n.title || n.name || id).replace(/\.node$/i, '');
    const type = isResource(n) ? 'resource' : n.type || 'node';
    const prefix = depth === 0 ? '' : `${'  '.repeat(depth - 1)}└─ `;
    lines.push(`${prefix}[${id}] ${title} (${type}, ${n.status || 'no status'})`);
    for (const child of children[id] || []) render(child, depth + 1);
  };
  [...roots, ...otherRoots].forEach((id) => render(id, 0));

  const orphans = ids.filter((id) => !seen.has(id));
  orphans.forEach((id) => {
    const n = nodes[id];
    lines.push(`(not connected) [${id}] ${n.title || id} (${n.type || 'node'})`);
  });

  const counts = {};
  ids.forEach((id) => {
    const t = isResource(nodes[id]) ? 'resource' : nodes[id].type || 'node';
    counts[t] = (counts[t] || 0) + 1;
  });

  const problems = [];
  if (roots.length === 0) problems.push('No resource (source document) node on the canvas.');
  if (orphans.length > 0) problems.push(`${orphans.length} node(s) not connected to anything.`);
  ids
    .filter((id) => nodes[id].type === 'topic')
    .forEach((id) => {
      const kids = children[id] || [];
      if (!kids.some((k) => ['finding', 'evidence'].includes(nodes[k].type))) {
        problems.push(`Topic [${id}] "${nodes[id].title || id}" has no finding or evidence under it.`);
      }
    });

  return {
    success: true,
    exploration_id: targetExpId,
    outline: lines.join('\n'),
    counts,
    orphans,
    problems,
  };
}
