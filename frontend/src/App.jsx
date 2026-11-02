import { useState, useEffect, useRef, useMemo } from 'react';
import DotGridCanvas from './components/Canvas/DotGridCanvas';
import MovableNode from './components/Node/MovableNode';
import WorkflowNode from './components/Workflow/WorkflowNode';
import WorkflowIOModal from './components/Workflow/WorkflowIOModal';
import AgentConfigModal from './components/Workflow/AgentConfigModal';
import Thread from './components/Thread/Thread';
import Minimap from './components/Minimap/Minimap';
import ZoomControls from './components/Controls/ZoomControls';
import Sidebar from './components/Sidebar/Sidebar';
import DocumentModal from './components/DocumentModal/DocumentModal';
import ProjectsPage from './components/Projects/ProjectsPage';
import DocumentsPage from './components/Documents/DocumentsPage';
import ToolsPage from './components/Tools/ToolsPage';
import EnginesPage from './components/Engines/EnginesPage';
import Breadcrumbs from './components/Navigation/Breadcrumbs';
import ModelsPanel from './components/Models/ModelsPanel';
import ModelChatPanel from './components/Chat/ModelChatPanel';
import { executeNodeTool } from './tools/nodeLifecycleTools';
import { uploadToCloudinary } from './utils/cloudinary';
import { saveProject, getProject, getAllProjects } from './utils/db';
import ProjectLoadingScreen from './components/Common/ProjectLoadingScreen';

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function App() {
  const [currentView, setCurrentView] = useState('projects'); // 'projects' | 'canvas' | 'workflow' | 'documents' | 'tools' | 'engines'
  const [currentProject, setCurrentProject] = useState(null);
  const [isProjectLoading, setIsProjectLoading] = useState(() => {
    // Check if initial hash is pointing to a project so we show loading right away on refresh
    try {
      const hash = window.location.hash || '';
      const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
      return parts[0] === 'projects' && Boolean(parts[1]);
    } catch (_) {
      return false;
    }
  });
  const [loadingProjectName, setLoadingProjectName] = useState('');

  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [nodes, setNodes] = useState({});
  const [connections, setConnections] = useState({});
  const [selectedDocNode, setSelectedDocNode] = useState(null);
  const [isDocsCollectionOpen, setIsDocsCollectionOpen] = useState(false);
  const [explorations, setExplorations] = useState(['exploration_01']);
  const [currentExploration, setCurrentExploration] = useState('exploration_01');
  const [workflows, setWorkflows] = useState(['extraction']);
  const [currentWorkflow, setCurrentWorkflow] = useState('extraction');
  const [engines, setEngines] = useState(['file_detection']);
  const [currentEngine, setCurrentEngine] = useState('file_detection');
  const [enginesData, setEnginesData] = useState({});
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);
  const [selectedWorkflowNodeId, setSelectedWorkflowNodeId] = useState(null);
  const [selectedAgentNodeId, setSelectedAgentNodeId] = useState(null);
  const [activeNodeMenuId, setActiveNodeMenuId] = useState(null);
  const [workflowThreads, setWorkflowThreads] = useState([
    { id: 'th-default', from: 'input', to: 'output' },
  ]);
  const [liveConnectingThread, setLiveConnectingThread] = useState(null);
  const [workflowNodes, setWorkflowNodes] = useState({
    input: {
      id: 'input',
      title: 'Input',
      sub: '5 input formats',
      type: 'input',
      x: 120,
      y: 220,
      width: 175,
      height: 56,
      acceptedTypes: ['documents', 'text', 'images', 'audio', 'data'],
      sourceScope: 'uploaded_documents',
    },
    output: {
      id: 'output',
      title: 'Output',
      sub: '',
      type: 'output',
      x: 520,
      y: 220,
      width: 175,
      height: 56,
    },
  });
  const [notification, setNotification] = useState(null);
  const [globalDocCount, setGlobalDocCount] = useState(0);

  const isSyncingHashRef = useRef(false);
  const isInitialHashParsedRef = useRef(false);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;
  const nodeList = useMemo(() => Object.values(nodes || {}), [nodes]);

  useEffect(() => {
    let isMounted = true;
    const fetchGlobalDocs = async () => {
      try {
        const projects = await getAllProjects();
        const allDocIds = new Set();
        const isDocNode = (n) =>
          Boolean(
            n &&
              (n.category === 'resource' ||
                n.type === 'document' ||
                n.node_type === 'document' ||
                Boolean(n.fileSize) ||
                Boolean(n.file_size) ||
                Boolean(n.cloudinaryUrl) ||
                (n.name && /\.(pdf|png|jpe?g|webp|docx?|txt|csv|xlsx?)$/i.test(n.name)))
          );

        projects.forEach((proj) => {
          if (proj.explorationsData) {
            Object.values(proj.explorationsData).forEach((exp) => {
              if (exp?.nodes) {
                Object.values(exp.nodes).forEach((n) => {
                  if (isDocNode(n) && n.id) allDocIds.add(n.id);
                });
              }
            });
          } else if (proj.nodes) {
            Object.values(proj.nodes).forEach((n) => {
              if (isDocNode(n) && n.id) allDocIds.add(n.id);
            });
          }
        });

        if (isMounted) setGlobalDocCount(allDocIds.size);
      } catch (err) {
        console.error('Failed to load global doc count:', err);
      }
    };

    fetchGlobalDocs();
  }, [currentProject, nodes, currentView]);

  const totalDocCount = useMemo(() => {
    const isDocNode = (n) =>
      Boolean(
        n &&
          (n.category === 'resource' ||
            n.type === 'document' ||
            n.node_type === 'document' ||
            Boolean(n.fileSize) ||
            Boolean(n.file_size) ||
            Boolean(n.cloudinaryUrl) ||
            (n.name && /\.(pdf|png|jpe?g|webp|docx?|txt|csv|xlsx?)$/i.test(n.name)))
      );

    const docIds = new Set();

    // 1. Check current memory nodes
    Object.values(nodes || {}).forEach((n) => {
      if (isDocNode(n) && n.id) docIds.add(n.id);
    });

    // 2. Check current project across all explorations
    const proj = currentProjectRef.current || currentProject;
    if (proj?.explorationsData) {
      Object.values(proj.explorationsData).forEach((exp) => {
        if (exp?.nodes) {
          Object.values(exp.nodes).forEach((n) => {
            if (isDocNode(n) && n.id) docIds.add(n.id);
          });
        }
      });
    }

    if (proj?.nodes) {
      Object.values(proj.nodes).forEach((n) => {
        if (isDocNode(n) && n.id) docIds.add(n.id);
      });
    }

    return docIds.size;
  }, [nodes, currentProject]);

  const effectiveDocCount = totalDocCount || globalDocCount;

  // Sync state to URL hash (ONLY after initial route hash has been read & resolved)
  useEffect(() => {
    if (!isInitialHashParsedRef.current || isSyncingHashRef.current) return;

    let targetHash = '#/projects';
    if (currentView === 'projects') {
      targetHash = '#/projects';
    } else if (currentProject) {
      if (currentView === 'workflow') {
        targetHash = `#/projects/${currentProject.id}/workflow/${currentWorkflow}`;
      } else if (currentView === 'engines') {
        targetHash = `#/projects/${currentProject.id}/engine/${currentEngine}`;
      } else if (currentView === 'documents') {
        targetHash = `#/projects/${currentProject.id}/documents`;
      } else if (currentView === 'tools') {
        targetHash = `#/projects/${currentProject.id}/tools`;
      } else {
        targetHash = `#/projects/${currentProject.id}/exploration/${currentExploration}`;
      }
    } else if (currentView === 'documents') {
      targetHash = '#/documents';
    }

    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, [currentView, currentProject, currentExploration, currentWorkflow, currentEngine]);

  // Sync URL hash to state (on mount & on hashchange)
  useEffect(() => {
    async function handleHashChange() {
      const hash = window.location.hash || '#/projects';
      const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

      if (parts.length === 0 || (parts[0] === 'projects' && parts.length === 1)) {
        isSyncingHashRef.current = true;
        setCurrentView('projects');
        setCurrentProject(null);
        currentProjectRef.current = null;
        setIsProjectLoading(false);
        setTimeout(() => {
          isSyncingHashRef.current = false;
          isInitialHashParsedRef.current = true;
        }, 50);
        return;
      }

      if (parts[0] === 'documents') {
        isSyncingHashRef.current = true;
        setCurrentView('documents');
        setIsProjectLoading(false);
        setTimeout(() => {
          isSyncingHashRef.current = false;
          isInitialHashParsedRef.current = true;
        }, 50);
        return;
      }

      if (parts[0] === 'projects' && parts[1]) {
        const projId = parts[1];
        // If reloading or switching to a different project
        if (!currentProjectRef.current || currentProjectRef.current.id !== projId) {
          setIsProjectLoading(true);
          try {
            const proj = await getProject(projId);
            if (proj) {
              isSyncingHashRef.current = true;
              currentProjectRef.current = proj;
              setCurrentProject(proj);
              setLoadingProjectName(proj.name || '');

              const exps = proj.explorations && proj.explorations.length > 0
                ? proj.explorations
                : ['exploration_01'];
              setExplorations(exps);

              if (proj.workflows && proj.workflows.length > 0) {
                setWorkflows(proj.workflows);
              }

              if (proj.engines && proj.engines.length > 0) {
                setEngines(proj.engines);
              }
              if (proj.enginesData) {
                setEnginesData(proj.enginesData);
              }
              if (proj.currentEngine) {
                setCurrentEngine(proj.currentEngine);
              }

              // Pre-load workflow data
              const activeWf = proj.currentWorkflow || (proj.workflows?.[0] || 'extraction');
              setCurrentWorkflow(activeWf);
              if (proj.workflowsData?.[activeWf]) {
                if (proj.workflowsData[activeWf].nodes) setWorkflowNodes(proj.workflowsData[activeWf].nodes);
                if (proj.workflowsData[activeWf].threads) setWorkflowThreads(proj.workflowsData[activeWf].threads);
              }

              // Pre-load exploration data
              const activeExp = parts[2] === 'exploration' && parts[3]
                ? parts[3]
                : proj.currentExploration && exps.includes(proj.currentExploration)
                ? proj.currentExploration
                : exps[0];
              setCurrentExploration(activeExp);
              const expNodes = proj.explorationsData?.[activeExp]?.nodes || proj.nodes || {};
              const expConnections = proj.explorationsData?.[activeExp]?.connections || proj.connections || {};
              setNodes(expNodes);
              setConnections(expConnections);

              if (parts[2] === 'workflow') {
                const wfName = parts[3] || activeWf;
                setCurrentWorkflow(wfName);
                if (proj.workflowsData?.[wfName]) {
                  if (proj.workflowsData[wfName].nodes) setWorkflowNodes(proj.workflowsData[wfName].nodes);
                  if (proj.workflowsData[wfName].threads) setWorkflowThreads(proj.workflowsData[wfName].threads);
                }
                setCurrentView('workflow');
              } else if (parts[2] === 'engine') {
                const engName = parts[3] || proj.currentEngine || (proj.engines?.[0] || 'file_detection');
                setCurrentEngine(engName);
                setCurrentView('engines');
              } else if (parts[2] === 'documents') {
                setCurrentView('documents');
              } else if (parts[2] === 'tools') {
                setCurrentView('tools');
              } else {
                setCurrentView('canvas');
              }
            } else {
              // Project not found in database, revert to projects list
              setCurrentView('projects');
              setCurrentProject(null);
              currentProjectRef.current = null;
              window.location.hash = '#/projects';
            }
          } catch (err) {
            console.error('Failed to load project from URL route:', err);
            setCurrentView('projects');
            setCurrentProject(null);
            currentProjectRef.current = null;
          } finally {
            setIsProjectLoading(false);
            setTimeout(() => {
              isSyncingHashRef.current = false;
              isInitialHashParsedRef.current = true;
            }, 50);
          }
        } else {
          // Already have project in memory, just update subview
          const proj = currentProjectRef.current;
          isSyncingHashRef.current = true;
          if (parts[2] === 'workflow') {
            const wfName = parts[3] || proj.currentWorkflow || 'extraction';
            setCurrentWorkflow(wfName);
            if (proj.workflowsData?.[wfName]) {
              if (proj.workflowsData[wfName].nodes) setWorkflowNodes(proj.workflowsData[wfName].nodes);
              if (proj.workflowsData[wfName].threads) setWorkflowThreads(proj.workflowsData[wfName].threads);
            }
            setCurrentView('workflow');
          } else if (parts[2] === 'engine') {
            const engName = parts[3] || proj.currentEngine || 'file_detection';
            setCurrentEngine(engName);
            setCurrentView('engines');
          } else if (parts[2] === 'documents') {
            setCurrentView('documents');
          } else if (parts[2] === 'tools') {
            setCurrentView('tools');
          } else {
            const expName = parts[3] || proj.currentExploration || explorations[0];
            setCurrentExploration(expName);
            const expNodes = proj.explorationsData?.[expName]?.nodes || proj.nodes || {};
            const expConnections = proj.explorationsData?.[expName]?.connections || proj.connections || {};
            setNodes(expNodes);
            setConnections(expConnections);
            setCurrentView('canvas');
          }
          setIsProjectLoading(false);
          setTimeout(() => {
            isSyncingHashRef.current = false;
            isInitialHashParsedRef.current = true;
          }, 50);
        }
        return;
      }

      isInitialHashParsedRef.current = true;
    }

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Track viewport resize
  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const persistProjectNodes = (updatedNodes, expName = currentExploration, updatedConnections = connectionsRef.current) => {
    const proj = currentProjectRef.current;
    if (proj) {
      const currentExpEntry = proj.explorationsData?.[expName] || {};
      const updatedExplorationsData = {
        ...(proj.explorationsData || {}),
        [expName]: {
          ...currentExpEntry,
          nodes: updatedNodes,
          connections: updatedConnections,
        },
      };

      const updatedProject = {
        ...proj,
        createdAt: proj.createdAt || new Date().toISOString(),
        explorationsData: updatedExplorationsData,
        currentExploration: expName,
        updatedAt: new Date().toISOString(),
      };

      currentProjectRef.current = updatedProject;
      setCurrentProject(updatedProject);
      saveProject(updatedProject).catch((err) => console.error('Failed to auto-save project nodes & connections:', err));
    }
  };

  const handleNodeMove = (id, newX, newY) => {
    setNodes((prev) => {
      const next = {
        ...prev,
        [id]: {
          ...prev[id],
          x: newX,
          y: newY,
        },
      };
      persistProjectNodes(next);
      return next;
    });
  };

  const handleRenameNode = (id, newName) => {
    setNodes((prev) => {
      if (!prev[id]) return prev;
      const next = {
        ...prev,
        [id]: {
          ...prev[id],
          name: newName,
        },
      };
      persistProjectNodes(next);
      return next;
    });
    setSelectedDocNode((prev) => (prev && prev.id === id ? { ...prev, name: newName } : prev));
  };

  const persistWorkflow = (nextNodes, nextThreads) => {
    if (!currentProjectRef.current) return;
    const wfName = currentWorkflow || 'extraction';
    const updatedWorkflowsData = {
      ...(currentProjectRef.current.workflowsData || {}),
      [wfName]: {
        nodes: nextNodes || workflowNodes,
        threads: nextThreads !== undefined ? nextThreads : workflowThreads,
      },
    };
    const updatedProject = {
      ...currentProjectRef.current,
      workflows: workflows,
      currentWorkflow: wfName,
      workflowsData: updatedWorkflowsData,
      updatedAt: new Date().toISOString(),
    };
    currentProjectRef.current = updatedProject;
    setCurrentProject(updatedProject);
    saveProject(updatedProject).catch((err) => console.error('Failed to auto-save workflow:', err));
  };

  const handleWorkflowNodeMove = (id, newX, newY) => {
    setWorkflowNodes((prev) => {
      const next = {
        ...prev,
        [id]: {
          ...prev[id],
          x: newX,
          y: newY,
        },
      };
      persistWorkflow(next, workflowThreads);
      return next;
    });
  };

  const handleUpdateWorkflowNode = (id, updated) => {
    setWorkflowNodes((prev) => {
      const nextSub = id === 'input'
        ? `${updated.acceptedTypes?.length || 0} input formats`
        : `${updated.outputTypes?.length || 0} output types`;
      const next = {
        ...prev,
        [id]: {
          ...prev[id],
          ...updated,
          sub: nextSub,
        },
      };
      persistWorkflow(next, workflowThreads);
      return next;
    });
  };

  const handleAddAgent = (model, pos) => {
    const id = `agent_${Date.now().toString(36)}`;
    const modelName = model?.name || 'Muse Spark 1.3';
    const modelId = model?.id || 'muse-spark-1.3';

    let defaultX = 320;
    let defaultY = 220;
    if (pos && typeof pos.x === 'number') {
      defaultX = pos.x;
      defaultY = pos.y;
    } else if (workflowNodes.input && workflowNodes.output) {
      defaultX = (workflowNodes.input.x + workflowNodes.output.x) / 2;
      defaultY = (workflowNodes.input.y + workflowNodes.output.y) / 2;
    }

    const newAgent = {
      id,
      title: 'Agent',
      sub: modelName,
      type: 'agent',
      modelId,
      modelName,
      systemPrompt: '',
      temperature: 0.7,
      x: defaultX,
      y: defaultY,
      width: 175,
      height: 56,
    };

    // Nodes are independent with no forced auto-connection
    setWorkflowNodes((prev) => {
      const next = { ...prev, [id]: newAgent };
      persistWorkflow(next, workflowThreads);
      return next;
    });
  };

  const handleUpdateAgent = (agentId, updatedData) => {
    setWorkflowNodes((prev) => {
      const next = {
        ...prev,
        [agentId]: {
          ...prev[agentId],
          ...updatedData,
        },
      };
      persistWorkflow(next, workflowThreads);
      return next;
    });
  };

  const handleDuplicateAgent = (id) => {
    const node = workflowNodes[id];
    if (!node) return;
    const newId = `agent_${Date.now()}`;
    const duplicatedNode = {
      ...node,
      id: newId,
      title: node.title ? `${node.title} (Copy)` : 'Agent (Copy)',
      x: node.x + 35,
      y: node.y + 35,
    };

    setWorkflowNodes((prev) => {
      const next = { ...prev, [newId]: duplicatedNode };
      persistWorkflow(next, workflowThreads);
      return next;
    });
    setActiveNodeMenuId(null);
  };

  const handleDeleteAgent = (agentId) => {
    if (agentId === 'input' || agentId === 'output') return; // input & output are permanent

    setWorkflowNodes((prev) => {
      const next = { ...prev };
      delete next[agentId];

      setWorkflowThreads((prevThreads) => {
        const nextThreads = prevThreads.filter((t) => t.from !== agentId && t.to !== agentId);
        persistWorkflow(next, nextThreads);
        return nextThreads;
      });

      return next;
    });

    if (selectedAgentNodeId === agentId) setSelectedAgentNodeId(null);
    if (activeNodeMenuId === agentId) setActiveNodeMenuId(null);
  };

  const handleDeleteThread = (threadId, fromId, toId) => {
    setWorkflowThreads((prev) => {
      const next = prev.filter((t) => {
        if (threadId && t.id) return t.id !== threadId;
        if (fromId && toId) return !(t.from === fromId && t.to === toId);
        return false;
      });
      persistWorkflow(workflowNodes, next);
      return next;
    });
  };

  const handleWorkflowNodeClick = (id) => {
    const node = workflowNodes[id];
    if (!node) return;
    if (node.type === 'agent') {
      // Single click opens the agent modal directly
      setSelectedAgentNodeId(id);
    } else if (node.type === 'input') {
      // Single click on input opens the input configuration modal
      setSelectedWorkflowNodeId(id);
    }
    // Output node does not need any modal as it will just show the AI data
  };

  const handleOpenAgentConfig = (id) => {
    setActiveNodeMenuId(null);
    setSelectedAgentNodeId(id);
  };

  const handlePortStart = (nodeId, portType) => {
    if (portType === 'out') {
      const node = workflowNodes[nodeId];
      if (!node) return;
      setActiveNodeMenuId(null);
      setLiveConnectingThread({
        from: nodeId,
        currentX: node.x + (node.width || 175),
        currentY: node.y + (node.height || 56) / 2,
      });
    }
  };

  const handlePortEnd = (targetNodeId, portType) => {
    if (liveConnectingThread && portType === 'in') {
      const sourceId = liveConnectingThread.from;
      if (sourceId && sourceId !== targetNodeId) {
        setWorkflowThreads((prev) => {
          if (prev.some((t) => t.from === sourceId && t.to === targetNodeId)) {
            return prev;
          }
          // Connect to any node freely without replacing existing connections
          const newThread = {
            id: `th-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            from: sourceId,
            to: targetNodeId,
          };
          const next = [...prev, newThread];
          persistWorkflow(workflowNodes, next);
          return next;
        });
      }
    }
    setLiveConnectingThread(null);
  };

  const handleCanvasPointerMove = (e) => {
    if (!liveConnectingThread) return;
    const rect = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - camera.x) / camera.zoom;
    const worldY = (screenY - camera.y) / camera.zoom;
    setLiveConnectingThread((prev) => (prev ? { ...prev, currentX: worldX, currentY: worldY } : null));
  };

  const handleCanvasPointerUp = (e) => {
    if (liveConnectingThread) {
      if (e && e.clientX && e.clientY) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = el?.closest('.workflow-node');
        if (nodeEl) {
          const targetNodeId = nodeEl.dataset.nodeId;
          const targetNode = workflowNodes[targetNodeId];
          if (targetNode && (targetNode.type === 'output' || targetNode.type === 'agent')) {
            if (targetNodeId !== liveConnectingThread.from) {
              handlePortEnd(targetNodeId, 'in');
              return;
            }
          }
        }
      }
      setLiveConnectingThread(null);
    }
  };

  const handleCreateWorkflow = () => {
    const count = workflows.length;
    let nextName = `workflow_${String(count).padStart(2, '0')}`;
    let suffix = count;
    while (workflows.includes(nextName)) {
      suffix++;
      nextName = `workflow_${String(suffix).padStart(2, '0')}`;
    }

    const nextWorkflows = [...workflows, nextName];
    setWorkflows(nextWorkflows);
    setCurrentWorkflow(nextName);
    setCurrentView('workflow');

    const defaultNodes = {
      input: {
        id: 'input',
        title: 'Input',
        sub: '5 input formats',
        type: 'input',
        x: 120,
        y: 220,
        width: 175,
        height: 56,
        acceptedTypes: ['documents', 'text', 'images', 'audio', 'data'],
        sourceScope: 'uploaded_documents',
      },
      output: {
        id: 'output',
        title: 'Output',
        sub: '',
        type: 'output',
        x: 520,
        y: 220,
        width: 175,
        height: 56,
      },
    };
    const defaultThreads = [{ id: `th-${Date.now()}`, from: 'input', to: 'output' }];

    setWorkflowNodes(defaultNodes);
    setWorkflowThreads(defaultThreads);

    if (currentProjectRef.current) {
      const updatedProject = {
        ...currentProjectRef.current,
        workflows: nextWorkflows,
        currentWorkflow: nextName,
        workflowsData: {
          ...(currentProjectRef.current.workflowsData || {}),
          [nextName]: {
            nodes: defaultNodes,
            threads: defaultThreads,
          },
        },
        updatedAt: new Date().toISOString(),
      };
      currentProjectRef.current = updatedProject;
      setCurrentProject(updatedProject);
      saveProject(updatedProject).catch((err) => console.error('Failed to save new workflow:', err));
    }
  };

  const handleSelectWorkflow = (wfName) => {
    setCurrentWorkflow(wfName);
    setCurrentView('workflow');
    const wfData = currentProjectRef.current?.workflowsData?.[wfName];
    if (wfData) {
      if (wfData.nodes) setWorkflowNodes(wfData.nodes);
      if (wfData.threads) setWorkflowThreads(wfData.threads);
    }
    if (currentProjectRef.current) {
      const updatedProject = {
        ...currentProjectRef.current,
        currentWorkflow: wfName,
        updatedAt: new Date().toISOString(),
      };
      currentProjectRef.current = updatedProject;
      setCurrentProject(updatedProject);
      saveProject(updatedProject).catch((err) => console.error('Failed to save selected workflow:', err));
    }
  };

  const handleSelectEngine = (engName) => {
    setCurrentEngine(engName);
    setCurrentView('engines');
    if (currentProjectRef.current) {
      const updatedProject = {
        ...currentProjectRef.current,
        currentEngine: engName,
        updatedAt: new Date().toISOString(),
      };
      currentProjectRef.current = updatedProject;
      setCurrentProject(updatedProject);
      saveProject(updatedProject).catch((err) => console.error('Failed to save selected engine:', err));
    }
  };

  const handleCreateEngine = () => {
    const nextNum = engines.length + 1;
    const nextName = `engine_${String(nextNum).padStart(2, '0')}`;
    const nextEngines = [...engines, nextName];
    const initialCode = `# ${nextName}
# Pure function entry: def run(input_data, context=None) -> dict

def run(input_data, context=None):
    """
    ${nextName} processing logic.
    """
    return {
        "status": "success",
        "engine": "${nextName}",
        "output": input_data
    }
`;
    const nextEnginesData = {
      ...enginesData,
      [nextName]: {
        id: nextName,
        code: initialCode,
        updatedAt: new Date().toISOString(),
      },
    };

    setEngines(nextEngines);
    setCurrentEngine(nextName);
    setEnginesData(nextEnginesData);
    setCurrentView('engines');

    if (currentProjectRef.current) {
      const updatedProject = {
        ...currentProjectRef.current,
        engines: nextEngines,
        currentEngine: nextName,
        enginesData: nextEnginesData,
        updatedAt: new Date().toISOString(),
      };
      currentProjectRef.current = updatedProject;
      setCurrentProject(updatedProject);
      saveProject(updatedProject).catch((err) => console.error('Failed to save new engine:', err));
    }
  };

  const handleUpdateEngineCode = (engId, code) => {
    setEnginesData((prev) => {
      const next = {
        ...prev,
        [engId]: {
          ...(prev[engId] || {}),
          id: engId,
          code,
          updatedAt: new Date().toISOString(),
        },
      };
      if (currentProjectRef.current) {
        const updatedProject = {
          ...currentProjectRef.current,
          enginesData: next,
          updatedAt: new Date().toISOString(),
        };
        currentProjectRef.current = updatedProject;
        setCurrentProject(updatedProject);
        saveProject(updatedProject).catch((err) => console.error('Failed to save engine code:', err));
      }
      return next;
    });
  };

  // Direct canvas drag-and-drop handler with Cloudinary upload
  const handleFileDrop = async (file, pos) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setNotification(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
      return;
    }

    // Generate permanent node ID immediately: e.g. "node_doc_a8f3b2"
    const shortHash = Math.random().toString(36).substring(2, 8);
    const nodeId = `node_doc_${shortHash}`;
    const defaultX = (viewport.width / 2 - camera.x) / camera.zoom - 140;
    const defaultY = (viewport.height / 2 - camera.y) / camera.zoom - 40;

    const initialNode = {
      id: nodeId,
      node_id: nodeId,
      name: file.name,
      title: file.name,
      fileSize: file.size,
      type: 'document',
      node_type: 'document',
      category: 'resource',
      status: 'uploading',
      uploading: true,
      x: pos ? pos.x : defaultX,
      y: pos ? pos.y : defaultY,
      width: 280,
      height: 72,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Show immediately on canvas with stable node_id
    setNodes((prev) => {
      const next = { ...prev, [nodeId]: initialNode };
      persistProjectNodes(next);
      return next;
    });

    // Trigger Cloudinary upload in background
    try {
      const result = await uploadToCloudinary(file);

      const finalizedNode = {
        ...initialNode,
        publicId: result.public_id,
        assetId: result.asset_id,
        cloudinaryUrl: result.secure_url,
        status: 'not checked',
        uploading: false,
        updatedAt: new Date().toISOString(),
      };

      setNodes((prev) => {
        const next = { ...prev, [nodeId]: finalizedNode };
        persistProjectNodes(next);
        return next;
      });

      setSelectedDocNode((prev) => (prev && prev.id === nodeId ? finalizedNode : prev));
    } catch (err) {
      console.error('Upload error:', err);
      setNotification(`Upload failed: ${err.message || 'Cloudinary error'}`);
      setNodes((prev) => {
        if (!prev[nodeId]) return prev;
        const next = {
          ...prev,
          [nodeId]: {
            ...prev[nodeId],
            status: 'upload failed',
            uploading: false,
            updatedAt: new Date().toISOString(),
          },
        };
        persistProjectNodes(next);
        return next;
      });
      setSelectedDocNode((prev) =>
        prev && prev.id === nodeId
          ? { ...prev, status: 'upload failed', uploading: false }
          : prev
      );
    }
  };

  const handleSelectProject = async (project) => {
    if (!project || !project.id) return;
    try {
      setIsProjectLoading(true);
      setLoadingProjectName(project.name || '');

      // Load full project details from IndexedDB (lightweight list avoids memory issues)
      const fullProject = (await getProject(project.id)) || project;

      currentProjectRef.current = fullProject;
      setCurrentProject(fullProject);

      const exps = fullProject.explorations && fullProject.explorations.length > 0
        ? fullProject.explorations
        : ['exploration_01'];
      setExplorations(exps);

      if (fullProject.workflows && fullProject.workflows.length > 0) {
        setWorkflows(fullProject.workflows);
      }

      if (fullProject.engines && fullProject.engines.length > 0) {
        setEngines(fullProject.engines);
      }
      if (fullProject.currentEngine) {
        setCurrentEngine(fullProject.currentEngine);
      }
      if (fullProject.enginesData) {
        setEnginesData(fullProject.enginesData);
      }

      const activeWf = fullProject.currentWorkflow || 'extraction';
      setCurrentWorkflow(activeWf);
      if (fullProject.workflowsData?.[activeWf]) {
        if (fullProject.workflowsData[activeWf].nodes) {
          setWorkflowNodes(fullProject.workflowsData[activeWf].nodes);
        }
        if (fullProject.workflowsData[activeWf].threads) {
          setWorkflowThreads(fullProject.workflowsData[activeWf].threads);
        }
      }

      const activeExp = fullProject.currentExploration && exps.includes(fullProject.currentExploration)
        ? fullProject.currentExploration
        : exps[0];
      setCurrentExploration(activeExp);

      const expData = fullProject.explorationsData;
      const initialNodes = expData?.[activeExp]?.nodes || fullProject.nodes || {};
      const initialConnections = expData?.[activeExp]?.connections || fullProject.connections || {};
      setNodes(initialNodes);
      setConnections(initialConnections);
      setSelectedDocNode(null);

      isSyncingHashRef.current = true;
      setCurrentView('canvas');
      window.location.hash = `#/projects/${fullProject.id}/exploration/${activeExp}`;
      setTimeout(() => {
        isSyncingHashRef.current = false;
        isInitialHashParsedRef.current = true;
      }, 50);
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setIsProjectLoading(false);
    }
  };

  const handleGoToProjects = () => {
    isSyncingHashRef.current = true;
    setCurrentProject(null);
    currentProjectRef.current = null;
    setCurrentView('projects');
    window.location.hash = '#/projects';
    setTimeout(() => {
      isSyncingHashRef.current = false;
      isInitialHashParsedRef.current = true;
    }, 50);
  };

  const handleCreateExploration = () => {
    // 1. Preserve current nodes and connections under current exploration
    const currentExpData = {
      ...(currentProject?.explorationsData || {}),
      [currentExploration]: {
        nodes: nodes,
        connections: connections,
      },
    };

    const nextNum = explorations.length + 1;
    const newName = `exploration_${String(nextNum).padStart(2, '0')}`;
    const nextList = [...explorations, newName];

    currentExpData[newName] = { nodes: {}, connections: {} };

    setExplorations(nextList);
    setCurrentExploration(newName);
    setNodes({});
    setConnections({});
    setSelectedDocNode(null);
    setCamera({ x: 0, y: 0, zoom: 1 });

    const proj = currentProjectRef.current || currentProject;
    if (proj) {
      const updatedProject = {
        ...proj,
        explorations: nextList,
        explorationsData: currentExpData,
        currentExploration: newName,
        updatedAt: new Date().toISOString(),
      };
      currentProjectRef.current = updatedProject;
      setCurrentProject(updatedProject);
      saveProject(updatedProject).catch((err) => console.error('Failed to save new exploration:', err));
    }
  };

  const handleSelectExploration = (targetExp) => {
    if (targetExp === currentExploration) return;

    // 1. Preserve current nodes and connections under current exploration
    const proj = currentProjectRef.current || currentProject;
    const currentExpData = {
      ...(proj?.explorationsData || {}),
      [currentExploration]: {
        nodes: nodes,
        connections: connections,
      },
    };

    // 2. Load target exploration nodes & connections
    const targetNodes = currentExpData[targetExp]?.nodes || {};
    const targetConnections = currentExpData[targetExp]?.connections || {};
    setNodes(targetNodes);
    setConnections(targetConnections);
    setCurrentExploration(targetExp);
    setSelectedDocNode(null);

    if (proj) {
      const updatedProject = {
        ...proj,
        explorationsData: currentExpData,
        currentExploration: targetExp,
        updatedAt: new Date().toISOString(),
      };
      currentProjectRef.current = updatedProject;
      setCurrentProject(updatedProject);
      saveProject(updatedProject).catch((err) => console.error('Failed to switch exploration:', err));
    }
  };

  const handleExecuteInvestigationTool = (toolName, args) => {
    const targetExp = args?.exploration_id || currentExploration;
    const currentExpNodes =
      targetExp === currentExploration
        ? nodesRef.current
        : currentProjectRef.current?.explorationsData?.[targetExp]?.nodes || {};
    const currentExpConnections =
      targetExp === currentExploration
        ? connectionsRef.current
        : currentProjectRef.current?.explorationsData?.[targetExp]?.connections || {};

    const res = executeNodeTool(
      {
        ...(currentProjectRef.current?.explorationsData || {}),
        [targetExp]: { nodes: currentExpNodes, connections: currentExpConnections },
      },
      targetExp,
      toolName,
      args
    );

    let nextNodes = currentExpNodes;
    let nextConnections = currentExpConnections;

    if (res.updatedNodes) {
      nextNodes = res.updatedNodes;
      if (targetExp === currentExploration) {
        nodesRef.current = res.updatedNodes;
        setNodes(res.updatedNodes);
      }
    }

    if (res.updatedConnections) {
      nextConnections = res.updatedConnections;
      if (targetExp === currentExploration) {
        connectionsRef.current = res.updatedConnections;
        setConnections(res.updatedConnections);
      }
    }

    persistProjectNodes(nextNodes, targetExp, nextConnections);
    return res;
  };

  // If on Projects starting page, render the Projects view
  if (currentView === 'projects') {
    return (
      <>
        {isProjectLoading && <ProjectLoadingScreen projectName={loadingProjectName} />}
        <ProjectsPage onSelectProject={handleSelectProject} />
      </>
    );
  }

  return (
    <>
      {/* Loading Screen when switching projects or restoring on refresh */}
      {isProjectLoading && <ProjectLoadingScreen projectName={loadingProjectName} />}

      {/* Toast notification for file limits & upload errors */}
      {notification && (
        <div className="app-toast" role="alert">
          <span>{notification}</span>
          <button type="button" onClick={() => setNotification(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* Top Floating Navigation: Hamburger + Breadcrumb Nav Line */}
      <header className="top-nav-bar">
        <Sidebar
          onGoToProjects={handleGoToProjects}
          onOpenDocuments={() => setCurrentView('documents')}
          docCount={effectiveDocCount}
          currentView={currentView}
          explorations={explorations}
          currentExploration={currentExploration}
          onSelectExploration={(exp) => {
            handleSelectExploration(exp);
            setCurrentView('canvas');
          }}
          onCreateExploration={() => {
            handleCreateExploration();
            setCurrentView('canvas');
          }}
          workflows={workflows}
          currentWorkflow={currentWorkflow}
          onSelectWorkflow={handleSelectWorkflow}
          onCreateWorkflow={handleCreateWorkflow}
          engines={engines}
          currentEngine={currentEngine}
          onSelectEngine={handleSelectEngine}
          onCreateEngine={handleCreateEngine}
          onOpenEngines={() => {
            setCurrentEngine(engines[0] || 'file_detection');
            setCurrentView('engines');
          }}
          onOpenTools={() => setCurrentView('tools')}
        />

        <div className="top-nav-divider" aria-hidden="true" />

        <Breadcrumbs
          projectName={currentProject?.name}
          currentView={currentView}
          explorationName={currentExploration}
          workflowName={currentWorkflow}
          engineName={currentEngine}
          onGoToProjects={handleGoToProjects}
        />
      </header>

      {/* Global Floating Model Chat (Persistent in IndexedDB across views & reloads) */}
      <ModelChatPanel
        currentExploration={currentExploration}
        nodes={nodes}
        onExecuteTool={handleExecuteInvestigationTool}
      />

      {/* Documents Page View, Tools Page View, Workflow Canvas View, or Exploration Canvas View */}
      {currentView === 'documents' ? (
        <DocumentsPage
          onOpenDocument={async (doc) => {
            try {
              const proj = await getProject(doc.projectId);
              if (proj) {
                setCurrentProject(proj);
                const exps = proj.explorations && proj.explorations.length > 0
                  ? proj.explorations
                  : ['exploration_01'];
                setExplorations(exps);

                const expName = doc.explorationName || 'exploration_01';
                setCurrentExploration(expName);

                const expNodes = proj.explorationsData?.[expName]?.nodes || proj.nodes || {};
                setNodes(expNodes);

                if (doc.x !== undefined && doc.y !== undefined) {
                  setCamera({
                    x: (viewport.width / 2) - doc.x - 140,
                    y: (viewport.height / 2) - doc.y - 40,
                    zoom: 1,
                  });
                }

                setSelectedDocNode(expNodes[doc.id] || doc);
                setCurrentView('canvas');
              }
            } catch (err) {
              console.error('Failed to open document in project:', err);
            }
          }}
        />
      ) : currentView === 'tools' ? (
        <ToolsPage />
      ) : currentView === 'engines' ? (
        <EnginesPage
          engines={engines}
          currentEngine={currentEngine}
          enginesData={enginesData}
          onSelectEngine={handleSelectEngine}
          onCreateEngine={handleCreateEngine}
          onUpdateEngineCode={handleUpdateEngineCode}
        />
      ) : currentView === 'workflow' ? (
        <>
          {/* Top-Right Expandable Interactive Minimap */}
          <Minimap
            nodes={workflowNodes}
            camera={camera}
            viewportWidth={viewport.width}
            viewportHeight={viewport.height}
            onCameraChange={setCamera}
          />

          {/* Independent Models Component below Minimap */}
          <ModelsPanel onAddModelAgent={(model) => handleAddAgent(model)} />

          {/* Bottom-Left Zoom Controls (+ / -) */}
          <ZoomControls
            camera={camera}
            viewportWidth={viewport.width}
            viewportHeight={viewport.height}
            onCameraChange={setCamera}
          />

          {/* Workflow Canvas: Exact same dot grid canvas, camera, pan/zoom */}
          <DotGridCanvas
            camera={camera}
            onCameraChange={setCamera}
            onDropFile={null}
            onDropModel={(model, pos) => handleAddAgent(model, pos)}
            onCanvasPointerMove={handleCanvasPointerMove}
            onCanvasPointerUp={handleCanvasPointerUp}
            onCanvasClick={() => setActiveNodeMenuId(null)}
          >
            {/* Connecting threads between nodes (left-click to remove) */}
            {workflowThreads.map((thread) => {
              const startNode = workflowNodes[thread.from];
              const endNode = workflowNodes[thread.to];
              if (!startNode || !endNode) return null;
              return (
                <Thread
                  key={thread.id}
                  id={thread.id}
                  start={startNode}
                  end={endNode}
                  onDelete={handleDeleteThread}
                />
              );
            })}

            {/* Live connecting thread when dragging from a join port */}
            {liveConnectingThread && workflowNodes[liveConnectingThread.from] && (
              <Thread
                start={workflowNodes[liveConnectingThread.from]}
                end={{
                  x: liveConnectingThread.currentX,
                  y: liveConnectingThread.currentY,
                  width: 0,
                  height: 0,
                }}
              />
            )}

            {/* Render all workflow nodes (Input, Output, and Agents) */}
            {Object.values(workflowNodes).map((node) => (
              <WorkflowNode
                key={node.id}
                id={node.id}
                title={node.title}
                sub={node.sub}
                type={node.type}
                x={node.x}
                y={node.y}
                width={node.width || 175}
                zoom={camera.zoom}
                isSelected={selectedWorkflowNodeId === node.id || selectedAgentNodeId === node.id}
                onMove={handleWorkflowNodeMove}
                onClick={handleWorkflowNodeClick}
                onPortStart={handlePortStart}
                onPortEnd={handlePortEnd}
              />
            ))}

            {/* Simple circular loading spinner when needed inside workflow */}
            {isWorkflowLoading && (
              <div className="workflow-spinner-wrap">
                <div className="workflow-circular-spinner" />
              </div>
            )}
          </DotGridCanvas>

          {/* Workflow Input Configuration Modal */}
          <WorkflowIOModal
            isOpen={Boolean(selectedWorkflowNodeId)}
            node={selectedWorkflowNodeId ? workflowNodes[selectedWorkflowNodeId] : null}
            onClose={() => setSelectedWorkflowNodeId(null)}
            onUpdate={handleUpdateWorkflowNode}
          />

          {/* Workflow Agent Settings Modal */}
          <AgentConfigModal
            isOpen={Boolean(selectedAgentNodeId)}
            agentNode={selectedAgentNodeId ? workflowNodes[selectedAgentNodeId] : null}
            onClose={() => setSelectedAgentNodeId(null)}
            onUpdateAgent={handleUpdateAgent}
            onDeleteAgent={handleDeleteAgent}
            onDuplicateAgent={handleDuplicateAgent}
          />
        </>
      ) : (
        <>
          {/* Top-Right Expandable Interactive Minimap */}
          <Minimap
            nodes={nodes}
            camera={camera}
            viewportWidth={viewport.width}
            viewportHeight={viewport.height}
            onCameraChange={setCamera}
          />

          {/* Bottom-Left Zoom Controls (+ / -) */}
          <ZoomControls
            camera={camera}
            viewportWidth={viewport.width}
            viewportHeight={viewport.height}
            onCameraChange={setCamera}
          />

          {/* Document Detail Modal */}
          <DocumentModal
            node={selectedDocNode}
            isOpen={!!selectedDocNode}
            onClose={() => setSelectedDocNode(null)}
            onRename={handleRenameNode}
          />

          {/* Exploration Dot Grid Canvas with Direct File Drag & Drop */}
          <DotGridCanvas
            camera={camera}
            onCameraChange={setCamera}
            onDropFile={handleFileDrop}
          >
            {/* Dynamic relationship cables between connected nodes */}
            {Object.values(connections).map((conn) => {
              const startNode = nodes[conn.source_node_id];
              const endNode = nodes[conn.target_node_id];
              if (!startNode || !endNode) return null;
              return (
                <Thread
                  key={conn.id || conn.connection_id}
                  start={startNode}
                  end={endNode}
                  label={conn.relationship_type}
                />
              );
            })}

            {/* Dynamic movable document nodes */}
            {Object.values(nodes).map((node) => (
              <MovableNode
                key={node.id}
                id={node.id}
                x={node.x}
                y={node.y}
                width={node.width}
                zoom={camera.zoom}
                data={node}
                onMove={handleNodeMove}
                onClick={() => setSelectedDocNode(node)}
              />
            ))}
          </DotGridCanvas>
        </>
      )}
    </>
  );
}
