export const DEFINITION = {
  type: 'function',
  name: 'get_workflow_logs',
  description: 'Retrieve recent workflow execution logs, node run results, duration, and error traces.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Optional workflow ID to filter logs for.' },
      limit: { type: 'number', description: 'Maximum number of recent logs to return (default 5).' },
    },
  },
};

export async function run(ctx, args) {
  const allLogs = Array.isArray(ctx.workflowLogs) ? ctx.workflowLogs : [];
  const filterWfId = args?.workflow_id ? String(args.workflow_id).trim() : null;
  const limit = typeof args?.limit === 'number' && args.limit > 0 ? args.limit : 5;

  let filtered = filterWfId ? allLogs.filter((r) => r.workflowId === filterWfId) : allLogs;

  const logsSummary = filtered.slice(0, limit).map((r) => ({
    run_id: r.id,
    workflow_id: r.workflowId,
    workflow_name: r.workflowName || r.workflowId,
    status: r.status,
    error: r.error || null,
    duration: r.duration || null,
    started_at: r.startedAt,
    finished_at: r.finishedAt,
    node_count: Object.keys(r.nodeOutputs || {}).length,
  }));

  return {
    total_logs: filtered.length,
    returned: logsSummary.length,
    logs: logsSummary,
  };
}
