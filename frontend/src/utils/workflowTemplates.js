/**
 * Workflow Templates & Predefined Graph Blueprints
 * Uses unified sequential UIDs: engine_1, engine_2, agent_1, agent_2, etc.
 */

export const DEFAULT_EXTRACTION_WORKFLOW = {
  id: 'extraction',
  name: 'extraction',
  description: 'Deterministic ingestion pipeline triggered on file drops. Validates files, detects types, extracts document text, transcribes audio via Muse Voice Transcribe, analyzes images via Muse Spark vision, and synthesizes structured topics and findings on the exploration canvas.',
  nodes: {
    input: {
      id: 'input',
      title: 'Input',
      sub: 'Trigger: File Drop',
      type: 'input',
      trigger: 'file_drop',
      x: 40,
      y: 260,
      width: 175,
      height: 56,
      acceptedTypes: ['documents', 'text', 'images', 'audio', 'data'],
      sourceScope: 'uploaded_documents',
    },
    engine_bridge: {
      id: 'engine_bridge',
      title: 'resource_bridge',
      sub: 'Validates & caches OS document path',
      type: 'engine',
      engineId: 'resource_bridge',
      inputSource: 'original',
      x: 250,
      y: 260,
      width: 185,
      height: 56,
    },
    engine_1: {
      id: 'engine_1',
      title: 'file_detection',
      sub: 'Inspects binary magic bytes and file limits',
      type: 'engine',
      engineId: 'file_detection',
      inputSource: 'previous',
      x: 470,
      y: 260,
      width: 185,
      height: 56,
    },
    engine_2: {
      id: 'engine_2',
      title: 'document_extractor',
      sub: 'Deterministic document parser with OCR & Vision escalation',
      type: 'engine',
      engineId: 'document_extractor',
      inputSource: 'both',
      x: 720,
      y: 120,
      width: 185,
      height: 56,
    },
    agent_1: {
      id: 'agent_1',
      title: 'Voice Transcriber',
      sub: 'Muse Voice Transcribe',
      type: 'agent',
      modelId: 'muse-voice-transcribe-1.0',
      modelName: 'Muse Voice Transcribe',
      inputSource: 'original',
      systemPrompt:
        'Transcribe the speech content from the audio stream accurately with speaker turn labels and timestamps.',
      temperature: 0.1,
      x: 720,
      y: 400,
      width: 185,
      height: 56,
    },
    agent_2: {
      id: 'agent_2',
      title: 'Vision Analyzer',
      sub: 'Muse Spark 1.3',
      type: 'agent',
      modelId: 'muse-spark-1.3',
      modelName: 'Muse Spark 1.3',
      inputSource: 'both',
      systemPrompt:
        'You are a document transcription and vision analysis agent. You are given a scanned page, image, or PDF. Do NOT call any tools and do NOT summarize. Reply in plain text only, in this order: (1) DOCUMENT TEXT: transcribe all visible text verbatim in reading order, keeping headings, lists, and equations; render tables row by row. (2) VISUALS: describe every figure, chart, diagram, and image, including axis labels, values, and captions. (3) STRUCTURE: list the section headings in order. Be complete and factual; never invent text that is not visible. If something is unreadable, write [unreadable].',
      temperature: 0.2,
      reasoningEffort: 'minimal',
      x: 980,
      y: 260,
      width: 185,
      height: 56,
    },
    agent_3: {
      id: 'agent_3',
      title: 'Knowledge Synthesis Agent',
      sub: 'Muse Wonder',
      type: 'agent',
      modelId: 'muse-wonder-1.0',
      modelName: 'Muse Wonder',
      inputSource: 'previous',
      tools: true,
      contextSources: {
        inputFile: false,
        inputMetadata: true,
        previousOutput: true,
        previousMetadata: true,
      },
      systemPrompt:
        'You are the Knowledge Synthesis Agent.\n\nRULES:\n- Work from the upstream text you were given. Do not search the canvas for inputs that are missing; if something is missing, say so in your reply.\n- Extract primary conceptual topics, essential subtopics, and crucial findings from the document.\n- Call "canvas_outline" once first to see what already exists on the canvas.\n- Call "create_nodes" to create what is missing in batch, connecting topics to the source document and subtopics directly to their parent topic nodes. Every node you create MUST be connected: set connect_to_source_id on each node (the Node ID of the source document, given in the canvas directive for topics, findings and claims; the node_id of the parent topic for subtopics). A node without connect_to_source_id is an error. Do not recreate nodes already in the outline.\n- After you create nodes, call "canvas_outline" once to confirm. If it shows the source, topics, findings and evidence connected with no problems, you are DONE: reply with a short summary and call no tools.',
      temperature: 0.2,
      reasoningEffort: 'minimal',
      x: 1250,
      y: 260,
      width: 195,
      height: 56,
    },
    output: {
      id: 'output',
      title: 'Output',
      sub: 'Exploration Graph',
      type: 'output',
      inputSource: 'previous',
      x: 1530,
      y: 260,
      width: 175,
      height: 56,
    },
  },
  threads: [
    { id: 'th_bridge', from: 'input', to: 'engine_bridge', condition: '' },
    { id: 'th_1', from: 'engine_bridge', to: 'engine_1', condition: 'valid == True' },
    { id: 'th_2', from: 'engine_1', to: 'engine_2', condition: "category == 'document' or category == 'text' or category == 'tabular' or category == 'code'" },
    { id: 'th_3', from: 'engine_1', to: 'agent_2', condition: "category == 'image'" },
    { id: 'th_4', from: 'engine_1', to: 'agent_1', condition: "category == 'audio'" },
    { id: 'th_5', from: 'engine_2', to: 'agent_2', condition: 'escalation.needs_vision_model == True' },
    { id: 'th_6', from: 'engine_2', to: 'agent_3', condition: 'escalation.needs_vision_model == False' },
    { id: 'th_7', from: 'agent_2', to: 'agent_3', condition: '' },
    { id: 'th_8', from: 'agent_1', to: 'agent_3', condition: '' },
    { id: 'th_9', from: 'agent_3', to: 'output', condition: '' },
  ],
};

