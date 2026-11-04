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
        items: { type: 'string', enum: ['files', 'canvas_nodes'] },
        description: 'Allowed input formats: "files" (documents, media, tables) and/or "canvas_nodes" (findings, hypotheses, evidence).',
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
    const valid = args.accepted_types
      .map((t) => {
        if (t === 'canvas_nodes' || t === 'canvas_node' || t === 'node' || t === 'nodes') return 'canvas_nodes';
        if (['files', 'file', 'documents', 'text', 'images', 'audio', 'data'].includes(t)) return 'files';
        return null;
      })
      .filter(Boolean);
    const resolvedTypes = Array.from(new Set(valid.length > 0 ? valid : ['files', 'canvas_nodes']));
    updatedNode.acceptedTypes = resolvedTypes;
    updatedNode.sub = `${resolvedTypes.length} accepted format${resolvedTypes.length === 1 ? '' : 's'}`;
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
