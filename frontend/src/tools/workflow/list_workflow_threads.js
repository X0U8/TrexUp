import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'list_workflow_threads',
  description: 'List all active connections, their source and target nodes, and branch rules.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
    },
    required: ['workflow_id'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  if (!workflowId) return { error: 'workflow_id is required' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = resolved.workflowData.nodes || {};
  const threads = resolved.workflowData.threads || [];

  const list = threads.map((th) => ({
    thread_id: th.id,
    from: th.from,
    from_title: nodes[th.from]?.title || th.from,
    to: th.to,
    to_title: nodes[th.to]?.title || th.to,
    condition: th.condition || '(unconditional)',
  }));

  return {
    workflow_id: workflowId,
    count: list.length,
    threads: list,
  };
}
