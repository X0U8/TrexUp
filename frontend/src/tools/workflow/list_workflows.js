import { DEFAULT_WORKFLOWS } from '../../utils/workflowTemplates';

export const DEFINITION = {
  type: 'function',
  name: 'list_workflows',
  description: 'List all workflow pipelines in the project with their ID, name, trigger type, and description.',
  parameters: {
    type: 'object',
    properties: {},
  },
};

export async function run(ctx) {
  const allIds = Array.from(new Set([...Object.keys(DEFAULT_WORKFLOWS), ...(ctx.workflows || [])]));

  const list = allIds.map((id) => {
    const isBuiltIn = Boolean(DEFAULT_WORKFLOWS[id]);
    const defaultData = DEFAULT_WORKFLOWS[id] || {};
    const customData = ctx.workflowsData?.[id] || {};

    const name = customData.name || defaultData.name || id;
    const description = customData.description || defaultData.description || '';
    const nodes = customData.nodes || defaultData.nodes || {};
    const threads = customData.threads || defaultData.threads || [];

    const inputNode = Object.values(nodes).find((n) => n.type === 'input');
    const trigger = inputNode?.trigger || 'manual';

    return {
      workflow_id: id,
      name,
      description,
      trigger,
      node_count: Object.keys(nodes).length,
      thread_count: threads.length,
      built_in: isBuiltIn,
      is_active: id === (ctx.currentWorkflow || 'extraction'),
    };
  });

  return { listed: true, count: list.length, workflows: list };
}
