import { resolveWorkflow, WORKFLOW_TRIGGER_TYPES } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'configure_input_node',
  description: 'Configure entry triggers, accepted file categories, and document scopes for the workflow input.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the input node.' },
      trigger: { type: 'string', enum: ['file_drop', 'node_connect', 'manual', 'scheduled'], description: 'Trigger event type.' },
      accepted_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Allowed media types (documents, text, images, audio, data). Note: video and gif are blocked.',
      },
      source_scope: { type: 'string', description: 'Source scope (e.g. "uploaded_documents", "canvas_nodes").' },
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
  const nodes = { ...resolved.workflowData.nodes };
  const targetNode = nodes[nodeId];

  if (!targetNode) {
    return { error: `Node "${nodeId}" not found in workflow "${workflowId}".` };
  }
  if (targetNode.type !== 'input') {
    return { error: `Node "${nodeId}" is of type "${targetNode.type}", not "input".` };
  }

  const updatedNode = { ...targetNode };

  if (args?.trigger) {
    if (!WORKFLOW_TRIGGER_TYPES.includes(args.trigger)) {
      return { error: `Invalid trigger "${args.trigger}". Allowed: ${WORKFLOW_TRIGGER_TYPES.join(', ')}` };
    }
    updatedNode.trigger = args.trigger;
    updatedNode.sub = `Trigger: ${args.trigger.replace('_', ' ')}`;
  }

  if (Array.isArray(args?.accepted_types)) {
    // Strictly filter out video and gif
    const sanitized = args.accepted_types.filter((t) => t !== 'video' && t !== 'gif');
    updatedNode.acceptedTypes = sanitized;
  }

  if (args?.source_scope) {
    updatedNode.sourceScope = args.source_scope;
  }

  nodes[nodeId] = updatedNode;

  const updatedWorkflowData = {
    ...resolved.workflowData,
    nodes,
  };

  const updatedWorkflowsData = {
    ...(ctx.workflowsData || {}),
    [workflowId]: updatedWorkflowData,
  };

  return {
    configured: true,
    workflow_id: workflowId,
    node: updatedNode,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
