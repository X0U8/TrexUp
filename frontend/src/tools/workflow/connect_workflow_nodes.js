import { resolveWorkflow, generateNextThreadId } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'connect_workflow_nodes',
  description: 'Create a directed thread connection between a source node and a target node.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      from_node: { type: 'string', description: 'Source node ID.' },
      to_node: { type: 'string', description: 'Target node ID.' },
      condition: { type: 'string', description: 'Optional conditional routing expression.' },
    },
    required: ['workflow_id', 'from_node', 'to_node'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const fromNode = String(args?.from_node || '').trim();
  const toNode = String(args?.to_node || '').trim();
  const condition = typeof args?.condition === 'string' ? args.condition.trim() : '';

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!fromNode) return { error: 'from_node is required' };
  if (!toNode) return { error: 'to_node is required' };
  if (fromNode === toNode) return { error: 'Cannot connect a node to itself' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = resolved.workflowData.nodes || {};

  if (!nodes[fromNode]) return { error: `Source node "${fromNode}" does not exist in workflow "${workflowId}".` };
  if (!nodes[toNode]) return { error: `Target node "${toNode}" does not exist in workflow "${workflowId}".` };

  const threads = [...(resolved.workflowData.threads || [])];

  // Check if identical connection already exists
  const exists = threads.some((t) => t.from === fromNode && t.to === toNode);
  if (exists) {
    return { error: `Thread connection from "${fromNode}" to "${toNode}" already exists.` };
  }

  const threadId = generateNextThreadId(threads);
  const newThread = {
    id: threadId,
    from: fromNode,
    to: toNode,
    condition,
  };

  threads.push(newThread);

  const updatedWorkflowData = {
    ...resolved.workflowData,
    threads,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    connected: true,
    workflow_id: workflowId,
    thread: newThread,
    updatedWorkflowThreads: threads,
    updatedWorkflowsData,
  };
}
