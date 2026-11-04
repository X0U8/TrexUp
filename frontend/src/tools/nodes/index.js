/**
 * Node Lifecycle Tools registry, one file per tool.
 * Mirrors the meta_project layout.
 *
 *     definitions()                       // tool schemas for model
 *     result = runNodeTool(ctx, name, args)
 */
import * as list_explorations from './list_explorations';
import * as canvas_outline from './canvas_outline';
import * as search_nodes from './search_nodes';
import * as create_node from './create_node';
import * as create_nodes from './create_nodes';
import * as get_node from './get_node';
import * as update_node from './update_node';
import * as update_node_status from './update_node_status';
import * as delete_node from './delete_node';
import * as connect_nodes from './connect_nodes';
import * as get_connections from './get_connections';
import * as update_connection from './update_connection';
import * as remove_connection from './remove_connection';

export {
  NODE_TYPES,
  NODE_STATUSES,
  RELATIONSHIP_TYPES,
  getNodeDefaultDimensions,
  resolveNodeId,
} from './_shared';

export { NODE_INSTRUCTIONS } from './nodeInstructions';

export const MODULES = Object.fromEntries(
  [
    list_explorations,
    canvas_outline,
    search_nodes,
    create_node,
    create_nodes,
    get_node,
    update_node,
    update_node_status,
    delete_node,
    connect_nodes,
    get_connections,
    update_connection,
    remove_connection,
  ].map((m) => [m.DEFINITION.name, m])
);

export const NODE_TOOL_NAMES = Object.keys(MODULES);

// Search alias support for runtime dispatch
MODULES.search_investigation = MODULES.search_nodes;
export const NODE_TOOL_DEFINITIONS = [
  list_explorations.DEFINITION,
  canvas_outline.DEFINITION,
  search_nodes.DEFINITION,
  create_node.DEFINITION,
  create_nodes.DEFINITION,
  get_node.DEFINITION,
  update_node.DEFINITION,
  update_node_status.DEFINITION,
  delete_node.DEFINITION,
  connect_nodes.DEFINITION,
  get_connections.DEFINITION,
  update_connection.DEFINITION,
  remove_connection.DEFINITION,
];

// Backwards-compatibility alias
export const NODE_LIFECYCLE_DEFINITIONS = NODE_TOOL_DEFINITIONS;

export function definitions() {
  return NODE_TOOL_DEFINITIONS;
}

/**
 * Standard registry runner matching meta_project pattern
 */
export function runNodeTool(ctx, name, args) {
  const tool = MODULES[name];
  if (!tool) return { error: `unknown tool: ${JSON.stringify(name)}` };
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return { error: 'tool arguments must be a JSON object' };
  }
  try {
    const result = tool.run(ctx, args);
    return result && typeof result === 'object' ? result : { result };
  } catch (error) {
    return { error: error?.message || 'tool execution failed' };
  }
}

/**
 * Legacy compatibility runner matching (explorationsData, activeExpId, toolName, args)
 */
export function executeNodeTool(explorationsData, activeExpId, toolName, args) {
  const ctx = {
    explorationsData: explorationsData || {},
    activeExpId,
  };
  return runNodeTool(ctx, toolName, args);
}
