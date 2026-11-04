import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'get_workflow_run_state',
  description: 'Retrieve real-time execution progress, node run states, and elapsed duration.',
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

  const nodeStates = Object.keys(nodes).map((id) => ({
    node_id: id,
    title: nodes[id].title || id,
    type: nodes[id].type,
    status: nodes[id].status || 'idle',
    last_run_time_ms: nodes[id].lastRunTimeMs || null,
  }));

  return {
    workflow_id: workflowId,
    is_running: Boolean(ctx.isWorkflowRunning),
    node_states: nodeStates,
  };
}
