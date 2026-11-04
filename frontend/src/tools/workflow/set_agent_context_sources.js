import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'set_agent_context_sources',
  description: 'Configure which upstream data feeds into the agent (file, metadata, or previous outputs).',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the agent node.' },
      input_source: { type: 'string', enum: ['original', 'previous', 'both'], description: 'Primary payload source.' },
      context_sources: {
        type: 'object',
        properties: {
          inputFile: { type: 'boolean', description: 'Main input content: raw document text or file bytes.' },
          inputMetadata: { type: 'boolean', description: 'Input metadata: doc_id, file_name, file size, MIME type, category, and canvas node ID.' },
          previousOutput: { type: 'boolean', description: 'Previous node output: main result from the immediately preceding upstream step.' },
          previousMetadata: { type: 'boolean', description: 'Previous node metadata: upstream step execution duration, model name, and status.' },
        },
        description: 'Context source flags specifying what upstream data is delivered to the agent.',
      },
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
  if (targetNode.type !== 'agent') {
    return { error: `Node "${nodeId}" is of type "${targetNode.type}", not "agent".` };
  }

  const updatedNode = { ...targetNode };

  if (args?.input_source) {
    updatedNode.inputSource = args.input_source;
  }

  if (args?.context_sources && typeof args.context_sources === 'object') {
    updatedNode.contextSources = {
      ...(targetNode.contextSources || {}),
      ...args.context_sources,
    };
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
    updated: true,
    workflow_id: workflowId,
    node: updatedNode,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
