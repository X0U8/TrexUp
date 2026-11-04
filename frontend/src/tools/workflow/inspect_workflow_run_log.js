function summarizeData(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(summarizeData);
  const out = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' && val.length > 500) {
      if (key.includes('b64') || key.includes('bytes')) {
        out[key] = `<binary data (${val.length} bytes)>`;
      } else {
        out[key] = `${val.substring(0, 500)}... (truncated)`;
      }
    } else if (typeof val === 'object' && val !== null) {
      out[key] = summarizeData(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

export const DEFINITION = {
  type: 'function',
  name: 'inspect_workflow_run_log',
  description: 'Inspect the execution log of a workflow run. Can inspect the entire flow path and all steps, or inspect the exact input and output of a specific node inside that log.',
  parameters: {
    type: 'object',
    properties: {
      run_id: {
        type: 'string',
        description: 'Optional run ID to inspect. If omitted, inspects the latest execution run.',
      },
      workflow_id: {
        type: 'string',
        description: 'Optional workflow ID to inspect the latest run of a specific workflow.',
      },
      node_id: {
        type: 'string',
        description: 'Optional node ID. If provided, returns the deep input payload, output data, and error of that specific node in the run.',
      },
    },
  },
};

export async function run(ctx, args) {
  const allLogs = Array.isArray(ctx.workflowLogs) ? ctx.workflowLogs : [];
  if (allLogs.length === 0) {
    return {
      status: 'empty',
      message: 'No workflow runs recorded yet. Execute a workflow or drop a file to generate execution logs.',
    };
  }

  const requestedRunId = args?.run_id ? String(args.run_id).trim() : null;
  const requestedWfId = args?.workflow_id ? String(args.workflow_id).trim() : null;
  const requestedNodeId = args?.node_id ? String(args.node_id).trim() : null;

  let targetRun = null;
  if (requestedRunId) {
    targetRun = allLogs.find((r) => r.id === requestedRunId);
  } else if (requestedWfId) {
    targetRun = allLogs.find((r) => r.workflowId === requestedWfId);
  }

  // Fallback to the latest run in logs
  if (!targetRun) {
    targetRun = allLogs[0];
  }

  if (!targetRun) {
    return { error: `No log found matching run_id "${requestedRunId || requestedWfId}".` };
  }

  const threads = Object.values(targetRun.threads || {});
  const flowPath = threads.map((t) => ({
    thread_id: t.id,
    from_node: t.startNodeId,
    to_node: t.endNodeId,
    status: t.status || 'completed',
  }));

  // If a specific node is requested, return deep input/output inspection for that node
  if (requestedNodeId) {
    const nodeObj = targetRun.nodes?.[requestedNodeId];
    if (!nodeObj) {
      const availableNodeIds = Object.keys(targetRun.nodes || {}).join(', ');
      return {
        error: `Node "${requestedNodeId}" not found in run "${targetRun.id}". Available nodes in this run: [${availableNodeIds}]`,
      };
    }

    const incoming = threads.filter((t) => t.endNodeId === requestedNodeId).map((t) => t.startNodeId);
    const outgoing = threads.filter((t) => t.startNodeId === requestedNodeId).map((t) => t.endNodeId);

    return {
      run_id: targetRun.id,
      workflow_id: targetRun.workflowId,
      node_id: requestedNodeId,
      title: nodeObj.title || requestedNodeId,
      type: nodeObj.type,
      status: nodeObj.status || 'idle',
      duration_ms: nodeObj.lastRunTimeMs || nodeObj.processInfo?.duration || null,
      error: nodeObj.processInfo?.error || nodeObj.lastError || null,
      incoming_from: incoming,
      outgoing_to: outgoing,
      input_payload: summarizeData(nodeObj.inputData || nodeObj.lastInput),
      output_payload: summarizeData(nodeObj.outputData || nodeObj.lastOutput),
    };
  }

  // Otherwise return full flow and summary of all nodes
  const nodes = Object.values(targetRun.nodes || {});
  const nodeTraces = nodes.map((n) => ({
    node_id: n.id,
    title: n.title || n.id,
    type: n.type,
    status: n.status || 'idle',
    duration_ms: n.lastRunTimeMs || n.processInfo?.duration || null,
    error: n.processInfo?.error || n.lastError || null,
    input_received: summarizeData(n.inputData || n.lastInput),
    output_returned: summarizeData(n.outputData || n.lastOutput),
  }));

  return {
    run_id: targetRun.id,
    workflow_id: targetRun.workflowId,
    workflow_name: targetRun.workflowName || targetRun.workflowId,
    status: targetRun.status || 'completed',
    duration: targetRun.duration || null,
    started_at: targetRun.startedAt || null,
    finished_at: targetRun.finishedAt || null,
    flow_path: flowPath,
    total_nodes_executed: nodeTraces.filter((n) => n.status === 'completed' || n.status === 'success').length,
    total_nodes_in_pipeline: nodeTraces.length,
    node_traces: nodeTraces,
  };
}
