import { DEFAULT_WORKFLOWS } from '../../utils/workflowTemplates';

export const DEFINITION = {
  type: 'function',
  name: 'delete_workflow',
  description: 'Permanently remove a custom workflow pipeline from the project database.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'ID of the workflow to delete.' },
    },
    required: ['workflow_id'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || '').trim();
  if (!workflowId) return { error: 'workflow_id is required' };

  if (DEFAULT_WORKFLOWS[workflowId]) {
    return { error: `Cannot delete predefined built-in workflow "${workflowId}". Only custom workflows can be deleted.` };
  }

  const existingWorkflows = ctx.workflows || ['extraction', 'connection_synthesis'];
  if (!existingWorkflows.includes(workflowId) && !ctx.workflowsData?.[workflowId]) {
    return { error: `Workflow "${workflowId}" not found in project.` };
  }

  const updatedWorkflows = existingWorkflows.filter((w) => w !== workflowId);
  const updatedWorkflowsData = { ...(ctx.workflowsData || {}) };
  delete updatedWorkflowsData[workflowId];

  const fallback = updatedWorkflows[0] || 'extraction';

  return {
    deleted: true,
    workflow_id: workflowId,
    fallback_workflow: fallback,
    updatedWorkflows,
    updatedWorkflowsData,
    currentWorkflow: ctx.currentWorkflow === workflowId ? fallback : ctx.currentWorkflow,
  };
}
