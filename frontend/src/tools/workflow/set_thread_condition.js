import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'set_thread_condition',
  description: 'Attach or update conditional routing rules on a thread to control branch execution.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      thread_id: { type: 'string', description: 'ID of the thread.' },
      condition: { type: 'string', description: 'Condition string (e.g. "category == \'image\'").' },
    },
    required: ['workflow_id', 'thread_id', 'condition'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const threadId = String(args?.thread_id || '').trim();
  const condition = String(args?.condition || '').trim();

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!threadId) return { error: 'thread_id is required' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const threads = [...(resolved.workflowData.threads || [])];
  const targetIndex = threads.findIndex((t) => t.id === threadId);

  if (targetIndex === -1) {
    return { error: `Thread "${threadId}" not found in workflow "${workflowId}".` };
  }

  threads[targetIndex] = {
    ...threads[targetIndex],
    condition,
  };

  const updatedWorkflowData = {
    ...resolved.workflowData,
    threads,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    updated: true,
    workflow_id: workflowId,
    thread_id: threadId,
    condition,
    updatedWorkflowThreads: threads,
    updatedWorkflowsData,
  };
}
