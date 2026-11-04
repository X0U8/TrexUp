import { DEFAULT_WORKFLOWS } from '../../utils/workflowTemplates';

export const WORKFLOW_NODE_TYPES = ['agent', 'engine', 'input', 'output', 'router'];
export const WORKFLOW_TRIGGER_TYPES = ['file_drop', 'node_connect', 'manual', 'scheduled'];

export const AVAILABLE_AGENT_MODELS = [
  { id: 'muse-spark-1.3', name: 'Muse Spark 1.3', tag: '1M', desc: 'Frontier reasoning, long-horizon coding, and native tool calling.' },
  { id: 'muse-wonder', name: 'Muse Wonder', tag: '1M', desc: 'Frontier reasoning, complex agent planning, and broad multimodal understanding.' },
  { id: 'muse-spark-1.3-contributor', name: 'Muse Spark 1.3 Contributor', tag: '1M', desc: 'Same capabilities as Muse Spark 1.3 at discounted contributor tier.' },
  { id: 'muse-voice-transcribe', name: 'Muse Voice Transcribe', tag: 'Audio', desc: 'Speech-to-text transcription with speaker turn detection and timestamps.' },
  { id: 'muse-image-1.0', name: 'Muse Image 1.0', tag: 'Image', desc: 'Image generation and transformation model.' },
  { id: 'muse-spark-1.2', name: 'Muse Spark 1.2', tag: '1M', desc: 'Previous generation Muse Spark reasoning model.' },
  { id: 'muse-spark-1.2-contributor', name: 'Muse Spark 1.2 Contributor', tag: '1M', desc: 'Contributor tier for Muse Spark 1.2.' },
  { id: 'muse-spark-1.1', name: 'Muse Spark 1.1', tag: '1M', desc: 'Initial generation Muse Spark model.' },
];

export function resolveWorkflow(ctx, workflowId) {
  const targetId = workflowId || ctx.currentWorkflow || 'extraction';
  const isPredefined = Boolean(DEFAULT_WORKFLOWS[targetId]);
  const defaultWf = DEFAULT_WORKFLOWS[targetId] || {};
  const customWf = ctx.workflowsData?.[targetId] || {};

  const nodes = customWf.nodes || defaultWf.nodes || {};
  const rawThreads = customWf.threads || defaultWf.threads || [];
  // Threads may be stored as a list or as an object (the runner accepts both).
  const threads = Array.isArray(rawThreads) ? rawThreads : Object.values(rawThreads);
  const name = customWf.name || defaultWf.name || targetId;
  const description = customWf.description || defaultWf.description || '';

  return {
    workflowId: targetId,
    workflowData: {
      ...defaultWf,
      ...customWf,
      name,
      description,
      nodes: { ...nodes },
      threads: [...threads],
    },
    isPredefined,
    exists: Boolean(DEFAULT_WORKFLOWS[targetId] || ctx.workflowsData?.[targetId] || (ctx.workflows || []).includes(targetId)),
  };
}

export function generateNextWorkflowId(workflows = []) {
  const count = workflows.length;
  let nextName = `workflow_${String(count).padStart(2, '0')}`;
  let suffix = count;
  while (workflows.includes(nextName)) {
    suffix++;
    nextName = `workflow_${String(suffix).padStart(2, '0')}`;
  }
  return nextName;
}

export function generateNextNodeId(nodes = {}, type = 'agent') {
  if (type === 'input' && !nodes.input) return 'input';
  if (type === 'output' && !nodes.output) return 'output';

  let index = 1;
  let candidate = `${type}_${index}`;
  while (nodes[candidate]) {
    index++;
    candidate = `${type}_${index}`;
  }
  return candidate;
}

export function generateNextThreadId(threads = []) {
  const existingIds = new Set(threads.map((t) => t.id));
  let index = 1;
  let candidate = `th_${index}`;
  while (existingIds.has(candidate)) {
    index++;
    candidate = `th_${index}`;
  }
  return candidate;
}
