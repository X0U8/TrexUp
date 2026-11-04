import { NODE_TOOL_DEFINITIONS } from './nodes';
import { ENGINE_TOOL_DEFINITIONS } from './engine';
import { WORKFLOW_TOOL_DEFINITIONS } from './workflowTools';
import { LOG_TOOL_DEFINITIONS } from './logs';

/**
 * Builds Meta Tool Search compliant tool definitions.
 * Groups tools into namespaces, marks functions with defer_loading: true,
 * and appends the hosted tool_search directive.
 */
export function buildMetaToolSearchPayload({
  includeCanvas = true,
  includeEngines = true,
  includeWorkflow = true,
  includeLogs = true,
  customTools = [],
} = {}) {
  const tools = [];

  if (includeCanvas) {
    tools.push({
      type: 'namespace',
      name: 'canvas',
      description: 'Canvas graph tools for creating, inspecting, updating, and connecting topics, findings, and evidence nodes.',
      tools: NODE_TOOL_DEFINITIONS.map((def) => ({
        type: 'function',
        name: def.name,
        description: def.description,
        defer_loading: true,
        parameters: def.parameters,
      })),
    });
  }

  if (includeEngines) {
    tools.push({
      type: 'namespace',
      name: 'engine',
      description: 'Python engine tools for listing, inspecting, creating, editing, and testing custom deterministic processing engines.',
      tools: ENGINE_TOOL_DEFINITIONS.map((def) => ({
        type: 'function',
        name: def.name,
        description: def.description,
        defer_loading: true,
        parameters: def.parameters,
      })),
    });
  }

  if (includeWorkflow) {
    tools.push({
      type: 'namespace',
      name: 'workflow',
      description: 'Workflow pipeline tools for creating flows, placing nodes, configuring agent intelligence, binding engines, routing threads, and execution inspection.',
      tools: WORKFLOW_TOOL_DEFINITIONS.map((def) => ({
        type: 'function',
        name: def.name,
        description: def.description,
        defer_loading: true,
        parameters: def.parameters,
      })),
    });
  }

  if (includeLogs) {
    tools.push({
      type: 'namespace',
      name: 'logs',
      description: 'Read-only log inspection tools for retrieving execution logs, tracing pipeline flow paths, and inspecting individual node input and output data.',
      tools: LOG_TOOL_DEFINITIONS.map((def) => ({
        type: 'function',
        name: def.name,
        description: def.description,
        defer_loading: true,
        parameters: def.parameters,
      })),
    });
  }



  if (Array.isArray(customTools) && customTools.length > 0) {
    tools.push({
      type: 'namespace',
      name: 'custom',
      description: 'Project-specific custom tools and plugins.',
      tools: customTools.map((def) => ({
        type: 'function',
        name: def.name || def.function?.name,
        description: def.description || def.function?.description,
        defer_loading: true,
        parameters: def.parameters || def.function?.parameters,
      })),
    });
  }

  // Append hosted tool_search tool
  tools.push({ type: 'tool_search' });

  return tools;
}
