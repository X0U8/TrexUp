import { resolveWorkflow } from './_shared';
import { getEngineDisplayName } from '../../utils/engineUtils';

export const DEFINITION = {
  type: 'function',
  name: 'configure_engine_node',
  description: 'Bind a workflow node to a registered Python processing engine.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
      node_id: { type: 'string', description: 'ID of the engine node.' },
      engine_id: { type: 'string', description: 'ID of the registered engine (e.g. "file_detection").' },
    },
    required: ['workflow_id', 'node_id', 'engine_id'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  const nodeId = String(args?.node_id || '').trim();
  const engineId = String(args?.engine_id || '').trim();

  if (!workflowId) return { error: 'workflow_id is required' };
  if (!nodeId) return { error: 'node_id is required' };
  if (!engineId) return { error: 'engine_id is required' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = { ...resolved.workflowData.nodes };
  const targetNode = nodes[nodeId];

  if (!targetNode) {
    return { error: `Node "${nodeId}" not found in workflow "${workflowId}".` };
  }
  if (targetNode.type !== 'engine') {
    return { error: `Node "${nodeId}" is of type "${targetNode.type}", not "engine".` };
  }

  const engineName = getEngineDisplayName(engineId, ctx.enginesData);

  const updatedNode = {
    ...targetNode,
    engineId,
    title: engineName || engineId,
    sub: engineId,
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
    configured: true,
    workflow_id: workflowId,
    node: updatedNode,
    engine_id: engineId,
    updatedWorkflowNodes: nodes,
    updatedWorkflowsData,
  };
}
