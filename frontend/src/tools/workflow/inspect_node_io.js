import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'inspect_node_io',
  description: 'Inspect the exact input payload received and output returned by any node in the latest run.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'Target node ID to inspect.' },
    },
    required: ['workflow_id', 'node_id'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const nodeId = String(args?.node_id || '').trim();

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!nodeId) return { error: 'node_id is required' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const node = resolved.workflowData.nodes?.[nodeId];

  if (!node) {
    return { error: `Node "${nodeId}" not found in workflow "${workflowId}".` };
  }

  return {
    workflow_id: workflowId,
    node_id: nodeId,
    title: node.title || nodeId,
    type: node.type,
    status: node.status || 'idle',
    last_input: node.lastInput || null,
    last_output: node.lastOutput || null,
    last_error: node.lastError || null,
    last_run_time_ms: node.lastRunTimeMs || null,
  };
}
