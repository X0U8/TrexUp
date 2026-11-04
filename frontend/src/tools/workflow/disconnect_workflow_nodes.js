import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'disconnect_workflow_nodes',
  description: 'Remove a thread connection between two workflow nodes.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      thread_id: { type: 'string', description: 'Unique identifier of the thread to remove.' },
      from_node: { type: 'string', description: 'Source node ID (used if thread_id not provided).' },
      to_node: { type: 'string', description: 'Target node ID (used if thread_id not provided).' },
    },
    required: ['workflow_id'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const threadId = String(args?.thread_id || '').trim();
  const fromNode = String(args?.from_node || '').trim();
  const toNode = String(args?.to_node || '').trim();

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!threadId && (!fromNode || !toNode)) {
    return { error: 'Must provide either thread_id or both from_node and to_node.' };
  }

  const resolved = resolveWorkflow(ctx, workflowId);
  const threads = resolved.workflowData.threads || [];

  const initialCount = threads.length;
  const filteredThreads = threads.filter((th) => {
    if (threadId && th.id === threadId) return false;
    if (fromNode && toNode && th.from === fromNode && th.to === toNode) return false;
    return true;
  });

  if (filteredThreads.length === initialCount) {
    return { error: 'No matching thread connection found to disconnect.' };
  }

  const updatedWorkflowData = {
    ...resolved.workflowData,
    threads: filteredThreads,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    disconnected: true,
    workflow_id: workflowId,
    removed_count: initialCount - filteredThreads.length,
    updatedWorkflowThreads: filteredThreads,
    updatedWorkflowsData,
  };
}
