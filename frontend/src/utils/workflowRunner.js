import { getEngineInitialCode } from '../components/Engines/EnginesPage';
import { DEFAULT_WORKFLOWS } from './workflowTemplates';
import { NODE_LIFECYCLE_DEFINITIONS, NODE_INSTRUCTIONS } from '../tools/nodeLifecycleTools';
import { ENGINE_TOOL_DEFINITIONS, ENGINE_INSTRUCTIONS } from '../tools/engine';
import { WORKFLOW_TOOL_DEFINITIONS, WORKFLOW_INSTRUCTIONS } from '../tools/workflowTools';
import { buildMetaToolSearchPayload } from '../tools/toolSearch';

const toApiTool = (tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
});

const ALL_AGENT_TOOLS = NODE_LIFECYCLE_DEFINITIONS.map(toApiTool);
const ENGINE_AGENT_TOOLS = ENGINE_TOOL_DEFINITIONS.map(toApiTool);
const getWorkflowAgentTools = () => (WORKFLOW_TOOL_DEFINITIONS || []).map(toApiTool);

/**
 * Finds all workflows configured for a specific trigger type to enable parallel execution.
 */
export function findWorkflowsForTrigger(project, triggerType) {
  const workflowsData = project?.workflowsData || {};
  const matched = [];

  for (const [wfId, wf] of Object.entries(workflowsData)) {
    if (wf?.nodes?.input?.trigger === triggerType) {
      matched.push({ id: wfId, data: wf });
    }
  }

  if (matched.length > 0) {
    return matched;
  }

  if (triggerType === 'file_drop') {
    return [{
      id: 'extraction',
      data: workflowsData.extraction || DEFAULT_WORKFLOWS.extraction,
    }];
  }
  if (triggerType === 'node_connect') {
    return [{
      id: 'connection_synthesis',
      data: workflowsData.connection_synthesis || DEFAULT_WORKFLOWS.connection_synthesis,
    }];
  }
  if (triggerType === 'manual') {
    const manualMatched = [];
    for (const [wfId, wf] of Object.entries(workflowsData)) {
      if (wf?.nodes?.input?.trigger === 'manual') {
        manualMatched.push({ id: wfId, data: wf });
      }
    }
    if (manualMatched.length > 0) return manualMatched;
    const firstWfId = project?.workflows?.[0] || 'extraction';
    return [{
      id: firstWfId,
      data: workflowsData[firstWfId] || DEFAULT_WORKFLOWS[firstWfId],
    }];
  }

  const firstWfId = project?.workflows?.[0] || 'extraction';
  return [{
    id: firstWfId,
    data: workflowsData[firstWfId] || DEFAULT_WORKFLOWS[firstWfId],
  }];
}

export function findWorkflowForTrigger(project, triggerType) {
  const list = findWorkflowsForTrigger(project, triggerType);
  return list[0] || null;
}

/**
 * Runs a single Python engine script against the local Python engine runner (http://127.0.0.1:8001).
 * Relies directly on HTTP status code (200 = Success, others = Error/Failure).
 */
async function executePythonEngine(code, inputData) {
  const start = performance.now();
  try {
    const res = await fetch('http://127.0.0.1:8001/api/engines/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        input_data: inputData,
      }),
    });

    const elapsed = Math.round(performance.now() - start);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (res.status === 200 && data.status === 'success') {
      return {
        status: 'success',
        httpCode: 200,
        output: data.output,
        durationMs: data.duration_ms || elapsed,
        server: data.server || 'local-python',
      };
    }

    return {
      status: 'error',
      httpCode: res.status,
      error: data.error || `Engine error (HTTP ${res.status})`,
      output: data.output || null,
      durationMs: data.duration_ms || elapsed,
    };
  } catch (err) {
    return {
      status: 'error',
      httpCode: 503,
      error: `Engine server unreachable: ${err.message}`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}

function sanitizeContextForPrompt(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 3) return {};
  const cleaned = {};
  const blockedKeys = new Set([
    'image_data_url', // generated image: shown on its step only, never sent to a model as text
    'file',
    'file_bytes_b64',
    'b64',
    'raw_file',
    'binary',
    'header_bytes',
    'initial_input',
    'previous_output',
  ]);
  for (const [key, val] of Object.entries(obj)) {
    if (blockedKeys.has(key)) continue;
    if (typeof val === 'string') {
      if (val.length > 2000 || val.startsWith('data:') || /^[A-Za-z0-9+/=]{80,}$/.test(val.slice(0, 80))) {
        continue;
      }
      cleaned[key] = val;
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      cleaned[key] = val;
    } else if (Array.isArray(val)) {
      cleaned[key] = val
        .slice(0, 10)
        .filter((item) => typeof item !== 'string' || item.length < 500);
    } else if (typeof val === 'object' && val !== null) {
      const sub = sanitizeContextForPrompt(val, depth + 1);
      if (Object.keys(sub).length > 0) cleaned[key] = sub;
    }
  }
  return cleaned;
}

/**
 * Executes a model agent against the Meta Model API via the local runner (http://127.0.0.1:8001/api/agents/run).
 */
/** One line describing what a tool call did, so the model can see its own earlier actions. */
// Read-only tools never change the canvas, so a repeat call with nothing changed since is skipped.
const READ_ONLY_TOOLS = ['canvas_outline', 'search_nodes', 'list_explorations', 'get_node', 'get_connections'];

/** The tool list with the named tools removed (handles both flat tools and namespaces). */
function withoutTools(tools, names) {
  if (!Array.isArray(tools) || names.size === 0) return tools;
  return tools
    .map((t) => {
      if (t?.type === 'namespace') {
        return { ...t, tools: (t.tools || []).filter((f) => !names.has(f.name)) };
      }
      return names.has(t?.function?.name || t?.name) ? null : t;
    })
    .filter((t) => t && (t.type !== 'namespace' || (t.tools || []).length > 0));
}

function summarizeToolAction(toolName, args, result) {
  if (result?.already_read) return `${toolName}: skipped, already read this run and nothing changed since (see the earlier result)`;
  if (!result || result.error) return `${toolName}: FAILED - ${result?.error || 'no result'}`;
  if (toolName === 'canvas_outline' && typeof result.outline === 'string') {
    const counts = Object.entries(result.counts || {}).map(([k, v]) => `${v} ${k}`).join(', ') || 'none';
    const problems = Array.isArray(result.problems) && result.problems.length > 0 ? result.problems.join(' ') : 'none';
    return `canvas_outline: read. Counts: ${counts}. Problems: ${problems}\nOutline:\n${result.outline.slice(0, 2000)}`;
  }
  if (toolName === 'search_nodes' && Array.isArray(result.nodes)) {
    const found = result.nodes.map((n) => `"${n.title}" (id: ${n.id})`).join('; ');
    return `search_nodes "${args?.query || ''}": ${result.count} match(es)${found ? `: ${found}` : ''}`;
  }
  if (toolName === 'create_node' && result.node) {
    return `create_node: created ${result.node.type} node "${result.node.title}" (id: ${result.node.id})`;
  }
  if (toolName === 'create_nodes' && Array.isArray(result.nodes)) {
    return `create_nodes: created ${result.nodes.length} nodes: ${result.nodes.map((n) => `"${n.title}" (${n.type}, id: ${n.id})`).join('; ')}`;
  }
  if (toolName === 'connect_nodes' && result.connected) {
    return `connect_nodes: connected ${args?.source_node_id} to ${result.count} node(s)`;
  }
  const { updatedNodes, updatedConnections, ...rest } = result;
  void updatedNodes;
  void updatedConnections;
  return `${toolName}: ${JSON.stringify(rest).slice(0, 300)}`;
}

