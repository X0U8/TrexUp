import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'execute_workflow',
  description: 'Trigger a live execution run of the workflow against an input file or context payload.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      input_data: { type: 'object', description: 'Input data payload for the entry node.' },
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

  if (Object.keys(nodes).length === 0) {
    return { error: `Workflow "${workflowId}" has no nodes.` };
  }

  const payload = args?.input_data || {
    document: 'sample_context.txt',
    source_text: 'Manual workflow execution test payload.',
    category: 'text',
    input_source: 'original',
  };

  const logs = [];
  const logCallback = (logEntry) => {
    logs.push(logEntry);
  };

  try {
    const { executeWorkflow } = await import('../../utils/workflowRunner');
    const result = await executeWorkflow({
      workflowNodes: nodes,
      workflowThreads: threads,
      inputPayload: payload,
      onLog: logCallback,
      enginesData: ctx.enginesData || {},
    });

    return {
      executed: true,
      workflow_id: workflowId,
      status: result?.status || 'completed',
      node_outputs: result?.nodeOutputs || {},
      logs_count: logs.length,
      recent_logs: logs.slice(-5),
    };
  } catch (err) {
    return {
      error: `Execution failed: ${err.message || String(err)}`,
      logs,
    };
  }
}