export const DEFAULT_CONNECTION_WORKFLOW = {
  id: 'connection_synthesis',
  name: 'connection_synthesis',
  description: 'Triggered when connecting two canvas exploration nodes. Prepares paired contextual evidence with node_context_builder and evaluates logical or causal relationships with Muse Spark.',
  nodes: {
    input: {
      id: 'input',
      title: 'Input',
      sub: 'Trigger: On Connect',
      type: 'input',
      trigger: 'node_connect',
      x: 80,
      y: 260,
      width: 175,
      height: 56,
      acceptedTypes: ['json', 'canvas_nodes', 'data'],
      sourceScope: 'canvas_nodes',
    },
    engine_1: {
      id: 'engine_1',
      title: 'node_context_builder',
      sub: 'Sanitizes & packages node pair context',
      type: 'engine',
      engineId: 'node_context_builder',
      inputSource: 'previous',
      x: 360,
      y: 260,
      width: 195,
      height: 56,
    },
    agent_1: {
      id: 'agent_1',
      title: 'Relationship Synthesizer',
      sub: 'Muse Spark 1.3',
      type: 'agent',
      modelId: 'muse-spark-1.3',
      modelName: 'Muse Spark 1.3',
      inputSource: 'both',
      systemPrompt:
        'You are the Relationship Synthesis Agent. Given two canvas nodes (source and target) and their context from the upstream engine, determine if there is a logical, causal, supportive, or contradictory relationship between them. If a valid connection exists, set "connected": true, provide a concise 2-4 word relationship label (e.g. "Supports Claim", "Contradicts Finding", "Provides Context"), and a single-sentence explanation. If no connection or weak connection exists, set "connected": false, label "No Logical Connection", and explain why. Always output strict JSON only: {"connected": boolean, "relationship": string, "label": string, "explanation": string}.',
      temperature: 0.1,
      reasoningEffort: 'minimal',
      x: 680,
      y: 260,
      width: 205,
      height: 56,
    },
    output: {
      id: 'output',
      title: 'Output',
      sub: 'Connection Verdict',
      type: 'output',
      inputSource: 'previous',
      x: 1000,
      y: 260,
      width: 175,
      height: 56,
    },
  },
  threads: [
    { id: 'th_conn_1', from: 'input', to: 'engine_1', condition: '' },
    { id: 'th_conn_2', from: 'engine_1', to: 'agent_1', condition: 'valid == True' },
    { id: 'th_conn_3', from: 'agent_1', to: 'output', condition: '' },
  ],
};

export const DEFAULT_WORKFLOWS = {
  extraction: DEFAULT_EXTRACTION_WORKFLOW,
  connection_synthesis: DEFAULT_CONNECTION_WORKFLOW,
};

/**
 * Projects saved before a prompt fix keep their old copy of the Synthesis agent prompt.
 * On load, replace only that known old prompt (it starts with the same line and lacks the
 * current connect rule). Prompts the user wrote differently are left alone.
 */
export function refreshSynthesisPrompts(project) {
  if (!project?.workflowsData) return project;
  const latest = DEFAULT_WORKFLOWS.extraction.nodes.agent_3.systemPrompt;
  const OLD_START = 'You are the Knowledge Synthesis Agent.';
  const CURRENT_RULE = 'MUST be connected';

  const workflowsData = {};
  for (const [wfId, wf] of Object.entries(project.workflowsData)) {
    const nodes = {};
    for (const [nId, n] of Object.entries(wf?.nodes || {})) {
      const isOldSynthesis =
        n?.type === 'agent' &&
        typeof n.systemPrompt === 'string' &&
        n.systemPrompt.startsWith(OLD_START) &&
        !n.systemPrompt.includes(CURRENT_RULE);
      nodes[nId] = isOldSynthesis ? { ...n, systemPrompt: latest } : n;
    }
    workflowsData[wfId] = wf ? { ...wf, nodes } : wf;
  }
  return { ...project, workflowsData };
}
