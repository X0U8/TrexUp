import { resolveWorkflow, generateNextWorkflowId } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'duplicate_workflow',
  description: 'Clone an existing workflow pipeline to test modifications safely.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'ID of the source workflow to clone.' },
      new_name: { type: 'string', description: 'Name for the cloned workflow.' },
    },
    required: ['workflow_id', 'new_name'],
  },
};

export async function run(ctx, args) {
  const sourceId = String(args?.workflow_id || '').trim();
  const newName = String(args?.new_name || '').trim();

  if (!sourceId) return { error: 'workflow_id is required' };
  if (!newName) return { error: 'new_name is required' };

  const source = resolveWorkflow(ctx, sourceId);
  if (!source.exists) {
    return { error: `Source workflow "${sourceId}" not found.` };
  }

  const existingWorkflows = ctx.workflows || ['extraction', 'connection_synthesis'];
  const newWorkflowId = generateNextWorkflowId(existingWorkflows);

  const clonedData = {
    name: newName,
    description: source.workflowData.description || `Clone of ${source.workflowData.name}`,
    nodes: JSON.parse(JSON.stringify(source.workflowData.nodes || {})),
    threads: JSON.parse(JSON.stringify(source.workflowData.threads || [])),
  };

  const updatedWorkflows = [...existingWorkflows, newWorkflowId];
  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [newWorkflowId]: clonedData,
  };

  return {
    duplicated: true,
    workflow_id: newWorkflowId,
    name: newName,
    source_workflow_id: sourceId,
    node_count: Object.keys(clonedData.nodes).length,
    thread_count: clonedData.threads.length,
    updatedWorkflows,
    updatedWorkflowsData,
    currentWorkflow: newWorkflowId,
  };
}
