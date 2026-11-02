import { useState, useRef, useEffect } from 'react';
import { NODE_LIFECYCLE_DEFINITIONS } from '../../tools/nodeLifecycleTools';
import { getGlobalChat, saveGlobalChat, clearGlobalChat } from '../../utils/db';
import MarkdownText from './MarkdownText';
import './ModelChatPanel.css';

const FIXED_MODEL_ID = 'muse-spark-1.3';
const FIXED_MODEL_NAME = 'Muse Spark 1.3';

export default function ModelChatPanel({
  currentExploration = 'exploration_01',
  nodes = {},
  onExecuteTool,
}) {
  const selectedModel = FIXED_MODEL_ID;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeToolStatus, setActiveToolStatus] = useState('');
  const [position, setPosition] = useState(() => {
    const defaultRight = 24;
    const defaultTop = 176;
    const defaultWidth = 300;
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    return {
      x: Math.max(16, w - defaultWidth - defaultRight),
      y: defaultTop,
    };
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

  // Load persisted global chat and position from IndexedDB on mount
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

  // Persist messages, collapsed state, and position whenever they change
  useEffect(() => {
    if (!isLoadedRef.current) return;
    saveGlobalChat({
      messages,
      selectedModel: FIXED_MODEL_ID,
      isCollapsed,
      position,
    });
  }, [messages, isCollapsed, position]);

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
    const panelWidth = isCollapsed ? 240 : 300;
    const panelHeight = isCollapsed ? 44 : 290;

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
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsLoading(true);
    setActiveToolStatus('Connecting to model...');

    try {
      const apiTools = NODE_LIFECYCLE_DEFINITIONS.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      const recentHistory = messages
        .slice(-6)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));

      const systemPrompt = `You are Trex Assistant, the autonomous scientific research & workspace investigation assistant.
You operate globally across the entire project and all scientific explorations.
The active exploration canvas in focus is "${currentExploration}".
When creating, searching, or mutating nodes, provide exploration_id as "${currentExploration}" unless the user explicitly refers to another exploration.
You can investigate across explorations, connect findings, formulate hypotheses, synthesize evidence, and verify scientific claims across the entire workspace.
Node types available: finding, hypothesis, claim, evidence, document, topic, subtopic, open_question.
Relationship types available: supports, refutes, caused_by, related_to, derives_from, evidences, depends_on, contradicts.

CORE RULES:
1. When asked to create a node, call "create_node" directly.
2. For existing nodes (update, rename, inspect, delete, verify): NEVER guess node IDs. First call "search_nodes" with query or title to find matching nodes and their node_id.
3. When asked to connect nodes: call "connect_nodes" with source_node_id, target_node_ids (array), relationship_type, and reasoning description.
4. To inspect connections around a node, call "get_connections".
5. To update or remove connections, call "update_connection" or "remove_connection".
6. When asked to delete all nodes or multiple nodes, call "delete_node" with node_id: "all" or delete_all: true (or pass node_ids array).
7. Call "list_explorations" when the user asks to see or investigate across available explorations.`;

      let conversationMessages = [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        { role: 'user', content: text },
      ];

      const toolEvents = [];
      let finalReply = '';
      let iteration = 0;
      const MAX_ITERATIONS = 4;

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        setActiveToolStatus(iteration === 1 ? 'Connecting to model...' : 'Applying tool results...');

        const response = await fetch('/api/meta/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer LLM_4128710577435766_JLn17BAsh5kVInIDX9e8mEG6szQ',
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: conversationMessages,
            tools: apiTools,
          }),
        });

        if (!response.ok) {
          throw new Error(`API HTTP ${response.status}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        const toolCalls = choice?.message?.tool_calls || [];
        const replyContent = (choice?.message?.content || '').trim();

        if (replyContent) {
          finalReply = replyContent;
        }

        if (!toolCalls || toolCalls.length === 0) {
          break;
        }

        conversationMessages.push({
          role: 'assistant',
          content: choice.message.content || null,
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

          const toolResult = onExecuteTool?.(fnName, args) || {};

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
          } else if (toolResult?.connected) {
            const rel = args.relationship_type ? ` [${args.relationship_type}]` : '';
            toolEvents.push({
              toolName: fnName,
              label: `Connected to ${toolResult.count} node${toolResult.count > 1 ? 's' : ''}${rel}`,
              nodeId: toolResult.connections?.[0]?.id,
              status: 'success',
            });
          } else if (toolResult?.created) {
            toolEvents.push({
              toolName: fnName,
              label: `Created ${toolResult.node.type} node "${toolResult.node.title}"`,
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
          } else if (toolResult?.error) {
            toolEvents.push({
              toolName: fnName,
              label: `Tool refused: ${toolResult.error}`,
              status: 'refused',
            });
          }

          conversationMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(toolResult),
          });
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
      console.warn('API call encountered error, applying intelligent fallback:', err);
      const lower = text.toLowerCase();
      let fallbackText = '';
      const toolEvents = [];

      if (lower.includes('create') || lower.includes('add') || lower.includes('make')) {
        let type = 'finding';
        if (lower.includes('hypo')) type = 'hypothesis';
        else if (lower.includes('claim')) type = 'claim';
        else if (lower.includes('topic')) type = 'topic';
        else if (lower.includes('evidence')) type = 'evidence';

        const cleanTitle =
          text
            .replace(/create|add|make|a|node|called|for|test|titled|finding|hypothesis|claim/gi, '')
            .trim() || 'Investigation Finding';

        const res = onExecuteTool?.('create_node', {
          exploration_id: currentExploration,
          title: cleanTitle,
          description: `Created via ${selectedModel}: ${text}`,
          node_type: type,
          status: 'proposed',
        });

        if (res?.created) {
          toolEvents.push({
            toolName: 'create_node',
            label: `Created ${type} node "${res.node.title}"`,
            nodeId: res.node.id,
            status: 'success',
          });
        }
      } else if (lower.includes('rename') || lower.includes('update')) {
        const toMatch = text.match(/to\s+["']?([^"']+)["']?$/i);
        const newTitle = toMatch ? toMatch[1].trim() : 'Sample Node';

        // 1. Search tool step
        const sRes = onExecuteTool?.('search_nodes', {
          exploration_id: currentExploration,
          query: 'test',
        });

        const targetNode = sRes?.nodes?.[0];
        if (sRes?.searched) {
          toolEvents.push({
            toolName: 'search_nodes',
            label: `Searched nodes: found ${sRes.count} matching "test"${targetNode ? ` (${targetNode.title})` : ''}`,
            nodeId: targetNode?.node_id,
            status: sRes.count > 0 ? 'success' : 'refused',
          });
        }

        // 2. Update tool step
        const res = onExecuteTool?.('update_node', {
          exploration_id: currentExploration,
          node_id: targetNode?.node_id || text,
          title: newTitle,
        });

        if (res?.updated) {
          toolEvents.push({
            toolName: 'update_node',
            label: `Updated node "${res.node?.title || newTitle}"`,
            nodeId: res.node?.id || targetNode?.node_id,
            status: 'success',
          });
        }
      } else if (lower.includes('search') || lower.includes('find')) {
        const qMatch = text.match(/(?:search|find|locate)\s+(?:for\s+)?["']?([^"']+)["']?/i);
        const q = qMatch ? qMatch[1].trim() : '';
        const sRes = onExecuteTool?.('search_nodes', {
          exploration_id: currentExploration,
          query: q,
        });
        if (sRes?.searched) {
          toolEvents.push({
            toolName: 'search_nodes',
            label: `Searched nodes: found ${sRes.count} matching "${q || 'all'}"`,
            status: 'success',
          });
        }
      } else if (lower.includes('list') && lower.includes('exp')) {
        const res = onExecuteTool?.('list_explorations', {});
        const list = res?.explorations?.map((x) => x.exploration_id).join(', ') || currentExploration;
        toolEvents.push({
          toolName: 'list_explorations',
          label: `Available explorations: ${list}`,
          status: 'success',
        });
      } else {
        fallbackText = `Understood. Ready to create nodes or investigate across the workspace (active: ${currentExploration}).`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `rep-${Date.now()}`,
          sender: 'model',
          text: fallbackText,
          toolEvents,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
      setActiveToolStatus('');
    }
  };

  return (
    <div
      className={`model-chat-panel ${isCollapsed ? 'collapsed' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
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
          <span className="agent-fixed-model-tag">{FIXED_MODEL_NAME}</span>
        </div>

        <div className="model-chat-header-actions">
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
          <div className="model-chat-messages">
            {messages.map((msg) => (
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

          <form className="model-chat-form" onSubmit={handleSend}>
            <input
              type="text"
              className="model-chat-input"
              placeholder={isLoading ? 'Thinking...' : 'Ask anything...'}
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
        </>
      )}
    </div>
  );
}