/**
 * muse-image-1.0: the prompt is the agent prompt plus the upstream text. The image comes back
 * as a data URL on the step's output and is shown there; it is never added to the payload that
 * later steps receive.
 */
async function executeImageModel({ agentPrompt, inputPayload }) {
  const start = performance.now();
  const upstream =
    inputPayload?.description ||
    inputPayload?.content ||
    inputPayload?.source_text ||
    inputPayload?.synthesis ||
    inputPayload?.agent_synthesis ||
    inputPayload?.node_text ||
    inputPayload?.extracted_text ||
    inputPayload?.text ||
    inputPayload?.document_name ||
    inputPayload?.file_name ||
    '';
  // The subject comes first (the node's text or the upstream output); the agent prompt sets the style.
  const prompt = [upstream, agentPrompt ? `Style and constraints: ${agentPrompt}` : '']
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);
  if (!prompt) {
    return {
      status: 'error',
      httpCode: 400,
      error: 'Image step has no prompt. Connect an upstream text step or write a prompt in the agent settings.',
      durationMs: 0,
    };
  }
  try {
    const res = await fetch('http://127.0.0.1:8001/api/agents/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'muse-image-1.0', prompt, input_data: {} }),
    });
    const data = await res.json().catch(() => ({}));
    const elapsed = Math.round(performance.now() - start);
    if (res.status === 200 && data.status === 'success' && data.output?.image_data_url) {
      // Save the picture as a file so the next step can attach it. The save is best effort:
      // if it fails, the image still shows on this step.
      const output = { ...data.output };
      try {
        const saved = await fetch('http://127.0.0.1:8001/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: `generated_image_${Date.now()}.webp`,
            doc_id: `img_${Date.now()}`,
            file_bytes_b64: output.image_data_url,
          }),
        });
        const savedData = await saved.json().catch(() => ({}));
        if (saved.ok && savedData.local_path) output.image_path = savedData.local_path;
      } catch {
        // keep the inline image only
      }
      return { status: 'success', httpCode: 200, output, response: '', durationMs: data.duration_ms || elapsed };
    }
    return {
      status: 'error',
      httpCode: res.status,
      error: data.error || `Image model call returned HTTP ${res.status}`,
      durationMs: elapsed,
    };
  } catch (err) {
    return {
      status: 'error',
      httpCode: 503,
      error: `Image connection failed: ${err.message}`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}

async function executeAgentModel({ modelId, systemPrompt, agentPrompt, temperature, reasoningEffort, inputPayload, targetTitle, tools, progress, canvasState, isLastTurn }) {
  if (modelId === 'muse-image-1.0') {
    return executeImageModel({ agentPrompt, inputPayload });
  }
  const start = performance.now();
  try {
    const isComparison = Boolean(
      inputPayload.prompt_instruction ||
      inputPayload.source_node ||
      inputPayload.target_node ||
      inputPayload.node_pair ||
      targetTitle?.toLowerCase().includes('relationship')
    );

    const promptParts = [];

    if (isComparison) {
      if (inputPayload.prompt_instruction) {
        promptParts.push(inputPayload.prompt_instruction);
      } else {
        const sNode = inputPayload.source_node || inputPayload.node_pair?.source_node || {};
        const tNode = inputPayload.target_node || inputPayload.node_pair?.target_node || {};
        promptParts.push(
          `Analyze the relationship between Node A and Node B:\n` +
          `- Node A (${sNode.type || 'finding'}): "${sNode.title || sNode.name || 'Untitled'}" -> ${sNode.description || sNode.content || ''}\n` +
          `- Node B (${tNode.type || 'finding'}): "${tNode.title || tNode.name || 'Untitled'}" -> ${tNode.description || tNode.content || ''}\n\n` +
          `Determine if a valid connection exists. Output JSON: {"connected": boolean, "relationship": string, "label": string, "explanation": string}`
        );
      }
    } else {
      const docName = inputPayload.file_name || inputPayload.document_name || inputPayload.file?.name || '';
      const docNodeId = inputPayload.document_node_id || inputPayload.doc_id || inputPayload.nodeId || '';
      const upstreamSynthesis = inputPayload.agent_synthesis || inputPayload.synthesis || '';
      const hasRawFile = Boolean(inputPayload.file || inputPayload.file_bytes_b64 || inputPayload.include_raw_file);
      const textContent = inputPayload.extracted_text || (hasRawFile ? inputPayload.text : '') || '';

      const isVisionAgent =
        targetTitle?.toLowerCase().includes('vision') ||
        modelId?.toLowerCase().includes('vision') ||
        Boolean(inputPayload.is_vision || inputPayload.escalation?.needs_vision_model);

      if (inputPayload.description || inputPayload.content) {
        promptParts.push(`Node Description / Content:\n${inputPayload.description || inputPayload.content}`);
      }
      if (inputPayload.node_text && inputPayload.node_text !== inputPayload.description) {
        promptParts.push(`Canvas node (the input for this run):\n${inputPayload.node_text}`);
      }

      if (agentPrompt && agentPrompt.trim()) {
        promptParts.push(`Primary Assignment / Instructions:\n${agentPrompt.trim()}`);
      }

      if (docNodeId || (docName && docName !== 'Document')) {
        promptParts.push(docNodeId ? `Source Document: ${docName || 'Document'} (Canvas Node ID: "${docNodeId}")` : `Source Document: ${docName}`);
      }

      if (upstreamSynthesis) {
        promptParts.push(`Upstream Analysis & Key Findings:\n${upstreamSynthesis}`);
      }
      if (textContent) {
        promptParts.push(`Extracted Document Content:\n${textContent.slice(0, 15000)}`);
      }
      if (inputPayload.metadata && Object.keys(inputPayload.metadata).length > 0) {
        promptParts.push(
          'Input Metadata:\n' +
            Object.entries(inputPayload.metadata)
              .map(([k, v]) => `- ${k}: ${v}`)
              .join('\n')
        );
      }

      // Input target node context for manual workflow execution on canvas node
      if (inputPayload.triggerType === 'manual' && (inputPayload.node || inputPayload.sourceNode)) {
        const tn = inputPayload.node || inputPayload.sourceNode;
        promptParts.push(
          `Target Node in Focus (Input):\n` +
            `- ID: "${tn.id}"\n` +
            `- Title: "${tn.title || tn.name || 'Untitled'}"\n` +
            `- Type: "${tn.type || 'finding'}"\n` +
            (tn.description ? `- Description/Content: "${tn.description}"\n` : '') +
            (tn.metadata && Object.keys(tn.metadata).length > 0 ? `- Metadata: ${JSON.stringify(tn.metadata)}\n` : '')
        );
      }

      // If general structured context exists without standard doc fields, format cleanly
      if (!textContent && !upstreamSynthesis && !docNodeId) {
        const sanitizedContext = sanitizeContextForPrompt(inputPayload);
        if (Object.keys(sanitizedContext).length > 0) {
          promptParts.push(`Context Data:\n${JSON.stringify(sanitizedContext, null, 2)}`);
        }
      }

      if (isLastTurn) {
        promptParts.push('This is your final turn. Create the missing nodes now with create_nodes, or, if the canvas already has everything, reply with your summary and call no tools.');
      }

      // The canvas as it was at the start of the run (read by the runner, not by the model).
      if (canvasState) {
        promptParts.push(`Current canvas (already read for you; do not re-query it before creating):\n${canvasState}`);
      }

      // Earlier turns of this same run: what the model said and did, so it does not start over.
      if (Array.isArray(progress) && progress.length > 0) {
        const done = progress
          .map((t) => {
            const said = t.said ? `You said: "${t.said.slice(0, 400)}"\n` : '';
            return `Turn ${t.turn}:\n${said}Actions:\n${t.actions.map((a) => `- ${a}`).join('\n')}`;
          })
          .join('\n\n');
        promptParts.push(
          `Progress so far in this run (these actions are already DONE on the canvas):\n${done}\n\n` +
          `Do not repeat or recreate anything listed above. Compare it with your assignment: if something is still missing, do only the remaining steps; if the assignment is complete, reply with a short summary and call no tools.`
        );
      }

      if (isVisionAgent) {
        promptParts.push(`Please visually transcribe and analyze the attached document: "${docName || 'Document'}". Extract all visible text, headings, figures, tables, and visual structure in detail.`);
      } else if (tools && tools.length > 0) {
        const toolNames = tools.map((t) => t.function?.name || t.name);
        const hasBatch = toolNames.includes('create_nodes');
        const hasLifecycle = hasBatch || toolNames.includes('create_node');

        let toolGuidance = '';
        if (hasLifecycle) {
          const createAction = hasBatch
            ? 'call the "create_nodes" tool with an array of nodes to create them all simultaneously in batch'
            : 'call the "create_node" tool to populate the canvas';
          const connectInstruction = docNodeId
            ? `\nConnection Directive: When creating nodes linked to the document, set connect_to_source_id: "${docNodeId}". If creating subtopics under parent topics, set connect_to_source_id: "<topic_node_id>".`
            : '';
          toolGuidance = `Please fulfill the assignment instructions above. You can ${createAction} as requested.${connectInstruction}`;
        } else {
          toolGuidance = `Please fulfill the assignment instructions above and invoke any appropriate tools as needed.`;
        }
        promptParts.push(toolGuidance);
      } else {
        promptParts.push('Please analyze the provided context thoroughly and carry out your assignment.');
      }
    }
    const promptText = promptParts.join('\n\n');

    const res = await fetch('http://127.0.0.1:8001/api/agents/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId || 'muse-wonder-1.0',
        system_prompt: systemPrompt || 'You are an AI research assistant.',
        prompt: promptText,
        temperature: temperature ?? 0.2,
        reasoning_effort: reasoningEffort || 'minimal',
        input_data: inputPayload,
        tools: tools || undefined,
        include_file: Boolean(inputPayload.file || inputPayload.file_bytes_b64 || inputPayload.include_raw_file || inputPayload.image_path),
        image_path: inputPayload.image_path || undefined,
      }),
    });

    const elapsed = Math.round(performance.now() - start);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (res.status === 200 && data.status === 'success') {
      return {
        status: 'success',
        httpCode: 200,
        output: data.output,
        response: data.response,
        durationMs: data.duration_ms || elapsed,
      };
    }

    const pythonError = data.error || `Agent model call returned HTTP ${res.status}`;

    // Fallback: If agent runner failed, try calling python chat completion on local server
    try {
      const directMessages = [
        { role: 'system', content: systemPrompt || 'You are an AI research assistant.' },
        { role: 'user', content: promptText },
      ];
      const directTools = Array.isArray(tools) && tools.length > 0 ? tools : undefined;
      const directRes = await fetch('http://127.0.0.1:8001/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId || 'muse-spark-1.3',
          messages: directMessages,
          tools: directTools,
          ...(modelId?.startsWith('muse-spark') || modelId?.startsWith('muse-wonder') ? { reasoning_effort: 'minimal' } : {}),
        }),
      });

      if (directRes.ok) {
        const directData = await directRes.json();
        const choice = directData.choices?.[0];
        const msg = choice?.message || {};
        const replyText = (msg.content || '').trim();
        const tCalls = msg.tool_calls || [];
        return {
          status: 'success',
          httpCode: 200,
          output: {
            text: replyText,
            tool_calls: tCalls,
            model: directData.model || modelId,
          },
          response: replyText,
          durationMs: Math.round(performance.now() - start),
          server: 'local-python-chat',
        };
      }
    } catch (fallbackErr) {
      console.warn('Local Python chat fallback failed:', fallbackErr);
    }

    return {
      status: 'error',
      httpCode: res.status,
      error: pythonError,
      durationMs: data.duration_ms || elapsed,
    };
  } catch (err) {
    return {
      status: 'error',
      httpCode: 503,
      error: `Local Python server offline: ${err.message || 'Cannot connect to http://127.0.0.1:8001'}`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}

function evaluateCondition(conditionStr, payload) {
  if (!conditionStr || !conditionStr.trim()) return true;
  const expr = conditionStr.trim();

  const fileName = payload.file?.name || payload.file_name || payload.name || '';
  const isBlocked = /\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v|gif)$/i.test(fileName);
  if (isBlocked) {
    return false;
  }

  const rawCat = payload.category || (
    /\.(pdf|docx?|txt|rtf|md|csv|tsv|json|log)$/i.test(fileName) ? 'document' :
    /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(fileName) ? 'image' :
    /\.(mp3|wav|ogg|m4a|flac)$/i.test(fileName) ? 'audio' : 'document'
  );

  // Normalize document-like categories: text, code, tabular, document are all parseable by document_extractor
  const isDocLike = ['document', 'text', 'tabular', 'code'].includes(rawCat);

  // Escalation match: e.g. escalation.needs_vision_model == False / True
  const escMatch = expr.match(/escalation\.needs_vision_model\s*==\s*(True|False|true|false)/i);
  if (escMatch) {
    const expected = escMatch[1].toLowerCase() === 'true';
    const actual = Boolean(payload.escalation?.needs_vision_model);
    return actual === expected;
  }

  // If thread requires document, treat all doc-like files (txt, md, csv, docx, pdf) as satisfying it
  if (/category\s*==\s*['"]document['"]/.test(expr) || expr.includes('document')) {
    if (isDocLike) return true;
  }
  if (/category\s*==\s*['"]image['"]/.test(expr)) {
    return rawCat === 'image';
  }
  if (/category\s*==\s*['"]audio['"]/.test(expr)) {
    return rawCat === 'audio';
  }

  try {
    const sanitized = expr
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bcategory\s+in\s+\[(.*?)\]/g, '[$1].includes(category)');
    const fn = new Function('data', `with(data) { return Boolean(${sanitized}); }`);
    return fn({ ...payload, category: rawCat });
  } catch {
    return isDocLike;
  }
}

/**
 * Executes a full workflow graph triggered by file drop or node connect.
 */
export async function executeWorkflow({
  workflowId,
  workflowData,
  project,
  triggerPayload: rawTriggerPayload,
  onProgress,
  onExecuteTool,
}) {
  const triggerPayload = {
    triggerType: 'manual',
    triggerLabel: `manual: ${workflowId || 'workflow'}`,
    ...(rawTriggerPayload || {}),
  };
  if (!triggerPayload.triggerLabel) {
    triggerPayload.triggerLabel = `${triggerPayload.triggerType || 'manual'}: ${workflowId || 'workflow'}`;
  }

  const wfNodes = workflowData?.nodes || {};
  const wfThreads = Array.isArray(workflowData?.threads)
    ? workflowData.threads
    : Object.values(workflowData?.threads || {});

  const runStartTime = Date.now();
  const runId = `run_${workflowId || 'wf'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Guard: if workflow is empty (0 nodes), report failure immediately so red special thread is kept
  if (!wfNodes || Object.keys(wfNodes).length === 0) {
    const totalDuration = ((Date.now() - runStartTime) / 1000).toFixed(2);
    const runRecord = {
      id: runId,
      workflowId,
      workflowName:
        workflowId === 'extraction'
          ? 'Extraction Pipeline'
          : workflowId === 'connection_synthesis'
          ? 'Connection Synthesis'
          : workflowId,
      trigger: triggerPayload.triggerLabel || `${triggerPayload.triggerType}`,
      triggerType: triggerPayload.triggerType,
      status: 'failed',
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      duration: `${totalDuration}s`,
      nodes: {},
      threads: {},
      createdNodeIds: [],
      error: 'Empty workflow: no executable nodes configured.',
    };
    onProgress?.(runRecord);
    return runRecord;
  }

  // Build clean run nodes map matching the fixed visual layout
  const runNodes = {};
  Object.entries(wfNodes).forEach(([nId, node]) => {
    runNodes[nId] = {
      // Keep the node's full configuration (systemPrompt, temperature, reasoningEffort, contextSources,
      // tools, engineTools, ...). The run reads these from runNodes; copying only a few fields made every
      // agent ignore its prompt, context toggles and tool access.
      ...node,
      id: nId,
      title: node.title || nId,
      sub: node.sub || node.engineId || node.modelName || '',
      type: node.type || 'engine',
      engineId: node.engineId,
      modelId: node.modelId,
      inputSource: node.inputSource,
      x: node.x ?? 100,
      y: node.y ?? 160,
      width: node.width ?? 175,
      height: node.height ?? 56,
      status: 'pending',
      inputData: null,
      processInfo: null,
      outputData: null,
    };
  });

  // Build clean run threads map
  const runThreads = {};
  wfThreads.forEach((th, idx) => {
    const startId = th.from || th.startNodeId;
    const endId = th.to || th.endNodeId;
    const thId = th.id || `th_${idx + 1}`;
    runThreads[thId] = {
      id: thId,
      startNodeId: startId,
      endNodeId: endId,
      condition: th.condition || '',
      status: 'pending',
    };
  });

  const runRecord = {
    id: runId,
    workflowId,
    workflowName:
      workflowId === 'extraction'
        ? 'Extraction Pipeline'
        : workflowId === 'connection_synthesis'
        ? 'Connection Synthesis'
        : workflowId,
    trigger: triggerPayload.triggerLabel || `${triggerPayload.triggerType}`,
    triggerType: triggerPayload.triggerType,
    status: 'running',
    startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    duration: '0.00s',
    nodes: runNodes,
    threads: runThreads,
  };

  onProgress?.(runRecord);

  // Retain initialPayload permanently across all node runs
  const rawFile = triggerPayload.file || {};
  const fileName = rawFile.name || triggerPayload.file_name || triggerPayload.node?.title || 'document';
  const detectedCategory = (
    /\.(pdf|docx?|txt|rtf|md|csv)$/i.test(fileName) ? 'document' :
    /\.(png|jpe?g|webp|bmp)$/i.test(fileName) ? 'image' :
    /\.(mp3|wav|ogg|m4a|flac)$/i.test(fileName) ? 'audio' : 'document'
  );

  const inputConfigMeta = wfNodes.input?.inputMetadata || {};
  const mergedMetadata = {
    ...(triggerPayload.metadata || {}),
    ...inputConfigMeta,
  };

  const initialPayload = {
    file: rawFile,
    file_name: fileName,
    name: fileName,
    doc_id: rawFile.doc_id || triggerPayload.doc_id || triggerPayload.nodeId || '',
    document_node_id: rawFile.doc_id || triggerPayload.doc_id || triggerPayload.nodeId || '',
    size_bytes: rawFile.size || triggerPayload.size_bytes || 0,
    mime_type: rawFile.type || 'application/octet-stream',
    file_bytes_b64: rawFile.b64 || rawFile.file_bytes_b64 || triggerPayload.file_bytes_b64 || '',
    cloudinaryUrl: rawFile.cloudinaryUrl || triggerPayload.cloudinaryUrl || '',
    category: detectedCategory,
    metadata: mergedMetadata,
    ...mergedMetadata,
    sourceNode: triggerPayload.sourceNode,
    targetNode: triggerPayload.targetNode,
    source_node: triggerPayload.source_node || triggerPayload.sourceNode,
    target_node: triggerPayload.target_node || triggerPayload.targetNode,
    node_pair: triggerPayload.node_pair || (
      (triggerPayload.sourceNode || triggerPayload.source_node)
        ? {
            source_node: triggerPayload.source_node || triggerPayload.sourceNode,
            target_node: triggerPayload.target_node || triggerPayload.targetNode,
            exploration_id: triggerPayload.exploration_id || triggerPayload.explorationId || 'exploration_01',
          }
        : null
    ),
    exploration_id: triggerPayload.exploration_id || triggerPayload.explorationId || 'exploration_01',
    timestamp: new Date().toISOString(),
  };

  const nodeDesc =
    triggerPayload.description ||
    triggerPayload.content ||
    triggerPayload.source_text ||
    triggerPayload.text ||
    triggerPayload.node?.description ||
    triggerPayload.node?.content ||
    triggerPayload.node?.text ||
    triggerPayload.sourceNode?.description ||
    triggerPayload.sourceNode?.content ||
    triggerPayload.sourceNode?.text ||
    '';

  const nodeTitle =
    triggerPayload.node?.title ||
    triggerPayload.node?.name ||
    triggerPayload.sourceNode?.title ||
    triggerPayload.sourceNode?.name ||
    triggerPayload.title ||
    '';

  if (nodeDesc) {
    initialPayload.description = nodeDesc;
    initialPayload.content = nodeDesc;
    initialPayload.source_text = nodeDesc;
    initialPayload.text = nodeDesc;
  }

  // A manual run on a canvas node: the node's title and description are the input text for every step.
  if (triggerPayload.triggerType === 'manual') {
    const n = triggerPayload.node || triggerPayload.sourceNode || {};
    const nTitle = n.title || n.name || nodeTitle;
    const nDesc = n.description || n.content || n.text || nodeDesc;
    initialPayload.description = nDesc;
    initialPayload.content = nDesc;
    initialPayload.source_text = nDesc;
    initialPayload.text = nDesc;
    initialPayload.node_text = [nTitle, nDesc].filter(Boolean).join('\n\n');
  }

  const customText = triggerPayload.text || triggerPayload.source_text || triggerPayload.extracted_text || triggerPayload.prompt || '';
  if (customText) {
    initialPayload.text = customText;
    initialPayload.extracted_text = customText;
    if (!initialPayload.description) {
      initialPayload.description = customText;
      initialPayload.content = customText;
      initialPayload.source_text = customText;
    }
  }

  let currentPayload = { ...initialPayload };
  const allCreatedNodeIds = [];

  // Step 1: Input Node
  const inputNode = runNodes.input || Object.values(runNodes).find((n) => n.type === 'input');

  if (inputNode) {
    inputNode.status = 'running';
    onProgress?.(runRecord);

    await new Promise((r) => setTimeout(r, 120));

    inputNode.status = 'completed';
    if (triggerPayload.triggerType === 'manual') {
      const targetNodeData = triggerPayload.node || triggerPayload.sourceNode || {};
      inputNode.inputData = {
        trigger: 'manual',
        node_id: targetNodeData.id || triggerPayload.nodeId,
        node_title: targetNodeData.title || targetNodeData.name || 'Node',
        node_type: targetNodeData.type || 'finding',
        timestamp: currentPayload.timestamp,
        ...(targetNodeData.metadata ? { metadata: targetNodeData.metadata } : {}),
      };
      inputNode.processInfo = {
        step: `Manual run initiated on node "${targetNodeData.title || targetNodeData.id}"`,
        executionTime: '8ms',
      };
      inputNode.outputData = {
        status: 'accepted',
        trigger: 'manual',
        node_id: targetNodeData.id || triggerPayload.nodeId,
        exploration_id: initialPayload.exploration_id,
        ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {}),
      };
    } else {
      inputNode.inputData = {
        trigger: triggerPayload.triggerType,
        file_name: fileName,
        size_bytes: rawFile.size || 0,
        timestamp: currentPayload.timestamp,
        ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {}),
      };
      inputNode.processInfo = {
        step: `Event '${triggerPayload.triggerType}' received and queued for processing`,
        executionTime: '12ms',
      };
      inputNode.outputData = {
        category: detectedCategory,
        file_name: fileName,
        status: 'accepted',
        source_node: initialPayload.source_node,
        target_node: initialPayload.target_node,
        sourceNode: initialPayload.sourceNode,
        targetNode: initialPayload.targetNode,
        node_pair: initialPayload.node_pair,
        exploration_id: initialPayload.exploration_id,
        ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {}),
      };
    }
    onProgress?.(runRecord);
  }

  // Find execution order from input node outwards checking thread conditions
  const visited = new Set(['input']);
  const queue = Object.values(runThreads)
    .filter((th) => th.startNodeId === 'input' || th.startNodeId === inputNode?.id)
    .map((th) => ({ thread: th, targetId: th.endNodeId }));

  let hasFailed = false;
  let lastAgentOutput = null; // the last agent step's output: becomes the run's result when it creates no canvas nodes

  while (queue.length > 0) {
    const { thread, targetId } = queue.shift();
    const targetNode = runNodes[targetId];

    if (!targetNode || visited.has(targetId)) continue;

    // Check if the thread condition matches the payload
    const isConditionMet = evaluateCondition(thread.condition, currentPayload);
    if (!isConditionMet) {
      thread.status = 'skipped';
      // Only mark targetNode skipped if no other pending incoming paths exist
      const incomingThreads = Object.values(runThreads).filter((th) => th.endNodeId === targetId);
      const allIncomingInactive = incomingThreads.every((th) => th.status === 'skipped');
      if (allIncomingInactive) {
        targetNode.status = 'skipped';
      }
      onProgress?.(runRecord);
      continue;
    }

    visited.add(targetId);

    thread.status = 'running';
    targetNode.status = 'running';
    onProgress?.(runRecord);

    const stepStart = performance.now();

    // Context Scoping: Determine input data based on node.contextSources or legacy node.inputSource
    const contextSources = targetNode.contextSources;
    let activeNodeInput;
    let sourceScope = targetNode.inputSource || 'both';

    if (contextSources && typeof contextSources === 'object') {
      activeNodeInput = {};
      const { inputFile, inputMetadata, previousOutput, previousMetadata } = contextSources;

      if (inputMetadata) {
        activeNodeInput.doc_id = initialPayload.doc_id;
        activeNodeInput.file_name = initialPayload.file_name || initialPayload.name;
        activeNodeInput.document_name = initialPayload.document_name || initialPayload.file_name || initialPayload.name;
        activeNodeInput.category = initialPayload.category;
        activeNodeInput.size_bytes = initialPayload.size_bytes;
        activeNodeInput.mime_type = initialPayload.mime_type;
        activeNodeInput.document_node_id = initialPayload.document_node_id || initialPayload.doc_id;
        activeNodeInput.metadata = { ...(initialPayload.metadata || {}) };
        if (initialPayload.description) activeNodeInput.description = initialPayload.description;
        if (initialPayload.content) activeNodeInput.content = initialPayload.content;
        if (initialPayload.source_text) activeNodeInput.source_text = initialPayload.source_text;
        if (initialPayload.node_text) activeNodeInput.node_text = initialPayload.node_text;
        if (initialPayload.text) activeNodeInput.text = initialPayload.text;
      }

      if (previousOutput) {
        const { file, file_bytes_b64, file_path, local_path, cloudinaryUrl, raw_file, binary, ...safePrevOutputs } = currentPayload;
        Object.assign(activeNodeInput, safePrevOutputs);
      }

      if (inputFile) {
        activeNodeInput.file = initialPayload.file;
        activeNodeInput.file_bytes_b64 = initialPayload.file_bytes_b64;
        activeNodeInput.file_path = initialPayload.file_path || initialPayload.local_path;
        activeNodeInput.local_path = initialPayload.local_path || initialPayload.file_path;
        activeNodeInput.cloudinaryUrl = initialPayload.cloudinaryUrl;
        if (initialPayload.text) activeNodeInput.text = initialPayload.text;
        if (initialPayload.description) activeNodeInput.description = initialPayload.description;
        if (initialPayload.content) activeNodeInput.content = initialPayload.content;
        if (initialPayload.source_text) activeNodeInput.source_text = initialPayload.source_text;
        if (initialPayload.node_text) activeNodeInput.node_text = initialPayload.node_text;
      } else {
        delete activeNodeInput.file;
        delete activeNodeInput.file_bytes_b64;
        delete activeNodeInput.file_path;
        delete activeNodeInput.local_path;
        delete activeNodeInput.cloudinaryUrl;
        delete activeNodeInput.raw_file;
      }

      if (previousMetadata) {
        activeNodeInput.escalation = currentPayload.escalation;
        activeNodeInput.confidence = currentPayload.confidence;
        activeNodeInput.previous_metadata = {
          step: currentPayload.step,
          durationMs: currentPayload.durationMs,
          escalation: currentPayload.escalation,
        };
      } else {
        delete activeNodeInput.escalation;
        delete activeNodeInput.confidence;
        delete activeNodeInput.previous_metadata;
      }

      if (inputMetadata || inputFile) {
        activeNodeInput.doc_id = activeNodeInput.doc_id || initialPayload.doc_id || currentPayload.doc_id;
        activeNodeInput.file_name = activeNodeInput.file_name || initialPayload.file_name || currentPayload.file_name;
        if (initialPayload.description && !activeNodeInput.description) activeNodeInput.description = initialPayload.description;
        if (initialPayload.content && !activeNodeInput.content) activeNodeInput.content = initialPayload.content;
        if (initialPayload.source_text && !activeNodeInput.source_text) activeNodeInput.source_text = initialPayload.source_text;
        if (initialPayload.node_text && !activeNodeInput.node_text) activeNodeInput.node_text = initialPayload.node_text;
      }
      sourceScope = inputFile && previousOutput ? 'both' : (inputFile ? 'original' : 'previous');
    } else {
      const isVisionAgent =
        targetNode.title?.toLowerCase().includes('vision') ||
        targetNode.modelId?.toLowerCase().includes('vision') ||
        targetNode.modelId?.toLowerCase().includes('spark') ||
        Boolean(targetNode.is_vision);

      sourceScope = targetNode.inputSource || (
        (targetNode.id === 'engine_bridge' || targetNode.id === 'engine_1') ? 'original' :
        (targetNode.type === 'agent' ? (isVisionAgent ? 'both' : 'previous') : 'previous')
      );

      if (sourceScope === 'original') {
        activeNodeInput = { ...initialPayload };
      } else if (sourceScope === 'both') {
        activeNodeInput = {
          ...initialPayload,
          ...currentPayload,
          description: currentPayload.description || initialPayload.description,
          content: currentPayload.content || initialPayload.content,
          node_text: currentPayload.node_text || initialPayload.node_text,
          source_text: currentPayload.source_text || initialPayload.source_text,
          text: currentPayload.text || initialPayload.text,
          doc_id: initialPayload.doc_id || currentPayload.doc_id,
          file: initialPayload.file || currentPayload.file,
          file_name: initialPayload.file_name || currentPayload.file_name,
          name: initialPayload.name || currentPayload.name,
          file_bytes_b64: initialPayload.file_bytes_b64 || currentPayload.file_bytes_b64,
          cloudinaryUrl: initialPayload.cloudinaryUrl || currentPayload.cloudinaryUrl,
          size_bytes: initialPayload.size_bytes || currentPayload.size_bytes,
          category: initialPayload.category || currentPayload.category,
          initial_input: initialPayload,
          previous_output: currentPayload,
        };
      } else {
        // 'previous': Only pass upstream outputs + metadata, strictly strip raw file bytes and raw binary
        const { file, file_bytes_b64, file_path, local_path, cloudinaryUrl, raw_file, binary, ...safePrevOutputs } = currentPayload;
        activeNodeInput = {
          ...safePrevOutputs,
          description: currentPayload.description || initialPayload.description,
          content: currentPayload.content || initialPayload.content,
          node_text: currentPayload.node_text || initialPayload.node_text,
          source_text: currentPayload.source_text || initialPayload.source_text,
          text: currentPayload.text || initialPayload.text,
          doc_id: currentPayload.doc_id || initialPayload.doc_id,
          file_name: currentPayload.file_name || initialPayload.file_name,
          document_name: currentPayload.document_name || initialPayload.document_name || initialPayload.file_name,
          category: currentPayload.category || initialPayload.category,
          size_bytes: currentPayload.size_bytes || initialPayload.size_bytes,
          source_node: currentPayload.source_node || initialPayload.source_node,
          target_node: currentPayload.target_node || initialPayload.target_node,
          sourceNode: currentPayload.sourceNode || initialPayload.sourceNode,
          targetNode: currentPayload.targetNode || initialPayload.targetNode,
          node_pair: currentPayload.node_pair || initialPayload.node_pair,
          exploration_id: currentPayload.exploration_id || initialPayload.exploration_id,
          metadata: { ...(initialPayload.metadata || {}) },
        };
      }
    }

    if (targetNode.type === 'engine') {
      const engId = targetNode.engineId || targetNode.title;
      const engineCode = getEngineInitialCode(engId, project?.enginesData);

      // Micro-delay so UI shows live execution sequence
      await new Promise((r) => setTimeout(r, 180));

      const res = await executePythonEngine(engineCode, activeNodeInput);

      if (res.status === 'success') {
        // HTTP 200: Engine completed successfully
        targetNode.status = 'completed';
        thread.status = 'completed';
        const engineText =
          activeNodeInput.description ||
          activeNodeInput.content ||
          activeNodeInput.extracted_text ||
          activeNodeInput.text ||
          '';
        const engineDesc =
          activeNodeInput.description ||
          activeNodeInput.content ||
          activeNodeInput.source_text ||
          (engineText.trim() ? engineText : '');

        targetNode.inputData = {
          document: activeNodeInput.file_name || activeNodeInput.document_name,
          ...(engineDesc ? { description: engineDesc, source_text: engineDesc } : {}),
          category: activeNodeInput.category,
          size_bytes: activeNodeInput.size_bytes,
          input_source: sourceScope,
        };
        targetNode.processInfo = {
          step: `Engine '${engId}' completed successfully (HTTP 200) [source: ${sourceScope}]`,
          executionTime: `${res.durationMs}ms`,
        };
        targetNode.outputData = res.output;
        currentPayload = {
          ...currentPayload,
          ...res.output,
          file_path: res.output?.file_path || res.output?.local_path || currentPayload.file_path,
          local_path: res.output?.local_path || res.output?.file_path || currentPayload.local_path,
          escalation: res.output?.escalation || { needs_vision_model: false },
        };
        if (res.output?.local_path || res.output?.file_path) {
          initialPayload.local_path = res.output.local_path || res.output.file_path;
          initialPayload.file_path = res.output.file_path || res.output.local_path;
        }
      } else {
        // Non-200 (4xx, 5xx): Engine validation or execution failed
        targetNode.status = 'failed';
        thread.status = 'failed';
        targetNode.inputData = {
          document: activeNodeInput.file_name || activeNodeInput.document_name,
          category: activeNodeInput.category,
          size_bytes: activeNodeInput.size_bytes,
          input_source: sourceScope,
        };
        const failureReason = res.error || `Engine returned HTTP ${res.httpCode || 500}`;
        targetNode.processInfo = {
          step: `Engine execution halted (HTTP ${res.httpCode || 500}): ${failureReason}`,
          executionTime: `${res.durationMs || 0}ms`,
          error: failureReason,
        };
        targetNode.outputData = res.output || null;
        hasFailed = true;
        onProgress?.(runRecord);
        break;
      }
    } else if (targetNode.type === 'agent') {
      const agentModelId =
        targetNode.modelId ||
        (targetNode.title?.toLowerCase().includes('vision')
          ? 'muse-spark-1.3'
          : targetNode.title?.toLowerCase().includes('voice')
          ? 'muse-voice-transcribe-1.0'
          : 'muse-wonder-1.0');

      // 1. Tool availability: Default tools enabled across all workflows unless explicitly false
      const isToolAccessEnabled =
        typeof targetNode.tools === 'boolean'
          ? targetNode.tools
          : true;

      let effectiveAgentTools = undefined;
      if (isToolAccessEnabled) {
        let toolPool = [...ALL_AGENT_TOOLS];
        if (targetNode.engineTools === true || targetNode.toolNamespaces?.includes('engine')) {
          toolPool.push(...ENGINE_AGENT_TOOLS);
        }
        if (targetNode.workflowTools === true || targetNode.toolNamespaces?.includes('workflow')) {
          toolPool.push(...getWorkflowAgentTools());
        }

        if (Array.isArray(targetNode.selectedTools) && targetNode.selectedTools.length > 0) {
          const selectedSet = new Set(targetNode.selectedTools);
          effectiveAgentTools = toolPool.filter((t) => selectedSet.has(t.function?.name || t.name));
        } else {
          effectiveAgentTools = toolPool;
        }
      }

      const targetExploration = project?.currentExploration || 'exploration_01';
      const expNodes =
        project?.explorationsData?.[targetExploration]?.nodes ||
        project?.nodes ||
        {};
      const docName =
        activeNodeInput.document_name ||
        activeNodeInput.file_name ||
        activeNodeInput.file?.name ||
        'Document';

      let resolvedDocNodeId =
        activeNodeInput.document_node_id ||
        activeNodeInput.doc_id ||
        activeNodeInput.nodeId ||
        '';

      const wantsFileContext = !contextSources || (contextSources.inputMetadata || contextSources.inputFile);

      if (wantsFileContext && (!resolvedDocNodeId || !expNodes[resolvedDocNodeId])) {
        const foundEntry = Object.entries(expNodes).find(
          ([id, n]) =>
            (n.type === 'document' || n.category === 'resource') &&
            (n.title === docName || n.name === docName || n.fileName === docName)
        );
        if (foundEntry) {
          resolvedDocNodeId = foundEntry[0];
        }
      }

      let effectiveSystemPrompt = targetNode.systemPrompt || 'You are an AI research assistant.';

      if (isToolAccessEnabled) {
        const docDirective = wantsFileContext && resolvedDocNodeId
          ? `The source document "${docName}" is active on the canvas with Node ID: "${resolvedDocNodeId}".`
          : '';

        effectiveSystemPrompt += `\n\nCANVAS ACTION DIRECTIVE: The active exploration canvas is "${targetExploration}".\n${docDirective}\n\n${NODE_INSTRUCTIONS}`;
      }

      if (targetNode.engineTools === true || targetNode.toolNamespaces?.includes('engine')) {
        effectiveSystemPrompt += `\n\n${ENGINE_INSTRUCTIONS}`;
      }

      if (targetNode.workflowTools === true || targetNode.toolNamespaces?.includes('workflow')) {
        effectiveSystemPrompt += `\n\n${WORKFLOW_INSTRUCTIONS}`;
      }

      // The canvas node's own text (manual runs) is the input text, shown in the log as source_text.
      const incomingText =
        activeNodeInput.description ||
        activeNodeInput.content ||
        activeNodeInput.source_text ||
        activeNodeInput.node_text ||
        activeNodeInput.agent_synthesis ||
        activeNodeInput.synthesis ||
        activeNodeInput.extracted_text ||
        activeNodeInput.text ||
        '';

      const agentPayload = {
        ...activeNodeInput,
        document_node_id: resolvedDocNodeId,
        doc_id: resolvedDocNodeId || activeNodeInput.doc_id,
      };

      const executedTools = [];
      const createdNodeIds = [];
      const createdNodeTypes = {}; // id -> type, so the connect step can skip subtopics
      let totalDurationMs = 0;
      let finalSynthesis = '';
      let turnInputPayload = { ...agentPayload };
      const progressLog = [];
      const readsSinceChange = new Set(); // read-only calls made since the last canvas change
      const retiredTools = new Set(); // read-only tools already answered in this run: removed from the agent's tools
      const MAX_AGENT_TURNS = 4;
      let lastSuccessRes = null;

      // Read the canvas once here, so the agent starts with it in its context and spends no turn reading it.
      let canvasSnapshot = '';
      if (isToolAccessEnabled && effectiveAgentTools && onExecuteTool) {
        const snap = await onExecuteTool('canvas_outline', { exploration_id: targetExploration });
        if (snap?.outline) {
          const counts = Object.entries(snap.counts || {}).map(([k, v]) => `${v} ${k}`).join(', ') || 'none';
          canvasSnapshot = `Counts: ${counts}\n${snap.outline}`;
        }
        retiredTools.add('canvas_outline');
      }

      for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
        const res = await executeAgentModel({
          modelId: agentModelId,
          systemPrompt: effectiveSystemPrompt,
          agentPrompt: targetNode.systemPrompt || '',
          temperature: targetNode.temperature,
          reasoningEffort: targetNode.reasoningEffort,
          inputPayload: turnInputPayload,
          targetTitle: targetNode.title,
          tools: withoutTools(effectiveAgentTools, retiredTools),
          progress: progressLog,
          canvasState: canvasSnapshot,
          isLastTurn: turn === MAX_AGENT_TURNS - 1,
        });

        if (res.status !== 'success') {
          if (turn === 0) {
            targetNode.status = 'failed';
            thread.status = 'failed';
            const failureReason = res.error || `Agent execution failed (HTTP ${res.httpCode || 500})`;
            targetNode.error = failureReason;
            targetNode.processInfo = {
              step: `Agent execution failed (HTTP ${res.httpCode || 500}): ${failureReason}`,
              executionTime: `${res.durationMs || 0}ms`,
              error: failureReason,
            };
            hasFailed = true;
            onProgress?.(runRecord);
            break;
          }
          break;
        }

        lastSuccessRes = res;
        totalDurationMs += res.durationMs || 0;

        const currentToolCalls = Array.isArray(res.output?.tool_calls) ? res.output.tool_calls : [];

        if (currentToolCalls.length === 0) {
          finalSynthesis = res.output?.synthesis || res.response || finalSynthesis;
          break;
        }

        const turnToolResults = [];
        for (const tc of currentToolCalls) {
          let parsedArgs = {};
          try {
            parsedArgs = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : (tc.arguments || {});
          } catch {
            parsedArgs = {};
          }
          if (!parsedArgs.exploration_id) {
            parsedArgs.exploration_id = targetExploration;
          }
          if (tc.name === 'create_node' && resolvedDocNodeId && !parsedArgs.connect_to_source_id && !parsedArgs.source_node_id) {
            if (parsedArgs.node_type !== 'subtopic') {
              parsedArgs.connect_to_source_id = resolvedDocNodeId;
            }
          }
          if (tc.name === 'create_nodes' && resolvedDocNodeId) {
            if (Array.isArray(parsedArgs.nodes)) {
              parsedArgs.nodes.forEach((n) => {
                if (!n.connect_to_source_id && !n.source_node_id && n.node_type !== 'subtopic') {
                  n.connect_to_source_id = resolvedDocNodeId;
                }
              });
            }
          }

          const readKey = `${tc.name}:${JSON.stringify(parsedArgs)}`;
          let toolResult;
          if (READ_ONLY_TOOLS.includes(tc.name) && readsSinceChange.has(readKey)) {
            toolResult = { success: true, already_read: true };
            retiredTools.add(tc.name);
          } else {
            toolResult = await onExecuteTool?.(tc.name, parsedArgs);
            if (READ_ONLY_TOOLS.includes(tc.name)) {
              readsSinceChange.add(readKey);
            } else if (toolResult && !toolResult.error) {
              readsSinceChange.clear();
              retiredTools.clear(); // the canvas changed: reads are useful again (one confirmation check)
            }
          }
          if (tc.name === 'create_node' && toolResult?.node?.id) {
            createdNodeIds.push(toolResult.node.id);
            createdNodeTypes[toolResult.node.id] = toolResult.node.type;
            if (!allCreatedNodeIds.includes(toolResult.node.id)) {
              allCreatedNodeIds.push(toolResult.node.id);
            }
          } else if (tc.name === 'create_nodes' && Array.isArray(toolResult?.nodes)) {
            toolResult.nodes.forEach((n) => {
              if (n?.id) {
                createdNodeIds.push(n.id);
                createdNodeTypes[n.id] = n.type;
                if (!allCreatedNodeIds.includes(n.id)) {
                  allCreatedNodeIds.push(n.id);
                }
              }
            });
          }

          executedTools.push({
            toolName: tc.name,
            args: parsedArgs,
            result: toolResult,
          });
          turnToolResults.push({
            toolName: tc.name,
            result: toolResult,
          });
        }

        // Link only unconnected root topic/finding nodes to the source document (never subtopics)
        if (resolvedDocNodeId && createdNodeIds.length > 0) {
          // Ask the live canvas (through the tool layer) whether each new node already has a connection.
          // The project snapshot from run start does not contain nodes created during this run.
          const unconnectedRootIds = [];
          for (const nid of createdNodeIds) {
            if (createdNodeTypes[nid] === 'subtopic') continue;
            const live = await onExecuteTool?.('get_connections', { exploration_id: targetExploration, node_id: nid });
            if (!live?.error && (live?.count || 0) === 0) unconnectedRootIds.push(nid);
          }

          if (unconnectedRootIds.length > 0) {
            const connectRes = await onExecuteTool?.('connect_nodes', {
              exploration_id: targetExploration,
              source_node_id: resolvedDocNodeId,
              target_node_ids: unconnectedRootIds,
              relationship_type: 'derives_from',
              description: `Extracted topics and findings derived from ${docName}`,
            });
            if (connectRes?.connected) {
              executedTools.push({
                toolName: 'connect_nodes',
                args: { source_node_id: resolvedDocNodeId, target_node_ids: unconnectedRootIds },
                result: connectRes,
              });
            }
          }
        }

        if (res.output?.synthesis || res.response) {
          finalSynthesis = res.output?.synthesis || res.response;
        }

        // Record this turn so the next request shows the model what it already did.
        progressLog.push({
          turn: turn + 1,
          said: (res.output?.synthesis || res.response || '').trim(),
          actions: currentToolCalls.map((tc, i) => {
            const executed = executedTools[executedTools.length - currentToolCalls.length + i];
            return summarizeToolAction(tc.name, executed?.args, executed?.result);
          }),
        });
      }

      if (hasFailed) {
        break;
      }

      targetNode.status = 'completed';
      thread.status = 'completed';
      const agentDesc =
        activeNodeInput.description ||
        activeNodeInput.content ||
        activeNodeInput.source_text ||
        (typeof incomingText === 'string' && incomingText.trim() ? incomingText : '');

      targetNode.inputData = {
        document: activeNodeInput.document_name || activeNodeInput.file_name || activeNodeInput.file?.name,
        ...(agentDesc ? { description: agentDesc, source_text: agentDesc } : {}),
        category: activeNodeInput.category,
        input_source: sourceScope,
      };

      const toolNote = executedTools.length > 0
        ? ` [invoked ${executedTools.length} tool(s): ${executedTools.map((t) => t.toolName).join(', ')}]`
        : '';

      targetNode.processInfo = {
        step: `Agent '${targetNode.title}' executed via Meta API (${agentModelId}) (HTTP 200)${toolNote} [source: ${sourceScope}]`,
        executionTime: `${totalDurationMs}ms`,
      };

      if (!finalSynthesis && lastSuccessRes) {
        finalSynthesis =
          lastSuccessRes.output?.synthesis ||
          lastSuccessRes.output?.agent_synthesis ||
          lastSuccessRes.output?.text ||
          lastSuccessRes.response ||
          (executedTools.length > 0
            ? `Synthesized document findings and executed ${executedTools.length} action(s) on exploration canvas '${targetExploration}'.`
            : `Synthesis completed by ${targetNode.title}.`);
      }

      targetNode.outputData = {
        ...(lastSuccessRes?.output || {}),
        synthesis: finalSynthesis,
        agent_synthesis: finalSynthesis,
        executedTools,
      };
      // The image stays on this step's output; it is not merged into what later steps receive.
      const { image_data_url: _image, ...textOutputs } = targetNode.outputData;
      void _image;
      currentPayload = { ...currentPayload, ...textOutputs };
      lastAgentOutput = targetNode.outputData;
    } else if (targetNode.type === 'output') {
      await new Promise((r) => setTimeout(r, 140));
      targetNode.status = 'completed';
      thread.status = 'completed';
      targetNode.inputData = {
        topics: currentPayload.topics || [currentPayload.file_name],
        synthesis: currentPayload.agent_synthesis || 'Verified',
      };
      targetNode.processInfo = {
        step: 'Output synchronized to exploration graph and synthesis registry',
        executionTime: `${Math.round(performance.now() - stepStart)}ms`,
      };
      targetNode.outputData = {
        status: 'verified',
        updated_at: new Date().toISOString(),
      };
    }

    onProgress?.(runRecord);

    // Queue next connected nodes along the graph
    Object.values(runThreads)
      .filter((th) => th.startNodeId === targetId)
      .forEach((nextTh) => {
        queue.push({ thread: nextTh, targetId: nextTh.endNodeId });
      });
  }

  // Finalize run
  const totalDuration = ((Date.now() - runStartTime) / 1000).toFixed(2);
  const hasExecutableDownstream = Object.values(runNodes).some((n) => n.type === 'agent' || n.type === 'engine');
  if (!hasExecutableDownstream) {
    hasFailed = true;
  }
  runRecord.status = hasFailed ? 'failed' : 'completed';
  runRecord.duration = `${totalDuration}s`;
  runRecord.createdNodeIds = allCreatedNodeIds;
  if (lastAgentOutput && (lastAgentOutput.synthesis || lastAgentOutput.image_path)) {
    runRecord.resultOutput = {
      text: lastAgentOutput.synthesis || '',
      image_path: lastAgentOutput.image_path || '',
    };
  }
  onProgress?.(runRecord);

  return runRecord;
}
