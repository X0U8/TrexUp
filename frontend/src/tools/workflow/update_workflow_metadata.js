import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'update_workflow_metadata',
  description: 'Update high-level metadata such as name and description for an existing workflow.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Unique identifier of the workflow.' },
      name: { type: 'string', description: 'Updated display name.' },
      description: { type: 'string', description: 'Updated workflow summary description.' },
    },
    required: ['workflow_id'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  if (!workflowId) return { error: 'workflow_id is required' };

  const resolved = resolveWorkflow(ctx, workflowId);
  if (!resolved.exists) {
    return { error: `Workflow "${workflowId}" not found.` };
  }

  const newName = typeof args?.name === 'string' && args.name.trim() ? args.name.trim() : resolved.workflowData.name;
  const newDesc = typeof args?.description === 'string' ? args.description.trim() : resolved.workflowData.description;

  const updatedData = {
    ...resolved.workflowData,
    name: newName,
    description: newDesc,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedData,
  };

  return {
    updated: true,
    workflow_id: workflowId,
    name: newName,
    description: newDesc,
    updatedWorkflowsData,
  };
}
