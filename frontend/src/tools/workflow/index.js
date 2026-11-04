/**
 * Workflow Pipeline Tools Registry, one file per tool.
 * Mirrors tools/nodes/ and tools/engine/ architecture.
 *
 *     definitions()
 *     result = await runWorkflowTool(ctx, name, args)
 */

import * as list_workflows from './list_workflows';
import * as get_workflow from './get_workflow';
import * as create_workflow from './create_workflow';
import * as duplicate_workflow from './duplicate_workflow';
import * as update_workflow_metadata from './update_workflow_metadata';
import * as delete_workflow from './delete_workflow';
import * as add_workflow_node from './add_workflow_node';
import * as move_workflow_node from './move_workflow_node';
import * as update_workflow_node from './update_workflow_node';
import * as delete_workflow_node from './delete_workflow_node';
import * as batch_place_nodes from './batch_place_nodes';
import * as auto_layout_workflow from './auto_layout_workflow';
import * as list_agent_models from './list_agent_models';
import * as configure_agent_node from './configure_agent_node';
import * as set_agent_context_sources from './set_agent_context_sources';
import * as set_agent_tools from './set_agent_tools';
import * as configure_engine_node from './configure_engine_node';
import * as set_engine_parameters from './set_engine_parameters';
import * as set_engine_input_source from './set_engine_input_source';
import * as configure_input_node from './configure_input_node';
import * as configure_output_node from './configure_output_node';
import * as connect_workflow_nodes from './connect_workflow_nodes';
import * as disconnect_workflow_nodes from './disconnect_workflow_nodes';
import * as set_thread_condition from './set_thread_condition';
import * as list_workflow_threads from './list_workflow_threads';
import * as validate_workflow from './validate_workflow';
import * as execute_workflow from './execute_workflow';
import * as get_workflow_run_state from './get_workflow_run_state';
import * as inspect_node_io from './inspect_node_io';
import * as get_workflow_logs from './get_workflow_logs';
import * as inspect_workflow_run_log from './inspect_workflow_run_log';

export { WORKFLOW_INSTRUCTIONS } from './workflowInstructions';

export const MODULES = Object.fromEntries(
  [
    list_workflows,
    get_workflow,
    create_workflow,
    duplicate_workflow,
    update_workflow_metadata,
    delete_workflow,
    add_workflow_node,
    move_workflow_node,
    update_workflow_node,
    delete_workflow_node,
    batch_place_nodes,
    auto_layout_workflow,
    list_agent_models,
    configure_agent_node,
    set_agent_context_sources,
    set_agent_tools,
    configure_engine_node,
    set_engine_parameters,
    set_engine_input_source,
    configure_input_node,
    configure_output_node,
    connect_workflow_nodes,
    disconnect_workflow_nodes,
    set_thread_condition,
    list_workflow_threads,
    validate_workflow,
    execute_workflow,
    get_workflow_run_state,
    inspect_node_io,
    get_workflow_logs,
    inspect_workflow_run_log,
  ].map((m) => [m.DEFINITION.name, m])
);

export const WORKFLOW_TOOL_NAMES = Object.keys(MODULES);
export const WORKFLOW_TOOL_DEFINITIONS = WORKFLOW_TOOL_NAMES.map((name) => MODULES[name].DEFINITION);

export function definitions() {
  return WORKFLOW_TOOL_DEFINITIONS;
}

export async function runWorkflowTool(ctx, name, args) {
  if (!MODULES[name]) return { error: `unknown workflow tool: ${JSON.stringify(name)}` };
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return { error: 'tool arguments must be a JSON object' };
  }

  const safeCtx = {
    workflows: ctx?.workflows || ['extraction', 'connection_synthesis'],
    workflowsData: ctx?.workflowsData || {},
    currentWorkflow: ctx?.currentWorkflow || 'extraction',
    engines: ctx?.engines || [],
    enginesData: ctx?.enginesData || {},
    isWorkflowRunning: ctx?.isWorkflowRunning || false,
    workflowLogs: ctx?.workflowLogs || [],
    onWorkflowProgress: ctx?.onWorkflowProgress,
    onExecuteTool: ctx?.onExecuteTool,
  };

  try {
    const result = await MODULES[name].run(safeCtx, args || {});
    return result && typeof result === 'object' ? result : { result };
  } catch (error) {
    return { error: error?.message || 'workflow tool failed' };
  }
}
