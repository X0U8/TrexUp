/**
 * Deterministic, collision-free Node UID generator.
 * Implements Option 1: Sequential Semantic UIDs (e.g. agent_1, agent_2, engine_1).
 */

export function generateSequentialNodeId(prefix = 'node', existingNodes = {}) {
  const taken = new Set();
  
  if (existingNodes && typeof existingNodes === 'object') {
    Object.entries(existingNodes).forEach(([key, node]) => {
      taken.add(String(key).toLowerCase());
      if (node?.id) {
        taken.add(String(node.id).toLowerCase());
      }
    });
  }

  const cleanPrefix = String(prefix || 'node').toLowerCase().trim();
  let index = 1;
  while (taken.has(`${cleanPrefix}_${index}`)) {
    index++;
  }
  return `${cleanPrefix}_${index}`;
}

/**
 * Safely allocates sequential collision-free IDs for an array of nodes created in a single batch (e.g. by AI).
 * Guarantees zero collisions even when multiple nodes of the same type are placed simultaneously.
 */
export function batchGenerateNodeIds(nodeItems = [], existingNodes = {}) {
  const accumulated = { ...(existingNodes || {}) };
  return nodeItems.map((item) => {
    const prefix = item.type || item.prefix || 'node';
    const id = generateSequentialNodeId(prefix, accumulated);
    const assignedNode = { ...item, id };
    accumulated[id] = assignedNode;
    return assignedNode;
  });
}

/**
 * Sequential Thread / Connection UID generator (e.g. th_1, th_2, conn_1, conn_2).
 */
export function generateSequentialThreadId(prefix = 'th', existingThreads = []) {
  const taken = new Set();
  if (Array.isArray(existingThreads)) {
    existingThreads.forEach((t) => {
      if (t?.id) taken.add(String(t.id).toLowerCase());
      if (t?.connection_id) taken.add(String(t.connection_id).toLowerCase());
    });
  } else if (existingThreads && typeof existingThreads === 'object') {
    Object.entries(existingThreads).forEach(([key, t]) => {
      taken.add(String(key).toLowerCase());
      if (t?.id) taken.add(String(t.id).toLowerCase());
      if (t?.connection_id) taken.add(String(t.connection_id).toLowerCase());
    });
  }

  const cleanPrefix = String(prefix || 'th').toLowerCase().trim();
  let index = 1;
  while (taken.has(`${cleanPrefix}_${index}`)) {
    index++;
  }
  return `${cleanPrefix}_${index}`;
}
