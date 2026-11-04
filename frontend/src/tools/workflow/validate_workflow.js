import { resolveWorkflow } from './_shared';
import { getAllEngineIds, BUILT_IN_ENGINE_IDS } from '../../utils/engineUtils';
import { isEngineTested } from '../engine/testedEngines';

// A thread condition is a JS-like expression the runner evaluates; check it compiles.
function conditionCompiles(expr) {
  const sanitized = expr
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bcategory\s+in\s+\[(.*?)\]/g, '[$1].includes(category)');
  try {
    new Function('data', `with(data) { return Boolean(${sanitized}); }`);
    return true;
  } catch {
    return false;
  }
}

export const DEFINITION = {
  type: 'function',
  name: 'validate_workflow',
  description: 'Inspect workflow graph integrity to detect cycles, unreachable nodes, and configuration errors.',
  parameters: {
    type: 'object',
    properties: {
      workflow_id: { type: 'string', description: 'Target workflow ID.' },
    },
    required: ['workflow_id'],
  },
};

export async function run(ctx, args) {
  const workflowId = String(args?.workflow_id || ctx.currentWorkflow || '').trim();
  if (!workflowId) return { error: 'workflow_id is required' };

  const resolved = resolveWorkflow(ctx, workflowId);
  const nodes = resolved.workflowData.nodes || {};
  const threads = Array.isArray(resolved.workflowData.threads)
    ? resolved.workflowData.threads
    : Object.values(resolved.workflowData.threads || {});
  const nodeIds = Object.keys(nodes);

  const problems = [];
  const warnings = [];

  if (nodeIds.length === 0) {
    problems.push('Workflow has no nodes.');
    return { valid: false, problems, warnings };
  }

  const hasInput = Object.values(nodes).some((n) => n.type === 'input');
  const hasOutput = Object.values(nodes).some((n) => n.type === 'output');

  const inputCount = Object.values(nodes).filter((n) => n.type === 'input').length;
  const outputCount = Object.values(nodes).filter((n) => n.type === 'output').length;
  if (!hasInput) problems.push('Workflow is missing an input trigger node.');
  if (inputCount > 1) problems.push(`Workflow has ${inputCount} input nodes; it must have exactly one.`);
  if (!hasOutput) warnings.push('Workflow has no designated output node.');
  if (outputCount > 1) problems.push(`Workflow has ${outputCount} output nodes; it must have exactly one.`);

  // Validate threads reference valid nodes
  threads.forEach((th) => {
    if (!nodes[th.from]) problems.push(`Thread "${th.id}" references nonexistent source node "${th.from}".`);
    if (!nodes[th.to]) problems.push(`Thread "${th.id}" references nonexistent target node "${th.to}".`);
  });

  // Cycle detection via DFS
  const adj = {};
  nodeIds.forEach((id) => {
    adj[id] = [];
  });
  threads.forEach((th) => {
    if (adj[th.from]) adj[th.from].push(th.to);
  });

  const visited = {};
  const recStack = {};
  let hasCycle = false;

  function checkCycle(node) {
    visited[node] = true;
    recStack[node] = true;

    for (const neighbor of adj[node] || []) {
      if (!visited[neighbor]) {
        if (checkCycle(neighbor)) return true;
      } else if (recStack[neighbor]) {
        return true;
      }
    }

    recStack[node] = false;
    return false;
  }

  for (const id of nodeIds) {
    if (!visited[id]) {
      if (checkCycle(id)) {
        hasCycle = true;
        break;
      }
    }
  }

  if (hasCycle) {
    problems.push('Workflow graph contains a circular loop or dependency cycle.');
  }

  // Reachability check from input
  const inputNode = Object.values(nodes).find((n) => n.type === 'input');
  if (inputNode) {
    const reachable = new Set();
    const q = [inputNode.id];
    reachable.add(inputNode.id);

    while (q.length > 0) {
      const curr = q.shift();
      (adj[curr] || []).forEach((next) => {
        if (!reachable.has(next)) {
          reachable.add(next);
          q.push(next);
        }
      });
    }

    const unreachable = nodeIds.filter((id) => !reachable.has(id));
    if (unreachable.length > 0) {
      problems.push(`Nodes not reached from the input, so they will never run: ${unreachable.join(', ')}`);
    }
  }

  // Reachability check forward to output (detect dangling intermediate nodes)
  const outputNode = Object.values(nodes).find((n) => n.type === 'output');
  if (outputNode) {
    // Reverse adjacency graph
    const revAdj = {};
    nodeIds.forEach((id) => {
      revAdj[id] = [];
    });
    threads.forEach((th) => {
      if (revAdj[th.to]) revAdj[th.to].push(th.from);
    });

    const canReachOutput = new Set();
    const rq = [outputNode.id];
    canReachOutput.add(outputNode.id);

    while (rq.length > 0) {
      const curr = rq.shift();
      (revAdj[curr] || []).forEach((prev) => {
        if (!canReachOutput.has(prev)) {
          canReachOutput.add(prev);
          rq.push(prev);
        }
      });
    }

    const dangling = nodeIds.filter((id) => id !== outputNode.id && !canReachOutput.has(id));
    if (dangling.length > 0) {
      problems.push(`Dangling nodes that do not reach Output: ${dangling.map((id) => `"${nodes[id]?.title || id}"`).join(', ')}.`);
    }

    // Check for direct bypass thread if intermediate processing nodes exist
    const intermediateNodes = nodeIds.filter((id) => id !== inputNode?.id && id !== outputNode.id);
    const hasBypassThread = inputNode && threads.some((th) => th.from === inputNode.id && th.to === outputNode.id);
    if (intermediateNodes.length > 0 && hasBypassThread) {
      problems.push(`Input is connected directly to Output, bypassing intermediate nodes (${intermediateNodes.map((id) => nodes[id]?.title || id).join(', ')}). Disconnect the thread between "${inputNode.id}" and "${outputNode.id}".`);
    }
  }

  // Threads whose conditions will not compile
  threads.forEach((th) => {
    if (th.condition && th.condition.trim() && !conditionCompiles(th.condition.trim())) {
      problems.push(`Thread "${th.id}" has an invalid condition: ${th.condition}`);
    }
  });

  // Validate agent and engine configs
  const knownEngines = getAllEngineIds(ctx.engines || [], Object.keys(ctx.enginesData || {}));
  Object.values(nodes).forEach((n) => {
    if (n.type === 'agent' && !n.modelId) {
      warnings.push(`Agent node "${n.title || n.id}" has no model assigned.`);
    }
    if (n.type === 'engine' && !n.engineId) {
      problems.push(`Engine node "${n.title || n.id}" is not bound to any Python engine ID.`);
    } else if (n.type === 'engine' && !knownEngines.includes(n.engineId)) {
      problems.push(`Engine node "${n.title || n.id}" uses engine "${n.engineId}", which does not exist.`);
    }
  });

  // Checklist: every agent needs an input and instructions; every custom engine needs a passing test.
  const incoming = new Set(threads.map((th) => th.to));
  Object.values(nodes).forEach((n) => {
    const label = `"${n.title || n.id}"`;
    if (n.type === 'agent') {
      if (!incoming.has(n.id)) problems.push(`Agent ${label} has no input: connect it from an upstream step.`);
      if (!n.systemPrompt || !String(n.systemPrompt).trim()) problems.push(`Agent ${label} has no instructions (prompt).`);
    }
    if (n.type === 'engine' && n.engineId && !BUILT_IN_ENGINE_IDS.includes(n.engineId)) {
      const code = ctx.enginesData?.[n.engineId]?.code || '';
      if (!isEngineTested(n.engineId, code)) {
        problems.push(`Engine ${label} ("${n.engineId}") has not passed a test run. Call test_engine with sample input first.`);
      }
    }
  });

  return {
    workflow_id: workflowId,
    valid: problems.length === 0,
    problem_count: problems.length,
    warning_count: warnings.length,
    problems,
    warnings,
  };
}
