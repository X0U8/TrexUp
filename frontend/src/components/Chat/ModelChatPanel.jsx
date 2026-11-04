import { useState, useRef, useEffect } from 'react';
import { NODE_LIFECYCLE_DEFINITIONS, NODE_INSTRUCTIONS } from '../../tools/nodeLifecycleTools';
import { ENGINE_TOOL_DEFINITIONS, ENGINE_INSTRUCTIONS } from '../../tools/engine';
import { WORKFLOW_TOOL_DEFINITIONS, WORKFLOW_INSTRUCTIONS } from '../../tools/workflowTools';
import { getGlobalChat, saveGlobalChat, clearGlobalChat } from '../../utils/db';
import { getEngineManifest } from '../../utils/engineUtils';
import { AVAILABLE_AGENT_MODELS } from '../../tools/workflow/_shared';
import MarkdownText from './MarkdownText';
import './ModelChatPanel.css';

const FIXED_MODEL_ID = 'muse-spark-1.3';
const FIXED_MODEL_NAME = 'Muse Spark 1.3';

export default function ModelChatPanel({
  currentExploration = 'exploration_01',
  nodes = {},
  engines = [],
  enginesData = {},
  workflows = {},
  onExecuteTool,
  focusedNode = null,
  onClearFocusedNode,
  onWorkflowAssemblingChange,
}) {
  const selectedModel = FIXED_MODEL_ID;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeToolStatus, setActiveToolStatus] = useState('');
  const [size, setSize] = useState(() => {
    return { width: 320, height: 420 };
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    startWidth: 0,
    startHeight: 0,
    startX: 0,
    startY: 0,
    direction: '',
  });

  const [position, setPosition] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    return { x: Math.max(16, w - 340), y: Math.max(80, h - 480) };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  const GLOBAL_INIT_MESSAGE = {
    id: 'msg-init',
    sender: 'model',
    text: 'Assistant is here to help',
    time: '',
  };

  const [messages, setMessages] = useState([GLOBAL_INIT_MESSAGE]);

  const isLoadedRef = useRef(false);
  const messagesEndRef = useRef(null);
  const messagesBoxRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const visibleMessages = messages.length > visibleCount ? messages.slice(-visibleCount) : messages;

  const loadEarlierMessages = () => {
    const box = messagesBoxRef.current;
    const previousHeight = box ? box.scrollHeight : 0;
    setVisibleCount((c) => c + 30);
    requestAnimationFrame(() => {
      if (box) box.scrollTop += box.scrollHeight - previousHeight;
    });
  };

  // Load persisted global chat, size, and position from IndexedDB on mount
  useEffect(() => {
    async function loadChat() {
      try {
        const persisted = await getGlobalChat();
        if (persisted && Array.isArray(persisted.messages) && persisted.messages.length > 0) {
          // Sanitize old exploration-specific assistant greetings from earlier sessions
          const cleaned = persisted.messages.filter((m) => {
            if (!m || !m.text) return false;
            const t = m.text.toLowerCase();
            return !(t.includes('exploration assistant active') || t.includes('active for "exploration_01"'));
          });

          if (cleaned.length === 0) {
            cleaned.push(GLOBAL_INIT_MESSAGE);
          } else if (cleaned[0]?.id === 'msg-init' || cleaned[0]?.sender === 'model') {
            if (cleaned[0].text.toLowerCase().includes('agent active') || cleaned[0].text.toLowerCase().includes('exploration assistant')) {
              cleaned[0] = { ...cleaned[0], text: GLOBAL_INIT_MESSAGE.text };
            }
          }

          setMessages(cleaned);
          if (typeof persisted.isCollapsed === 'boolean') {
            setIsCollapsed(persisted.isCollapsed);
          }
          if (persisted.size && typeof persisted.size.width === 'number' && typeof persisted.size.height === 'number') {
            const maxW = Math.max(260, window.innerWidth - 30);
            const maxH = Math.max(220, window.innerHeight - 60);
            setSize({
              width: Math.min(maxW, Math.max(260, persisted.size.width)),
              height: Math.min(maxH, Math.max(220, persisted.size.height)),
            });
          }
          if (persisted.position && typeof persisted.position.x === 'number' && typeof persisted.position.y === 'number') {
            const maxX = Math.max(10, window.innerWidth - 240);
            const maxY = Math.max(10, window.innerHeight - 80);
            setPosition({
              x: Math.min(maxX, Math.max(10, persisted.position.x)),
              y: Math.min(maxY, Math.max(10, persisted.position.y)),
            });
          }
        }
      } catch (err) {
        console.error('Failed to load global chat from IndexedDB:', err);
      } finally {
        isLoadedRef.current = true;
      }
    }
    loadChat();
  }, []);

  // Persist messages, collapsed state, size, and position whenever they change
  useEffect(() => {
    if (!isLoadedRef.current) return;
    saveGlobalChat({
      messages,
      selectedModel: FIXED_MODEL_ID,
      isCollapsed,
      position,
      size,
    });
  }, [messages, isCollapsed, position, size]);

  const handleResizeStart = (dir, e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
      startX: position.x,
      startY: position.y,
      direction: dir,
    };

    const handlePointerMove = (moveEvt) => {
      const dx = moveEvt.clientX - resizeStartRef.current.mouseX;
      const dy = moveEvt.clientY - resizeStartRef.current.mouseY;
      const { startWidth, startHeight, startX, startY, direction } = resizeStartRef.current;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startX;
      let newY = startY;

      const minW = 260;
      const maxW = Math.max(minW, window.innerWidth - 40);
      const minH = 220;
      const maxH = Math.max(minH, window.innerHeight - 60);

      if (direction.includes('e')) {
        newWidth = Math.min(maxW, Math.max(minW, startWidth + dx));
      }
      if (direction.includes('s')) {
        newHeight = Math.min(maxH, Math.max(minH, startHeight + dy));
      }
      if (direction.includes('w')) {
        const potentialW = startWidth - dx;
        if (potentialW >= minW && potentialW <= maxW) {
          newWidth = potentialW;
          newX = startX + dx;
        }
      }
      if (direction.includes('n')) {
        const potentialH = startHeight - dy;
        if (potentialH >= minH && potentialH <= maxH) {
          newHeight = potentialH;
          newY = startY + dy;
        }
      }

      setSize({ width: Math.round(newWidth), height: Math.round(newHeight) });
      if (newX !== startX || newY !== startY) {
        setPosition({ x: Math.round(newX), y: Math.round(newY) });
      }
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleHeaderPointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) {
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleHeaderPointerMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;
    const panelWidth = isCollapsed ? 240 : size.width;
    const panelHeight = isCollapsed ? 44 : size.height;

    const maxX = Math.max(10, window.innerWidth - panelWidth - 10);
    const maxY = Math.max(10, window.innerHeight - panelHeight - 10);

    const nextX = Math.min(maxX, Math.max(10, dragStartRef.current.startX + deltaX));
    const nextY = Math.min(maxY, Math.max(10, dragStartRef.current.startY + deltaY));

    setPosition({ x: nextX, y: nextY });
  };

  const handleHeaderPointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isCollapsed) {
      scrollToBottom();
    }
  }, [messages, isCollapsed, isLoading]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = inputVal.trim();
    if (!text || isLoading) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      focusedNode: focusedNode
        ? {
          id: focusedNode.id || focusedNode.node_id,
          title: (focusedNode.title || focusedNode.name || 'Untitled').replace(/\.node$/i, ''),
          type: (focusedNode.type || focusedNode.category || 'node').replace(/_/g, ' '),
        }
        : null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsLoading(true);
    setActiveToolStatus('Connecting to model...');

    let touchedWorkflowId = null; // declared outside try: the finally block reads it
    try {
      const apiTools = [
        ...NODE_LIFECYCLE_DEFINITIONS,
        ...ENGINE_TOOL_DEFINITIONS,
        ...WORKFLOW_TOOL_DEFINITIONS,
      ].map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      // Limit conversation history to the last 4 messages (2 complete exchanges)
      // Exclude initial greeting and truncate long previous responses to prevent token bloat and timeouts
      const MAX_HISTORY_MESSAGES = 4;
      const MAX_HISTORY_CHARS = 1000;

      const recentHistory = messages
        .filter((m) => m && m.text && m.text.trim() && m.id !== 'msg-init')
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => {
          let trimmed = m.text.trim();
          if (trimmed.length > MAX_HISTORY_CHARS) {
            trimmed = `${trimmed.slice(0, MAX_HISTORY_CHARS)}... (truncated for context limit)`;
          }
          return {
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: trimmed,
          };
        });

      // Construct clean, live map of current engines and workflows
      const engineListMap = (engines || []).map((engId) => {
        const manifest = getEngineManifest(engId, enginesData);
        const inKeys = Object.keys(manifest.inputs || {}).join(', ') || 'none';
        const outKeys = Object.keys(manifest.outputs || {}).join(', ') || 'output';
        return `- ${manifest.name} (id: "${engId}"): ${manifest.description} | Inputs: [${inKeys}] | Outputs: [${outKeys}]`;
      }).join('\n');

      const workflowKeys = Object.keys(workflows || {});
      const workflowListMap = workflowKeys.length > 0
        ? workflowKeys.map((wfId) => {
            const wf = workflows[wfId];
            const nodeCount = Array.isArray(wf?.nodes) ? wf.nodes.length : 0;
            return `- ${wf?.name || wfId} (id: "${wfId}"): ${wf?.description || 'Pipeline'} | ${nodeCount} stages`;
          }).join('\n')
        : '- No custom workflows registered yet in this project.';

      const modelListMap = AVAILABLE_AGENT_MODELS.map((m) =>
        `- ${m.name} (id: "${m.id}") [${m.tag}]: ${m.desc}`
      ).join('\n');

      const liveSystemMap = `
### Live System Map (Current Workspace State)
Available Agent Models (for Agent Nodes in Workflows):
${modelListMap}

Available Python Engines:
${engineListMap || '- None'}

Available Workflows:
${workflowListMap}

Storage Architecture:
- Physical Documents / Binary Assets: OS disk storage at 'storage/documents/'
- Project Graph & Execution Records: Stored directly in IndexedDB
`;

      const systemPrompt = `You are Trex Assistant, the intelligent research & workspace investigation assistant.
You operate globally across the entire project, all scientific explorations, workflows, and engines.
The active exploration canvas in focus is "${currentExploration}".
When creating, searching, or mutating exploration nodes, provide exploration_id as "${currentExploration}" unless the user explicitly refers to another exploration.
You can investigate across explorations, connect findings, synthesize evidence, and execute workflows across the entire workspace.
You have full multimodal vision capabilities. Any image files or diagrams attached to focused canvas nodes or referenced in paths are automatically loaded and provided directly to you as vision inputs, so you can inspect, describe, and analyze them in detail.

${NODE_INSTRUCTIONS}

${ENGINE_INSTRUCTIONS}

${WORKFLOW_INSTRUCTIONS}

${liveSystemMap}`;

      const activeNodeContext = focusedNode
        ? `\n\n[Active Focused Canvas Node: ID="${focusedNode.id || focusedNode.node_id}", Title="${(focusedNode.title || focusedNode.name || '').replace(/\.node$/i, '')}", Type="${focusedNode.type || focusedNode.category || 'node'}", Status="${focusedNode.status || ''}", Path="${focusedNode.local_path || focusedNode.filePath || focusedNode.path || focusedNode.url || focusedNode.cloudinaryUrl || ''}", Description="${focusedNode.description || focusedNode.summary || focusedNode.content || ''}"]`
        : '';

      const userPromptWithContext = activeNodeContext ? `${text}${activeNodeContext}` : text;

      let conversationMessages = [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        { role: 'user', content: userPromptWithContext },
      ];

      const toolEvents = [];
      let finalReply = '';
      let iteration = 0;
      let validationAttempts = 0;
      const MAX_ITERATIONS = 20;

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        setActiveToolStatus(iteration === 1 ? 'Connecting to model...' : 'Applying tool results...');

        const sanitizedMessages = conversationMessages.map((m) => {
          const copy = { ...m };
          if (copy.role === 'tool') {
            copy.content = typeof copy.content === 'string' ? copy.content : JSON.stringify(copy.content || {});
            return copy;
          }
          if (copy.role === 'assistant') {
            if (copy.tool_calls && copy.tool_calls.length > 0) {
              copy.content = typeof copy.content === 'string' && copy.content.trim() ? copy.content : null;
            } else {
              copy.content = typeof copy.content === 'string' ? copy.content : (copy.content ? String(copy.content) : '');
            }
            return copy;
          }
          if (copy.role === 'system') {
            copy.content = typeof copy.content === 'string' ? copy.content : String(copy.content || '');
            return copy;
          }
          if (Array.isArray(copy.content)) {
            return copy;
          }
          if (typeof copy.content !== 'string') {
            copy.content = copy.content !== undefined && copy.content !== null ? String(copy.content) : '';
          }
          return copy;
        });

        const response = await fetch('http://127.0.0.1:8001/api/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: sanitizedMessages,
            tools: apiTools,
            ...(selectedModel?.startsWith('muse-spark') || selectedModel?.startsWith('muse-wonder')
              ? { reasoning_effort: 'minimal' }
              : {}),
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Local server HTTP ${response.status}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        const toolCalls = choice?.message?.tool_calls || [];
        const replyContent = (choice?.message?.content || '').trim();

        if (replyContent) {
          finalReply = replyContent;
        }

        if (!toolCalls || toolCalls.length === 0) {
          // If a workflow was created or touched, auto-validate and trigger auto-fix if structural issues exist
          if (touchedWorkflowId && validationAttempts < 2 && iteration < MAX_ITERATIONS - 1) {
            validationAttempts++;
            const valRes = await onExecuteTool?.('validate_workflow', { workflow_id: touchedWorkflowId });
            if (valRes && valRes.valid === false && Array.isArray(valRes.problems) && valRes.problems.length > 0) {
              toolEvents.push({
                toolName: 'validate_workflow',
                label: `Auto-diagnosed ${valRes.problem_count} pipeline issue(s) — triggering auto-repair`,
                status: 'refused',
              });
              conversationMessages.push({
                role: 'user',
                content: `[System Validation Diagnostic: Workflow "${touchedWorkflowId}" has structural errors that must be fixed before finishing: ${valRes.problems.join('; ')}. Please immediately call the appropriate workflow tools (e.g. connect_workflow_nodes, disconnect_workflow_nodes, or auto_layout_workflow) to fix these issues.]`,
              });
              continue;
            }
          }
          break;
        }

        conversationMessages.push({
          role: 'assistant',
          content: typeof choice.message?.content === 'string' ? choice.message.content : '',
          tool_calls: toolCalls,
        });

        for (const call of toolCalls) {
          const fnName = call.function?.name || 'tool';
          setActiveToolStatus(`Executing ${fnName}...`);
          await new Promise((r) => setTimeout(r, 350));

          let args = {};
          try {
            args = JSON.parse(call.function?.arguments || '{}');
          } catch (pErr) {
            console.error('Failed to parse tool call arguments:', pErr);
          }

          if (!args.exploration_id) {
            args.exploration_id = currentExploration;
          }

          const toolResult = (await onExecuteTool?.(fnName, args)) || {};

          if (fnName.includes('workflow') && (toolResult?.workflow_id || args?.workflow_id)) {
            touchedWorkflowId = toolResult?.workflow_id || args?.workflow_id;
          }

          if (fnName === 'create_workflow') {
            onWorkflowAssemblingChange?.(true);
          }

          if (toolResult?.searched) {
            const count = toolResult.count || 0;
            const q = args.query ? `"${args.query}"` : 'all';
            const sample = count > 0 ? ` (${toolResult.nodes[0]?.title || toolResult.nodes[0]?.node_id})` : '';
            toolEvents.push({
              toolName: fnName,
              label: `Searched nodes: found ${count} matching ${q}${sample}`,
              nodeId: count > 0 ? toolResult.nodes[0]?.node_id : undefined,
              status: count > 0 ? 'success' : 'refused',
            });
          } else if (toolResult?.connected && fnName === 'connect_nodes') {
            const rel = args.relationship_type ? ` [${args.relationship_type}]` : '';
            toolEvents.push({
              toolName: fnName,
              label: `Connected to ${toolResult.count} node${toolResult.count > 1 ? 's' : ''}${rel}`,
              nodeId: toolResult.connections?.[0]?.id,
              status: 'success',
            });
          } else if (fnName === 'create_nodes' && toolResult?.created) {
            const count = toolResult.count || toolResult.nodes?.length || 0;
            toolEvents.push({
              toolName: fnName,
              label: `Created ${count} nodes in batch`,
              status: 'success',
            });
          } else if (fnName === 'create_engine' && toolResult?.created) {
            toolEvents.push({
              toolName: fnName,
              label: `Created engine "${toolResult.engine_id}"`,
              status: 'success',
            });
          } else if (toolResult?.created && toolResult.node) {
            toolEvents.push({
              toolName: fnName,
              label: `Created ${toolResult.node.type || 'node'} "${toolResult.node.title || toolResult.node.name || toolResult.node.id}"`,
              nodeId: toolResult.node.id,
              status: 'success',
            });
          } else if (toolResult?.updated && fnName === 'update_node') {
            toolEvents.push({
              toolName: fnName,
              label: `Updated node "${toolResult.node?.title || args.title || args.node_id}"${toolResult.new_status ? ` (${toolResult.new_status})` : ''}`,
              nodeId: toolResult.node?.id || toolResult.node_id || args.node_id,
              status: 'success',
            });
          } else if (toolResult?.updated && fnName === 'update_connection') {
            toolEvents.push({
              toolName: fnName,
              label: `Updated connection "${args.connection_id}" (${toolResult.connection?.relationship_type})`,
              nodeId: args.connection_id,
              status: 'success',
            });
          } else if (toolResult?.deleted && fnName === 'remove_connection') {
            toolEvents.push({
              toolName: fnName,
              label: `Removed connection "${args.connection_id}"`,
              nodeId: args.connection_id,
              status: 'success',
            });
          } else if (toolResult?.deleted) {
            const count = toolResult.count || 1;
            const singleId = toolResult.node_id || args.node_id;
            const label = count > 1 ? `Deleted all ${count} nodes` : `Deleted node "${singleId}"`;
            toolEvents.push({
              toolName: fnName,
              label,
              nodeId: count === 1 ? singleId : undefined,
              status: 'success',
            });
          } else if (toolResult?.connections && fnName === 'get_connections') {
            toolEvents.push({
              toolName: fnName,
              label: `Found ${toolResult.count} connection${toolResult.count !== 1 ? 's' : ''}`,
              status: 'success',
            });
          } else if (toolResult?.explorations) {
            const expNames = toolResult.explorations.map((ex) => ex.exploration_id).join(', ');
            toolEvents.push({
              toolName: fnName,
              label: `Explorations: ${expNames}`,
              status: 'success',
            });
          } else if (toolResult?.listed && fnName === 'list_engines') {
            toolEvents.push({
              toolName: fnName,
              label: `Listed ${toolResult.count} engine${toolResult.count !== 1 ? 's' : ''}`,
              status: 'success',
            });
          } else if (fnName === 'get_engine' && toolResult?.engine) {
            toolEvents.push({
              toolName: fnName,
              label: `Read engine "${toolResult.engine.engine_id}"`,
              status: 'success',
            });
          } else if (fnName === 'update_engine' && toolResult?.updated) {
            toolEvents.push({
              toolName: fnName,
              label: `Updated engine "${toolResult.engine_id}"`,
              status: 'success',
            });
          } else if (fnName === 'test_engine' && toolResult?.tested && !toolResult?.error) {
            toolEvents.push({
              toolName: fnName,
              label: `Tested engine "${toolResult.engine_id}" OK (${toolResult.duration_ms}ms)`,
              status: 'success',
            });
          } else if (fnName === 'test_engine' && toolResult?.error) {
            toolEvents.push({
              toolName: fnName,
              label: `Test failed${toolResult.line ? ` at line ${toolResult.line}` : ''}: ${toolResult.error}`,
              status: 'refused',
            });
          } else if (fnName === 'list_workflows' && toolResult?.workflows) {
            toolEvents.push({
              toolName: fnName,
              label: `Listed ${toolResult.count} workflows`,
              status: 'success',
            });
          } else if (fnName === 'get_workflow' && toolResult?.workflow_id) {
            toolEvents.push({
              toolName: fnName,
              label: `Inspected workflow "${toolResult.name || toolResult.workflow_id}" (${toolResult.node_count} nodes, ${toolResult.thread_count} threads)`,
              status: 'success',
            });
          } else if (fnName === 'create_workflow' && toolResult?.created) {
            toolEvents.push({
              toolName: fnName,
              label: `Created workflow "${toolResult.name || toolResult.workflow_id}"`,
              status: 'success',
            });
          } else if (fnName === 'duplicate_workflow' && toolResult?.duplicated) {
            toolEvents.push({
              toolName: fnName,
              label: `Duplicated workflow to "${toolResult.name}"`,
              status: 'success',
            });
          } else if (fnName === 'add_workflow_node' && toolResult?.added) {
            toolEvents.push({
              toolName: fnName,
              label: `Added ${toolResult.node?.type || 'node'} "${toolResult.node?.title || toolResult.node?.id}" to workflow`,
              status: 'success',
            });
          } else if (fnName === 'batch_place_nodes' && toolResult?.placed) {
            toolEvents.push({
              toolName: fnName,
              label: `Placed ${toolResult.placed_count} workflow nodes`,
              status: 'success',
            });
          } else if (fnName === 'move_workflow_node' && toolResult?.moved) {
            toolEvents.push({
              toolName: fnName,
              label: `Moved node "${args.node_id}" to (${args.x}, ${args.y})`,
              status: 'success',
            });
          } else if (fnName === 'update_workflow_node' && toolResult?.updated) {
            toolEvents.push({
              toolName: fnName,
              label: `Updated workflow node "${toolResult.node?.title || args.node_id}"`,
              status: 'success',
            });
          } else if (fnName === 'delete_workflow_node' && toolResult?.deleted) {
            toolEvents.push({
              toolName: fnName,
              label: `Deleted node "${args.node_id}" from workflow`,
              status: 'success',
            });
          } else if (fnName === 'connect_workflow_nodes' && toolResult?.connected) {
            toolEvents.push({
              toolName: fnName,
              label: `Connected "${args.from_node}" -> "${args.to_node}" in workflow`,
              status: 'success',
            });
          } else if (fnName === 'auto_layout_workflow' && toolResult?.arranged) {
            toolEvents.push({
              toolName: fnName,
              label: `Auto-arranged ${toolResult.node_count} nodes in workflow`,
              status: 'success',
            });
          } else if (fnName === 'list_agent_models' && toolResult?.models) {
            toolEvents.push({
              toolName: fnName,
              label: `Listed ${toolResult.count} valid agent models`,
              status: 'success',
            });
          } else if (fnName === 'validate_workflow' && toolResult?.valid !== undefined) {
            toolEvents.push({
              toolName: fnName,
              label: toolResult.valid ? 'Workflow validated: 0 problems' : `Validation: ${toolResult.problem_count} problem(s)`,
              status: toolResult.valid ? 'success' : 'refused',
            });
          } else if (fnName === 'execute_workflow' && toolResult?.executed) {
            toolEvents.push({
              toolName: fnName,
              label: `Executed workflow "${args.workflow_id}" (${toolResult.status})`,
              status: 'success',
            });
          } else if (fnName === 'get_workflow_logs' && toolResult?.logs) {
            toolEvents.push({
              toolName: fnName,
              label: `Read ${toolResult.returned} recent workflow logs`,
              status: 'success',
            });
          } else if (fnName === 'inspect_workflow_run_log' && toolResult?.run_id) {
            toolEvents.push({
              toolName: fnName,
              label: `Inspected run "${toolResult.run_id}" trace (${toolResult.total_nodes_executed || 0} nodes)`,
              status: 'success',
            });
          } else if (fnName === 'web_search' && toolResult?.searched) {
            const count = toolResult.citation_count || 0;
            const nodesInfo = toolResult.created_nodes_count ? `, created ${toolResult.created_nodes_count} finding nodes` : '';
            toolEvents.push({
              toolName: fnName,
              label: `Searched web for "${args.query}" (${count} citations${nodesInfo})`,
              status: 'success',
            });
          } else if (fnName === 'download_web_file' && toolResult?.downloaded) {
            const count = toolResult.count || 1;
            const sizeKb = Number(toolResult.size_bytes) > 0 ? `${(toolResult.size_bytes / 1024).toFixed(1)} KB` : '';
            const sizeStr = sizeKb ? ` (${sizeKb})` : '';
            const fname = toolResult.filename || args?.filename || 'file';
            const label = count > 1
              ? `Downloaded ${count} files${sizeStr}`
              : `Downloaded "${fname}"${sizeStr}`;
            toolEvents.push({
              toolName: fnName,
              label,
              status: 'success',
            });
          } else if (toolResult?.error) {
            toolEvents.push({
              toolName: fnName,
              label: `Tool refused: ${toolResult.error}`,
              status: 'refused',
            });
          }

          let toolContent =
            typeof toolResult === 'string'
              ? toolResult
              : JSON.stringify(toolResult !== undefined ? toolResult : {});
          if (!toolContent || toolContent === 'undefined') {
            toolContent = '{}';
          }
          if (toolContent.length > 2500) {
            toolContent = `${toolContent.slice(0, 2500)}... (truncated)`;
          }

          conversationMessages.push({
            role: 'tool',
            tool_call_id: call.id || `call_${iteration}`,
            content: toolContent,
          });
        }
      }

      // If a workflow was touched and still fails the checklist, say so instead of reporting success.
      if (touchedWorkflowId) {
        const finalCheck = await onExecuteTool?.('validate_workflow', { workflow_id: touchedWorkflowId });
        if (finalCheck?.valid === false && Array.isArray(finalCheck.problems) && finalCheck.problems.length > 0) {
          finalReply = `${finalReply}\n\nIncomplete: ${finalCheck.problems.join(' ')}`.trim();
        }
      }

      // If tool pills exist, clean redundant raw text
      let cleanedText = finalReply;
      if (toolEvents.length > 0) {
        const lowerReply = finalReply.toLowerCase();
        if (
          lowerReply.includes('created finding') ||
          lowerReply.includes('created node') ||
          lowerReply.includes('creating your') ||
          lowerReply.includes('i have created') ||
          lowerReply.includes('(id: node_')
        ) {
          cleanedText = '';
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `rep-${Date.now()}`,
          sender: 'model',
          text: cleanedText,
          toolEvents,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.warn('API call encountered error:', err);
      const errorMsg = err?.message || '';
      let failureReason = 'The server is not online or Meta AI API is not set.';
      if (errorMsg && !errorMsg.includes('Failed to fetch') && !errorMsg.includes('NetworkError')) {
        failureReason = `The server is not online or Meta AI API is not set (${errorMsg}).`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `rep-${Date.now()}`,
          sender: 'model',
          text: failureReason,
          toolEvents: [
            {
              toolName: 'connection',
              label: 'Server offline or Meta AI API not set',
              status: 'refused',
            },
          ],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
      setActiveToolStatus('');
      onWorkflowAssemblingChange?.(false, '', '', touchedWorkflowId);
    }
  };

  return (
    <div
      className={`model-chat-panel ${isCollapsed ? 'collapsed' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isCollapsed ? '240px' : `${size.width}px`,
        height: isCollapsed ? 'auto' : `${size.height}px`,
      }}
    >
      {/* Draggable Header */}
      <div
        className="model-chat-header"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
      >
        <div className="agent-header-identity">
          <span className="agent-header-name">Trex Assistant</span>
        </div>

        <div className="model-chat-header-actions">
          {!isCollapsed && (
            <button
              type="button"
              className="model-chat-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                const isLarge = size.width >= 460 || size.height >= 520;
                if (isLarge) {
                  setSize({ width: 320, height: 420 });
                } else {
                  const maxW = Math.min(540, window.innerWidth - 40);
                  const maxH = Math.min(620, window.innerHeight - 80);
                  setSize({ width: maxW, height: maxH });
                }
              }}
              title={size.width >= 460 ? 'Standard size' : 'Expand size'}
              aria-label={size.width >= 460 ? 'Standard size' : 'Expand size'}
            >
              {size.width >= 460 ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
          )}

          <button
            type="button"
            className="model-chat-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed((prev) => !prev);
            }}
            title={isCollapsed ? 'Expand Trex Assistant' : 'Collapse Trex Assistant'}
            aria-label={isCollapsed ? 'Expand Trex Assistant' : 'Collapse Trex Assistant'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isCollapsed ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: messages and input */}
      {!isCollapsed && (
        <>
          <div className="model-chat-messages" ref={messagesBoxRef}>
            {messages.length > visibleCount && (
              <button type="button" className="chat-load-earlier" onClick={loadEarlierMessages}>
                Load earlier messages ({messages.length - visibleCount} more)
              </button>
            )}
            {visibleMessages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble-row ${msg.sender === 'user' ? 'user' : 'model'}`}
              >
                <div className="chat-bubble">
                  {msg.text && (
                    <div className="chat-bubble-text">
                      <MarkdownText content={msg.text} />
                    </div>
                  )}

                  {/* Sleek Tool Execution Event Pills with Tick Signs */}
                  {msg.toolEvents && msg.toolEvents.length > 0 && (
                    <div className="tool-events-list">
                      {msg.toolEvents.map((evt, idx) => (
                        <div key={idx} className={`tool-event-pill ${evt.status || 'success'}`}>
                          <span className="tool-event-tick-icon" title="Completed">
                            {evt.status === 'refused' ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          <div className="tool-event-info">
                            <span className="tool-event-title">{evt.label}</span>
                            {evt.nodeId && <span className="tool-event-id-tag">{evt.nodeId}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.focusedNode && (
                    <div className="chat-bubble-node-ref">
                      <span className="chat-ref-dot" />
                      <span className="chat-ref-title">{msg.focusedNode.title}</span>
                    </div>
                  )}

                  <div className="chat-bubble-time">{msg.time}</div>
                </div>
              </div>
            ))}

            {/* Circular Loading Spinner while the tool is working */}
            {isLoading && (
              <div className="chat-bubble-row model">
                <div className="chat-bubble tool-working-bubble">
                  <div className="tool-status-pill working">
                    <span className="tool-circular-spinner" />
                    <span className="tool-status-label">{activeToolStatus || 'Executing tool...'}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {focusedNode && (
            <div className="chat-focused-node-bar">
              <div className="chat-focused-node-pill">
                <span className="chat-focused-dot" />
                <span className="chat-focused-type">
                  {(focusedNode.type || focusedNode.category || 'node').replace(/_/g, ' ')}:
                </span>
                <span
                  className="chat-focused-title"
                  title={focusedNode.title || focusedNode.name}
                >
                  {(focusedNode.title || focusedNode.name || 'Untitled').replace(/\.node$/i, '')}
                </span>
              </div>
              <button
                type="button"
                className="chat-focused-clear-btn"
                onClick={onClearFocusedNode}
                title="Clear node focus"
              >
                ✕
              </button>
            </div>
          )}

          <form className="model-chat-form" onSubmit={handleSend}>
            <input
              type="text"
              className="model-chat-input"
              placeholder={
                isLoading
                  ? 'Thinking...'
                  : focusedNode
                    ? `Ask about ${(focusedNode.title || focusedNode.name || 'node').replace(/\.node$/i, '')}...`
                    : 'Ask anything...'
              }
              value={inputVal}
              disabled={isLoading}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <button
              type="submit"
              className="model-chat-send-btn"
              disabled={!inputVal.trim() || isLoading}
              title="Send message"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>

          {/* Interactive Multi-Directional Resize Handles */}
          <div className="chat-resize-handle top" onPointerDown={(e) => handleResizeStart('n', e)} />
          <div className="chat-resize-handle bottom" onPointerDown={(e) => handleResizeStart('s', e)} />
          <div className="chat-resize-handle left" onPointerDown={(e) => handleResizeStart('w', e)} />
          <div className="chat-resize-handle right" onPointerDown={(e) => handleResizeStart('e', e)} />
          <div className="chat-resize-handle top-left" onPointerDown={(e) => handleResizeStart('nw', e)} />
          <div className="chat-resize-handle top-right" onPointerDown={(e) => handleResizeStart('ne', e)} />
          <div className="chat-resize-handle bottom-left" onPointerDown={(e) => handleResizeStart('sw', e)} />
          <div className="chat-resize-handle bottom-right" onPointerDown={(e) => handleResizeStart('se', e)} title="Drag to resize">
            <svg viewBox="0 0 10 10" className="resize-grip-icon">
              <path d="M8 2 L2 8 M9 5 L5 9 M9 8 L8 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

