import { getEngineInitialCode } from '../components/Engines/EnginesPage';
import { DEFAULT_WORKFLOWS } from './workflowTemplates';
import { NODE_LIFECYCLE_DEFINITIONS, NODE_INSTRUCTIONS } from '../tools/nodeLifecycleTools';
import { ENGINE_TOOL_DEFINITIONS, ENGINE_INSTRUCTIONS } from '../tools/engine';

const toApiTool = (tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
});

const ALL_AGENT_TOOLS = NODE_LIFECYCLE_DEFINITIONS.map(toApiTool);
// Engine tools are opt-in per agent node (node.engineTools === true) so default workflows never create engines unprompted.
const ENGINE_AGENT_TOOLS = ENGINE_TOOL_DEFINITIONS.map(toApiTool);

/**
 * Finds the workflow configured for a specific trigger type.
 * Defaults to 'extraction' for file_drop and 'connection_synthesis' for node_connect.
 */
export function findWorkflowForTrigger(project, triggerType) {
  const workflowsData = project?.workflowsData || {};
  for (const [wfId, wf] of Object.entries(workflowsData)) {
    if (wf?.nodes?.input?.trigger === triggerType) {
      return { id: wfId, data: wf };
    }
  }

  // Fallbacks based on predefined blueprints
  if (triggerType === 'file_drop') {
    return {
      id: 'extraction',
      data: workflowsData.extraction || DEFAULT_WORKFLOWS.extraction,
    };
  }
  if (triggerType === 'node_connect') {
    return {
      id: 'connection_synthesis',
      data: workflowsData.connection_synthesis || DEFAULT_WORKFLOWS.connection_synthesis,
    };
  }

  const firstWfId = project?.workflows?.[0] || 'extraction';
  return {
    id: firstWfId,
    data: workflowsData[firstWfId] || DEFAULT_WORKFLOWS[firstWfId],
  };
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

/**
 * Executes a model agent against the Meta Model API via the local runner (http://127.0.0.1:8001/api/agents/run).
 */
async function executeAgentModel({ modelId, systemPrompt, temperature, reasoningEffort, inputPayload, targetTitle, tools }) {
  const start = performance.now();
  try {
    const docName = inputPayload.file_name || inputPayload.document_name || inputPayload.file?.name || 'Document';
    const docNodeId = inputPayload.document_node_id || inputPayload.doc_id || inputPayload.nodeId || '';
    const upstreamSynthesis = inputPayload.agent_synthesis || inputPayload.synthesis || '';
    const hasRawFile = Boolean(inputPayload.file || inputPayload.file_bytes_b64 || inputPayload.include_raw_file);
    const textContent = inputPayload.extracted_text || (hasRawFile ? inputPayload.text : '') || '';

    const docHeader = docNodeId
      ? `Source Document: ${docName} (Canvas Node ID: "${docNodeId}")`
      : `Source Document: ${docName}`;
    const promptParts = [docHeader];
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

    if (tools && tools.length > 0) {
      const toolNames = tools.map((t) => t.function?.name || t.name);
      const hasBatch = toolNames.includes('create_nodes');
      const createAction = hasBatch
        ? 'call the "create_nodes" tool with an array of nodes to create them all simultaneously in batch'
        : 'call the "create_node" tool to populate the canvas';
      const connectInstruction = docNodeId
        ? `Hierarchy & Connection Rules:
1. Connect main topic, finding, and claim nodes to the source document (connect_to_source_id: "${docNodeId}").
2. Connect all subtopics directly to their parent topic node ID (set connect_to_source_id: "<topic_node_id>"), not to the document.
3. Call "connect_nodes" where necessary to establish relationships between related findings, claims, and evidence.`
        : `Hierarchy & Connection Rules: Connect all subtopics directly to their parent topic node ID. Call "connect_nodes" to create relationships between related nodes.`;
      promptParts.push(`Please synthesize the essential structure from the document analysis. Focus strictly on necessary topics and important subtopics. Do not create nodes for minor details or every small mention; only extract the primary conceptual topics, the most important subtopics, and crucial findings or evidence.\n\n${createAction}.\n\n${connectInstruction}`);
    } else {
      promptParts.push('Please analyze the document and findings thoroughly and provide your factual synthesis.');
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

    return {
      status: 'error',
      httpCode: res.status,
      error: data.error || `Agent model call returned HTTP ${res.status}`,
      durationMs: data.duration_ms || elapsed,
    };
  } catch (err) {
    return {
      status: 'error',
      httpCode: 503,
      error: `Agent connection failed: ${err.message}`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}

function evaluateCondition(conditionStr, payload) {
  if (!conditionStr || !conditionStr.trim()) return true;
  const expr = conditionStr.trim();

  const fileName = payload.file?.name || payload.file_name || payload.name || '';
  const rawCat = payload.category || (
    /\.(pdf|docx?|txt|rtf|md|csv|tsv|json|log)$/i.test(fileName) ? 'document' :
    /\.(png|jpe?g|webp|gif|svg|bmp|tiff?)$/i.test(fileName) ? 'image' :
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
  triggerPayload,
  onProgress,
  onExecuteTool,
}) {
  const wfNodes = workflowData?.nodes || {};
  const wfThreads = Array.isArray(workflowData?.threads)
    ? workflowData.threads
    : Object.values(workflowData?.threads || {});

  const runStartTime = Date.now();
  const runId = `run_${Date.now()}`;

  // Build clean run nodes map matching the fixed visual layout
  const runNodes = {};
  Object.entries(wfNodes).forEach(([nId, node]) => {
    runNodes[nId] = {
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
  const fileName = rawFile.name || triggerPayload.file_name || 'document';
  const detectedCategory = (
    /\.(pdf|docx?|txt|rtf|md|csv)$/i.test(fileName) ? 'document' :
    /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(fileName) ? 'image' :
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
    timestamp: new Date().toISOString(),
  };

  let currentPayload = { ...initialPayload };

  // Step 1: Input Node
  const inputNode = runNodes.input || Object.values(runNodes).find((n) => n.type === 'input');

  if (inputNode) {
    inputNode.status = 'running';
    onProgress?.(runRecord);

    await new Promise((r) => setTimeout(r, 120));

    inputNode.status = 'completed';
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
      ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {}),
    };
    onProgress?.(runRecord);
  }

  // Find execution order from input node outwards checking thread conditions
  const visited = new Set(['input']);
  const queue = Object.values(runThreads)
    .filter((th) => th.startNodeId === 'input' || th.startNodeId === inputNode?.id)
    .map((th) => ({ thread: th, targetId: th.endNodeId }));

  let hasFailed = false;

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
        activeNodeInput.metadata = {
          doc_id: initialPayload.doc_id,
          file_name: initialPayload.file_name || initialPayload.name,
          category: initialPayload.category,
          size_bytes: initialPayload.size_bytes,
          ...(initialPayload.metadata || {}),
        };
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
        if (initialPayload.text) {
          activeNodeInput.text = initialPayload.text;
        }
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

      activeNodeInput.doc_id = activeNodeInput.doc_id || initialPayload.doc_id || currentPayload.doc_id;
      activeNodeInput.file_name = activeNodeInput.file_name || initialPayload.file_name || currentPayload.file_name;
      sourceScope = inputFile && previousOutput ? 'both' : (inputFile ? 'original' : 'previous');
    } else {
      sourceScope = targetNode.inputSource || (
        (targetNode.id === 'engine_bridge' || targetNode.id === 'engine_1') ? 'original' :
        (targetNode.type === 'agent' ? 'both' : 'previous')
      );

      // Default final knowledge synthesis agent to 'previous' output + metadata (never send raw file to final synthesis agent)
      if (targetNode.id === 'agent_3' || targetNode.title?.toLowerCase().includes('synthesis')) {
        sourceScope = 'previous';
      }

      if (sourceScope === 'original') {
        activeNodeInput = { ...initialPayload };
      } else if (sourceScope === 'both') {
        activeNodeInput = {
          ...initialPayload,
          ...currentPayload,
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
          doc_id: currentPayload.doc_id || initialPayload.doc_id,
          file_name: currentPayload.file_name || initialPayload.file_name,
          document_name: currentPayload.document_name || initialPayload.document_name || initialPayload.file_name,
          category: currentPayload.category || initialPayload.category,
          size_bytes: currentPayload.size_bytes || initialPayload.size_bytes,
          metadata: {
            doc_id: currentPayload.doc_id || initialPayload.doc_id,
            file_name: currentPayload.file_name || initialPayload.file_name,
            category: currentPayload.category || initialPayload.category,
            size_bytes: currentPayload.size_bytes || initialPayload.size_bytes,
            ...(initialPayload.metadata || {}),
          },
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
        targetNode.inputData = {
          document: activeNodeInput.file_name || activeNodeInput.document_name,
          source_text: activeNodeInput.extracted_text || activeNodeInput.text || '',
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

      // Tool access is the node's "Tool Access" setting (tools: true/false). Saved synthesis agents that
      // predate the setting keep their tools. Agents without tools only return text: with tools attached
      // the server sends a text-only chat request, so the document file would never reach the model.
      const isSynthesisOrCanvasAgent =
        typeof targetNode.tools === 'boolean'
          ? targetNode.tools
          : Boolean(targetNode.title?.toLowerCase().includes('synthesis')) || targetNode.id === 'agent_3';

      const effectiveAgentTools = !isSynthesisOrCanvasAgent
        ? undefined
        : targetNode.engineTools === true
        ? [...ALL_AGENT_TOOLS, ...ENGINE_AGENT_TOOLS]
        : ALL_AGENT_TOOLS;

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

      if (!resolvedDocNodeId || !expNodes[resolvedDocNodeId]) {
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
      if (isSynthesisOrCanvasAgent) {
        const docDirective = resolvedDocNodeId
          ? `The source document "${docName}" is active on the canvas with Node ID: "${resolvedDocNodeId}".`
          : '';

        effectiveSystemPrompt += `\n\nCANVAS ACTION DIRECTIVE: The active exploration canvas is "${targetExploration}".\n${docDirective}\n\n${NODE_INSTRUCTIONS}\n\nEXTRACTION DIRECTIVE:\n- Focus on necessary topics and important subtopics.\n- Avoid exhaustive lists, minor details, or granular side-notes; extract only the core conceptual themes and the most meaningful subtopics.\n- Prioritize clarity, relevance, and clean hierarchy over sheer volume.\nImmediately create all nodes on exploration_id "${targetExploration}".`;
      }

      if (targetNode.engineTools === true) {
        effectiveSystemPrompt += `\n\n${ENGINE_INSTRUCTIONS}`;
      }

      const incomingText =
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

      const res = await executeAgentModel({
        modelId: agentModelId,
        systemPrompt: effectiveSystemPrompt,
        temperature: targetNode.temperature,
        reasoningEffort: targetNode.reasoningEffort,
        inputPayload: agentPayload,
        targetTitle: targetNode.title,
        tools: effectiveAgentTools,
      });

      if (res.status === 'success') {
        const executedTools = [];
        const createdNodeIds = [];
        if (Array.isArray(res.output?.tool_calls) && res.output.tool_calls.length > 0) {
          for (const tc of res.output.tool_calls) {
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
            const toolResult = await onExecuteTool?.(tc.name, parsedArgs);
            if (tc.name === 'create_node' && toolResult?.node?.id) {
              createdNodeIds.push(toolResult.node.id);
            } else if (tc.name === 'create_nodes' && Array.isArray(toolResult?.nodes)) {
              toolResult.nodes.forEach((n) => createdNodeIds.push(n.id));
            }
            executedTools.push({
              toolName: tc.name,
              args: parsedArgs,
              result: toolResult,
            });
          }
        }

        // Link only unconnected root topic/finding nodes to the source document (never subtopics)
        if (resolvedDocNodeId && createdNodeIds.length > 0) {
          const currentExp = project?.explorationsData?.[targetExploration] || {};
          const currentConns = Object.values(currentExp.connections || {});

          const unconnectedRootIds = createdNodeIds.filter((nid) => {
            const nodeObj = currentExp.nodes?.[nid];
            if (!nodeObj) return false;
            // Never connect subtopics to the document
            if (nodeObj.type === 'subtopic') return false;
            // Check if already connected
            const hasConn = currentConns.some((c) => c.source_node_id === nid || c.target_node_id === nid);
            return !hasConn;
          });

          if (unconnectedRootIds.length > 0) {
            const connectRes = onExecuteTool?.('connect_nodes', {
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

        targetNode.status = 'completed';
        thread.status = 'completed';
        targetNode.inputData = {
          document: activeNodeInput.document_name || activeNodeInput.file_name || activeNodeInput.file?.name,
          source_text: incomingText,
          category: activeNodeInput.category,
          input_source: sourceScope,
        };

        const toolNote = executedTools.length > 0
          ? ` [invoked ${executedTools.length} tool(s): ${executedTools.map((t) => t.toolName).join(', ')}]`
          : '';

        targetNode.processInfo = {
          step: `Agent '${targetNode.title}' executed via Meta API (${agentModelId}) (HTTP 200)${toolNote} [source: ${sourceScope}]`,
          executionTime: `${res.durationMs}ms`,
        };
        const finalSynthesis =
          res.output?.synthesis ||
          res.output?.agent_synthesis ||
          (executedTools.length > 0
            ? `Synthesized document findings and created ${executedTools.length} nodes on exploration canvas '${targetExploration}'.`
            : 'Analysis complete.');

        targetNode.outputData = {
          ...res.output,
          synthesis: finalSynthesis,
          agent_synthesis: finalSynthesis,
          executedTools,
        };
        currentPayload = { ...currentPayload, ...targetNode.outputData };
      } else {
        targetNode.status = 'failed';
        thread.status = 'failed';
        targetNode.inputData = {
          document: activeNodeInput.document_name || activeNodeInput.file_name || activeNodeInput.file?.name,
          source_text: incomingText,
          category: activeNodeInput.category,
          input_source: sourceScope,
        };
        targetNode.processInfo = {
          step: `Agent '${targetNode.title}' failed (HTTP ${res.httpCode || 500}): ${res.error}`,
          executionTime: `${res.durationMs}ms`,
          error: res.error,
        };
        targetNode.outputData = null;
        hasFailed = true;
        onProgress?.(runRecord);
        break;
      }
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
  runRecord.status = hasFailed ? 'failed' : 'completed';
  runRecord.duration = `${totalDuration}s`;
  onProgress?.(runRecord);

  return runRecord;
}
