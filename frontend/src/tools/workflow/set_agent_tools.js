import { resolveWorkflow } from './_shared';

export const DEFINITION = {
  type: 'function',
  name: 'set_agent_tools',
  description: 'Enable or restrict tool calling and tool search access for a specific agent node.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the agent node.' },
      enabled: { type: 'boolean', description: 'Whether tool calling is active for this agent.' },
      selected_tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Allowed specific tool names (e.g. ["create_nodes", "search_nodes", "connect_nodes"]). If omitted, all tools are available.',
      },
      namespaces: {
        type: 'array',
        items: { type: 'string' },
        description: 'Allowed namespaces such as canvas, engine, or custom.',
      },
    },
    required: ['workflow_id', 'node_id', 'enabled'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const nodeId = String(args?.node_id || '').trim();
  const enabled = Boolean(args?.enabled);

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

  const selectedTools = Array.isArray(args?.selected_tools)
    ? args.selected_tools
    : Array.isArray(args?.tools)
    ? args.tools
    : targetNode.selectedTools;

  const updatedNode = {
    ...targetNode,
    tools: enabled,
    selectedTools: enabled ? selectedTools : undefined,
    toolNamespaces: Array.isArray(args?.namespaces) ? args.namespaces : ['canvas'],
  };

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
    tools_enabled: enabled,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
