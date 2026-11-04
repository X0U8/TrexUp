import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'get_workflow',
  description: 'Retrieve the complete blueprint of a workflow including all its nodes, positions, threads, and metadata.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Unique identifier of the workflow (e.g. "extraction").' },
    },
    required: ['workflow_id'],
  },
};

export async function run(ctx, args) {
  const id = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  if (!id) return { error: 'workflow_id is required' };

  const resolved = resolveWorkflow(ctx, id);
  if (!resolved.exists) {
    return { error: `Workflow "${id}" not found. Call list_workflows to view available pipelines.` };
  }

  return {
    workflow_id: id,
    name: resolved.workflowData.name,
    description: resolved.workflowData.description,
    built_in: resolved.isPredefined,
    nodes: resolved.workflowData.nodes,
    threads: resolved.workflowData.threads,
    node_count: Object.keys(resolved.workflowData.nodes).length,
    thread_count: resolved.workflowData.threads.length,
  };
}
