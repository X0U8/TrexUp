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

  // The runner needs a trigger that matches the workflow's Input node.
  const inputTrigger = nodes.input?.trigger || Object.values(nodes).find((n) => n.type === 'input')?.trigger || 'manual';
  const data = args?.input_data || {};
  const text = data.text || data.source_text || 'Workflow test input.';
  const sampleNode = data.node || {
    id: data.node_id || 'workflow_input',
    title: data.title || 'Workflow input',
    description: text,
    type: 'finding',
  };

  const triggerPayload = {
    triggerType: inputTrigger,
    triggerLabel: `${inputTrigger}: ${workflowId} (run)`,
    node: sampleNode,
    nodeId: sampleNode.id,
    file_name: data.file_name || 'workflow_input.txt',
    exploration_id: data.exploration_id || 'exploration_01',
    metadata: data.metadata || {},
    description: data.description || text,
    content: data.content || data.description || text,
    text,
    source_text: text,
    extracted_text: text,
    prompt: data.prompt || text,
    ...data,
  };

  try {
    const { executeWorkflow } = await import('../../utils/workflowRunner');
    const runRecord = await executeWorkflow({
      workflowId,
      workflowData: resolved.workflowData,
      project: { enginesData: ctx.enginesData || {}, workflowsData: ctx.workflowsData || {}, explorationsData: {} },
      triggerPayload,
      onProgress: ctx.onWorkflowProgress,
      onExecuteTool: ctx.onExecuteTool,
    });

    const nodeOutputs = {};
    Object.entries(runRecord?.nodes || {}).forEach(([id, n]) => {
      nodeOutputs[id] = { status: n.status, output: n.outputData || null };
    });

    return {
      executed: true,
      workflow_id: workflowId,
      run_id: runRecord?.id,
      status: runRecord?.status || 'unknown',
      node_outputs: nodeOutputs,
      threads_count: threads.length,
      run_record: runRecord,
    };
  } catch (err) {
    return { error: `Execution failed: ${err.message || String(err)}` };
  }
}
