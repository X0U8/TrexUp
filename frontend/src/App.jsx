import { useState, useEffect, useRef, useMemo } from 'react';
import DotGridCanvas from './components/Canvas/DotGridCanvas';
import MovableNode from './components/Node/MovableNode';
import WorkflowNode from './components/Workflow/WorkflowNode';
import WorkflowIOModal from './components/Workflow/WorkflowIOModal';
import AgentConfigModal from './components/Workflow/AgentConfigModal';
import EngineConfigModal from './components/Workflow/EngineConfigModal';
import Thread from './components/Thread/Thread';
import ThreadConditionModal from './components/Thread/ThreadConditionModal';
import ExplorationThreadModal from './components/Thread/ExplorationThreadModal';
import Minimap from './components/Minimap/Minimap';
import ZoomControls from './components/Controls/ZoomControls';
import Sidebar from './components/Sidebar/Sidebar';
import DocumentModal from './components/DocumentModal/DocumentModal';
import WorkflowDeleteModal from './components/Workflow/WorkflowDeleteModal';
import ProjectsPage from './components/Projects/ProjectsPage';
import DocumentsPage from './components/Documents/DocumentsPage';
import ToolsPage from './components/Tools/ToolsPage';
import EnginesPage from './components/Engines/EnginesPage';
import SynthesisPage from './components/Synthesis/SynthesisPage';
import LogsPage from './components/Logs/LogsPage';
import Breadcrumbs from './components/Navigation/Breadcrumbs';
import ModelsPanel from './components/Models/ModelsPanel';
import ModelChatPanel from './components/Chat/ModelChatPanel';
import { executeNodeTool } from './tools/nodeLifecycleTools';
import { runEngineTool, ENGINE_TOOL_NAMES } from './tools/engine';
import { layoutAutoNodes, getSubtreeNodeIds } from './utils/treeLayout';
import { uploadToCloudinary } from './utils/cloudinary';
import { saveProject, getProject, getAllProjects } from './utils/db';
import { getEngineDisplayName, getEngineDescription, getAllEngineIds } from './utils/engineUtils';
import ProjectLoadingScreen from './components/Common/ProjectLoadingScreen';
import { DEFAULT_EXTRACTION_WORKFLOW, DEFAULT_WORKFLOWS } from './utils/workflowTemplates';
import { generateSequentialNodeId, generateSequentialThreadId } from './utils/nodeIdUtils';
import { findWorkflowForTrigger, executeWorkflow } from './utils/workflowRunner';

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
  const [workflows, setWorkflows] = useState(['extraction', 'connection_synthesis']);
  const [currentWorkflow, setCurrentWorkflow] = useState('extraction');
  const [engines, setEngines] = useState(['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder']);
  const [currentEngine, setCurrentEngine] = useState('file_detection');
  const [enginesData, setEnginesData] = useState({});
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);
  const [selectedWorkflowNodeId, setSelectedWorkflowNodeId] = useState(null);
  const [selectedAgentNodeId, setSelectedAgentNodeId] = useState(null);
  const [selectedEngineNodeId, setSelectedEngineNodeId] = useState(null);
  const [activeNodeMenuId, setActiveNodeMenuId] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [workflowThreads, setWorkflowThreads] = useState(DEFAULT_EXTRACTION_WORKFLOW.threads);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [workflowLogs, setWorkflowLogs] = useState([]);
  const [liveConnectingThread, setLiveConnectingThread] = useState(null);
  const [liveExplorationThread, setLiveExplorationThread] = useState(null);
  const [selectedExplorationThreadId, setSelectedExplorationThreadId] = useState(null);
  const [workflowNodes, setWorkflowNodes] = useState(DEFAULT_EXTRACTION_WORKFLOW.nodes);
  const [showWorkflowDeleteModal, setShowWorkflowDeleteModal] = useState(false);
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
  const [selectedGroupNodeIds, setSelectedGroupNodeIds] = useState(() => new Set());
  const groupDragRef = useRef(null);
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
      } else if (currentView === 'synthesis') {
        targetHash = `#/projects/${currentProject.id}/synthesis`;
      } else if (currentView === 'logs') {
        targetHash = `#/projects/${currentProject.id}/logs`;
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

              const loadedEngines = proj.engines && proj.engines.length > 0 ? proj.engines : ['resource_bridge', 'file_detection', 'document_extractor'];
              const mergedEngines = Array.from(new Set(['resource_bridge', 'file_detection', 'document_extractor', ...loadedEngines]));
              setEngines(mergedEngines);
              if (proj.enginesData) {
                setEnginesData(proj.enginesData);
              }
              if (proj.currentEngine) {
                setCurrentEngine(proj.currentEngine);
              }
              setWorkflowLogs(proj.workflowLogs || []);

              // Pre-load workflow data
              const activeWf = proj.currentWorkflow || (proj.workflows?.[0] || 'extraction');
              setCurrentWorkflow(activeWf);
              const wfEntry = proj.workflowsData?.[activeWf];
              const isOldSkeleton = wfEntry?.nodes && Object.keys(wfEntry.nodes).length <= 2 && wfEntry.nodes.input && wfEntry.nodes.output;
              if (wfEntry && !isOldSkeleton) {
                if (wfEntry.nodes) setWorkflowNodes(wfEntry.nodes);
                if (wfEntry.threads) setWorkflowThreads(wfEntry.threads);
              } else if (DEFAULT_WORKFLOWS[activeWf]) {
                setWorkflowNodes(DEFAULT_WORKFLOWS[activeWf].nodes);
                setWorkflowThreads(DEFAULT_WORKFLOWS[activeWf].threads);
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
                const targetWfEntry = proj.workflowsData?.[wfName];
                const isTargetOldSkeleton = targetWfEntry?.nodes && Object.keys(targetWfEntry.nodes).length <= 2 && targetWfEntry.nodes.input && targetWfEntry.nodes.output;
                if (targetWfEntry && !isTargetOldSkeleton) {
                  if (targetWfEntry.nodes) setWorkflowNodes(targetWfEntry.nodes);
                  if (targetWfEntry.threads) setWorkflowThreads(targetWfEntry.threads);
                } else if (DEFAULT_WORKFLOWS[wfName]) {
                  setWorkflowNodes(DEFAULT_WORKFLOWS[wfName].nodes);
                  setWorkflowThreads(DEFAULT_WORKFLOWS[wfName].threads);
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
              } else if (parts[2] === 'synthesis') {
                setCurrentView('synthesis');
              } else if (parts[2] === 'logs') {
                setCurrentView('logs');
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
            const wfEntry = proj.workflowsData?.[wfName];
            const isOldSkeleton = wfEntry?.nodes && Object.keys(wfEntry.nodes).length <= 2 && wfEntry.nodes.input && wfEntry.nodes.output;
            if (wfEntry && !isOldSkeleton) {
              if (wfEntry.nodes) setWorkflowNodes(wfEntry.nodes);
              if (wfEntry.threads) setWorkflowThreads(wfEntry.threads);
            } else if (DEFAULT_WORKFLOWS[wfName]) {
              setWorkflowNodes(DEFAULT_WORKFLOWS[wfName].nodes);
              setWorkflowThreads(DEFAULT_WORKFLOWS[wfName].threads);
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
          } else if (parts[2] === 'synthesis') {
            setCurrentView('synthesis');
          } else if (parts[2] === 'logs') {
            setCurrentView('logs');
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

  const handleNodeClick = (node) => {
    setSelectedDocNode(node);
    const isResource =
      node.category === 'resource' ||
      node.type === 'document' ||
      node.type === 'resource' ||
      Boolean(node.cloudinaryUrl) ||
      Boolean(node.fileSize);

    if (isResource) {
      // Select the resource and all its products (connected topics, subtopics, findings)
      const group = getSubtreeNodeIds(node.id, connectionsRef.current, nodesRef.current);
      setSelectedGroupNodeIds(group);
    } else {
      setSelectedGroupNodeIds(new Set([node.id]));
    }
  };

  const handleNodeDragStart = (id) => {
    const node = nodesRef.current[id];
    if (!node) return;

    const isResource =
      node.category === 'resource' ||
      node.type === 'document' ||
      node.type === 'resource' ||
      Boolean(node.cloudinaryUrl) ||
      Boolean(node.fileSize);

    let activeGroup = selectedGroupNodeIds;
    // If dragging a resource, or dragging a node not currently in the selected group:
    if (isResource || !selectedGroupNodeIds.has(id)) {
      activeGroup = getSubtreeNodeIds(id, connectionsRef.current, nodesRef.current);
      setSelectedGroupNodeIds(activeGroup);
    }

    const initialPositions = {};
    for (const nId of activeGroup) {
      if (nodesRef.current[nId]) {
        initialPositions[nId] = {
          x: nodesRef.current[nId].x,
          y: nodesRef.current[nId].y,
        };
      }
    }

    groupDragRef.current = {
      anchorId: id,
      group: activeGroup,
      initialPositions,
    };
  };

  const handleNodeMove = (id, newX, newY) => {
    const dragInfo = groupDragRef.current;
    if (dragInfo && dragInfo.anchorId === id && dragInfo.initialPositions[id]) {
      const deltaX = newX - dragInfo.initialPositions[id].x;
      const deltaY = newY - dragInfo.initialPositions[id].y;

      setNodes((prev) => {
        const next = { ...prev };
        for (const nId of dragInfo.group) {
          const initPos = dragInfo.initialPositions[nId];
          if (initPos && next[nId]) {
            next[nId] = {
              ...next[nId],
              x: Math.round(initPos.x + deltaX),
              y: Math.round(initPos.y + deltaY),
              userMoved: true,
            };
          }
        }
        return next;
      });
      return;
    }

    setNodes((prev) => {
      if (!prev[id]) return prev;
      const next = {
        ...prev,
        [id]: {
          ...prev[id],
          x: newX,
          y: newY,
          userMoved: true,
        },
      };
      persistProjectNodes(next);
      return next;
    });
  };

  const handleNodeDragEnd = () => {
    if (groupDragRef.current) {
      persistProjectNodes(nodesRef.current);
      groupDragRef.current = null;
    }
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

    setWorkflowNodes((prev) => {
      const id = generateSequentialNodeId('agent', prev);
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

      const next = { ...prev, [id]: newAgent };
      persistWorkflow(next, workflowThreads);
      return next;
    });
  };

  const handleAddEngineNode = (engine, pos) => {
    const engineId = engine?.engineId || engine?.id || 'file_detection';
    const engineName = engine?.name || getEngineDisplayName(engineId, enginesData) || 'Engine';
    const engineDesc = engine?.desc || getEngineDescription(engineId, enginesData) || 'Custom processing engine';

    let defaultX = 320;
    let defaultY = 220;
    if (pos && typeof pos.x === 'number') {
      defaultX = pos.x;
      defaultY = pos.y;
    } else if (workflowNodes.input && workflowNodes.output) {
      defaultX = (workflowNodes.input.x + workflowNodes.output.x) / 2;
      defaultY = (workflowNodes.input.y + workflowNodes.output.y) / 2;
    }

    setWorkflowNodes((prev) => {
      const id = generateSequentialNodeId('engine', prev);
      const newEngineNode = {
        id,
        title: engineName,
        sub: engineDesc,
        type: 'engine',
        engineId,
        engineName,
        engineDesc,
        x: defaultX,
        y: defaultY,
        width: 185,
        height: 56,
      };

      const next = { ...prev, [id]: newEngineNode };
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
    setWorkflowNodes((prev) => {
      const node = prev[id];
      if (!node) return prev;
      const newId = generateSequentialNodeId(node.type || 'agent', prev);
      const duplicatedNode = {
        ...node,
        id: newId,
        title: node.title ? `${node.title} (Copy)` : 'Agent (Copy)',
        x: node.x + 35,
        y: node.y + 35,
      };

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
    if (selectedEngineNodeId === agentId) setSelectedEngineNodeId(null);
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

  const handleUpdateThreadCondition = (threadId, condition) => {
    setWorkflowThreads((prev) => {
      const next = prev.map((t) => (t.id === threadId ? { ...t, condition } : t));
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
    } else if (node.type === 'engine') {
      // Single click on engine opens the engine quick-view & config modal
      setSelectedEngineNodeId(id);
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
            id: generateSequentialThreadId('th', prev),
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

  const triggerWorkflowExecution = async (triggerType, triggerPayload) => {
    const targetDocId = triggerPayload?.nodeId || triggerPayload?.doc_id;
    try {
      const matchedWf = findWorkflowForTrigger(currentProjectRef.current, triggerType);
      if (!matchedWf || !matchedWf.data) {
        if (targetDocId) {
          setNodes((prev) => {
            if (!prev[targetDocId]) return prev;
            const updated = {
              ...prev[targetDocId],
              extracting: false,
              status: prev[targetDocId].status === 'extracting' ? 'not checked' : prev[targetDocId].status,
              updatedAt: new Date().toISOString(),
            };
            const next = { ...prev, [targetDocId]: updated };
            persistProjectNodes(next);
            return next;
          });
        }
        return;
      }

      setIsWorkflowRunning(true);

      // Set extracting on the canvas resource node
      if (targetDocId) {
        setNodes((prev) => {
          if (!prev[targetDocId]) return prev;
          const updated = {
            ...prev[targetDocId],
            extracting: true,
            status: 'extracting',
            updatedAt: new Date().toISOString(),
          };
          const next = { ...prev, [targetDocId]: updated };
          persistProjectNodes(next);
          return next;
        });
      }

      const finalRun = await executeWorkflow({
        workflowId: matchedWf.id,
        workflowData: matchedWf.data,
        project: currentProjectRef.current,
        triggerPayload,
        onExecuteTool: handleExecuteInvestigationTool,
        onProgress: (updatedRun) => {
          setWorkflowLogs((prev) => {
            const existingIdx = prev.findIndex((r) => r.id === updatedRun.id);
            if (existingIdx >= 0) {
              const next = [...prev];
              next[existingIdx] = updatedRun;
              return next;
            }
            return [updatedRun, ...prev];
          });

          // If bridge resolved local file path, attach it while keeping extracting active
          const bridgeNode = updatedRun.nodes?.engine_bridge;
          const resolvedPath = bridgeNode?.outputData?.local_path || bridgeNode?.outputData?.file_path;
          if (targetDocId && resolvedPath) {
            setNodes((prev) => {
              const targetDoc = prev[targetDocId];
              if (!targetDoc || targetDoc.local_path === resolvedPath) return prev;
              const next = {
                ...prev,
                [targetDocId]: {
                  ...targetDoc,
                  local_path: resolvedPath,
                  extracting: true,
                  status: 'extracting',
                  updatedAt: new Date().toISOString(),
                },
              };
              persistProjectNodes(next);
              return next;
            });
          }
        },
      });

      // Update node status when extraction completes
      if (targetDocId) {
        const isCompleted = finalRun?.status === 'completed';
        const resolvedPath =
          finalRun?.nodes?.engine_bridge?.outputData?.local_path ||
          finalRun?.nodes?.engine_bridge?.outputData?.file_path;
        setNodes((prev) => {
          if (!prev[targetDocId]) return prev;
          const updated = {
            ...prev[targetDocId],
            local_path: resolvedPath || prev[targetDocId].local_path,
            status: isCompleted ? 'verified' : (prev[targetDocId].status === 'extracting' ? 'not checked' : prev[targetDocId].status),
            extracting: false,
            extractionCompleted: isCompleted,
            updatedAt: new Date().toISOString(),
          };
          const next = { ...prev, [targetDocId]: updated };
          persistProjectNodes(next);
          return next;
        });
      }

      // Persist logs in project
      if (currentProjectRef.current) {
        setWorkflowLogs((prev) => {
          const updatedLogs = [finalRun, ...prev.filter((r) => r.id !== finalRun.id)];
          const updatedProject = {
            ...currentProjectRef.current,
            workflowLogs: updatedLogs,
            updatedAt: new Date().toISOString(),
          };
          currentProjectRef.current = updatedProject;
          setCurrentProject(updatedProject);
          saveProject(updatedProject).catch((err) => console.error('Failed to save project logs:', err));
          return updatedLogs;
        });
      }
    } catch (err) {
      console.error('Workflow execution error:', err);
      if (targetDocId) {
        setNodes((prev) => {
          if (!prev[targetDocId]) return prev;
          const updated = {
            ...prev[targetDocId],
            extracting: false,
            status: prev[targetDocId].status === 'extracting' ? 'not checked' : prev[targetDocId].status,
            updatedAt: new Date().toISOString(),
          };
          const next = { ...prev, [targetDocId]: updated };
          persistProjectNodes(next);
          return next;
        });
      }
    } finally {
      setIsWorkflowRunning(false);
    }
  };

  const handleExplorationPortStart = (nodeId, side) => {
    const node = nodes[nodeId];
    if (!node) return;
    const isLeft = side === 'left';
    setLiveExplorationThread({
      from: nodeId,
      fromSide: side,
      currentX: isLeft ? node.x : node.x + (node.width || 280),
      currentY: node.y + (node.height || 72) / 2,
    });
  };

  const handleExplorationPortEnd = (targetNodeId) => {
    if (liveExplorationThread) {
      const sourceId = liveExplorationThread.from;
      if (sourceId && sourceId !== targetNodeId) {
        const sourceNode = nodes[sourceId];
        const targetNode = nodes[targetNodeId];

        // Enforce: only connect extracted nodes (raw unextracted files have no ports and cannot be connected)
        const isSourceResource = sourceNode?.category === 'resource' || sourceNode?.type === 'document' || sourceNode?.type === 'resource';
        const isTargetResource = targetNode?.category === 'resource' || targetNode?.type === 'document' || targetNode?.type === 'resource';

        if (!isSourceResource && !isTargetResource) {
          const existing = Object.values(connections).find(
            (c) => (c.source_node_id === sourceId && c.target_node_id === targetNodeId) ||
                   (c.source_node_id === targetNodeId && c.target_node_id === sourceId)
          );

          if (!existing) {
            const newConnId = generateSequentialThreadId('conn', connections);
            const newConnection = {
              id: newConnId,
              connection_id: newConnId,
              source_node_id: sourceId,
              target_node_id: targetNodeId,
              relationship_type: 'connected',
              label: 'Connected',
              status: 'active',
            };

            const updatedConnections = {
              ...connections,
              [newConnId]: newConnection,
            };

            setConnections(updatedConnections);

            if (currentProjectRef.current && currentExploration) {
              const currentExp = currentProjectRef.current.explorationsData?.[currentExploration] || {};
              const updatedProject = {
                ...currentProjectRef.current,
                explorationsData: {
                  ...(currentProjectRef.current.explorationsData || {}),
                  [currentExploration]: {
                    ...currentExp,
                    connections: updatedConnections,
                  },
                },
              };
              currentProjectRef.current = updatedProject;
              setCurrentProject(updatedProject);
              saveProject(updatedProject).catch((err) => console.error('Failed to save connection:', err));
            }

            // Auto-trigger connection workflow if configured
            triggerWorkflowExecution('node_connect', {
              triggerType: 'node_connect',
              triggerLabel: `node_connect: Node #${sourceId} → Node #${targetNodeId}`,
              sourceNode: nodes[sourceId] || { id: sourceId },
              targetNode: nodes[targetNodeId] || { id: targetNodeId },
              connection: newConnection,
            });
          }
        }
      }
    }
    setLiveExplorationThread(null);
  };

  const handleExplorationCanvasPointerMove = (e) => {
    if (!liveExplorationThread) return;
    const rect = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - camera.x) / camera.zoom;
    const worldY = (screenY - camera.y) / camera.zoom;
    setLiveExplorationThread((prev) => (prev ? { ...prev, currentX: worldX, currentY: worldY } : null));
  };

  const handleExplorationCanvasPointerUp = (e) => {
    if (liveExplorationThread) {
      if (e && e.clientX && e.clientY) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = el?.closest('.movable-node');
        if (nodeEl) {
          const targetNodeId = nodeEl.dataset.nodeId;
          if (targetNodeId && targetNodeId !== liveExplorationThread.from) {
            handleExplorationPortEnd(targetNodeId);
            return;
          }
        }
      }
      setLiveExplorationThread(null);
    }
  };

  const handleDeleteExplorationThread = (connId) => {
    if (!connId) return;
    const nextConnections = { ...connections };
    delete nextConnections[connId];
    Object.keys(nextConnections).forEach((key) => {
      if (nextConnections[key]?.id === connId || nextConnections[key]?.connection_id === connId) {
        delete nextConnections[key];
      }
    });

    setConnections(nextConnections);

    if (currentProjectRef.current && currentExploration) {
      const currentExp = currentProjectRef.current.explorationsData?.[currentExploration] || {};
      const updatedProject = {
        ...currentProjectRef.current,
        explorationsData: {
          ...(currentProjectRef.current.explorationsData || {}),
          [currentExploration]: {
            ...currentExp,
            connections: nextConnections,
          },
        },
      };
      currentProjectRef.current = updatedProject;
      setCurrentProject(updatedProject);
      saveProject(updatedProject).catch((err) => console.error('Failed to save deleted connection:', err));
    }
    setSelectedExplorationThreadId(null);
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
        sub: 'Trigger: Manual',
        type: 'input',
        trigger: 'manual',
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
    const wfData = currentProjectRef.current?.workflowsData?.[wfName] || DEFAULT_WORKFLOWS[wfName];
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

  const handleRenameWorkflow = (wfUid, newName) => {
    const sanitized = newName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    if (!sanitized) return;

    const proj = currentProjectRef.current || currentProject;
    if (!proj) return;

    const updatedWorkflowsData = {
      ...(proj.workflowsData || {}),
      [wfUid]: {
        ...(proj.workflowsData?.[wfUid] || {}),
        name: sanitized,
      },
    };

    const updatedProject = {
      ...proj,
      workflowsData: updatedWorkflowsData,
      updatedAt: new Date().toISOString(),
    };

    currentProjectRef.current = updatedProject;
    setCurrentProject(updatedProject);
    saveProject(updatedProject).catch((err) => console.error('Failed to save renamed workflow:', err));
  };

  const handleDeleteWorkflow = (wfName = currentWorkflow) => {
    if (DEFAULT_WORKFLOWS[wfName]) return;

    setWorkflows((prev) => {
      const nextWorkflows = prev.filter((w) => w !== wfName);
      const fallbackWf = nextWorkflows[0] || 'extraction';

      setCurrentWorkflow(fallbackWf);

      const fallbackData = currentProjectRef.current?.workflowsData?.[fallbackWf] || DEFAULT_WORKFLOWS[fallbackWf];
      if (fallbackData) {
        if (fallbackData.nodes) setWorkflowNodes(fallbackData.nodes);
        if (fallbackData.threads) setWorkflowThreads(fallbackData.threads);
      }

      if (currentProjectRef.current) {
        const updatedWorkflowsData = { ...(currentProjectRef.current.workflowsData || {}) };
        delete updatedWorkflowsData[wfName];

        const updatedProject = {
          ...currentProjectRef.current,
          workflows: nextWorkflows,
          currentWorkflow: fallbackWf,
          workflowsData: updatedWorkflowsData,
          updatedAt: new Date().toISOString(),
        };
        currentProjectRef.current = updatedProject;
        setCurrentProject(updatedProject);
        saveProject(updatedProject).catch((err) => console.error('Failed to save project after deleting workflow:', err));
      }

      return nextWorkflows;
    });

    setNotification(`Workflow "${wfName}" deleted`);
    setShowWorkflowDeleteModal(false);
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
    const readableName = nextName.replace(/_/g, ' ');
    const initialCode = `# ${nextName}
# Pure function entry: def run(input_data, context=None) -> dict

# Manifest specification:
# inputs: "text", "file", "image", "audio", "video", "json", "number", "boolean"
# outputs: "json", "file", "text", "image", "audio"
# "required": True ensures the field must be provided to run.

MANIFEST = {
    "name": "${readableName}",
    "version": "1.0.0",
    "description": "Custom processing engine",
    "inputs": {
        "text": {
            "type": "text",
            "required": True,
            "description": "Input text or query to process"
        }
    },
    "outputs": {
        "result": {
            "type": "json",
            "description": "Processed output data"
        }
    }
}

def run(input_data, context=None):
    """
    ${nextName} processing logic.
    """
    text = input_data.get("text", "") if isinstance(input_data, dict) else str(input_data)
    return {
        "status": "success",
        "engine": "${nextName}",
        "output": text
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

  const handleDeleteEngine = (engId) => {
    if (engId === 'file_detection' || engId === 'document_extractor' || engId === 'node_context_builder') return;
    setEngines((prev) => {
      const nextEngines = prev.filter((id) => id !== engId);
      setEnginesData((prevData) => {
        const nextData = { ...prevData };
        delete nextData[engId];
        const nextActive = currentEngine === engId ? (nextEngines[0] || 'file_detection') : currentEngine;
        if (currentProjectRef.current) {
          const updatedProject = {
            ...currentProjectRef.current,
            engines: nextEngines,
            currentEngine: nextActive,
            enginesData: nextData,
            updatedAt: new Date().toISOString(),
          };
          currentProjectRef.current = updatedProject;
          setCurrentProject(updatedProject);
          saveProject(updatedProject).catch((err) => console.error('Failed to save project after deleting engine:', err));
        }
        return nextData;
      });
      if (currentEngine === engId) {
        setCurrentEngine(nextEngines[0] || 'file_detection');
      }
      return nextEngines;
    });
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
        status: 'extracting',
        uploading: false,
        extracting: true,
        updatedAt: new Date().toISOString(),
      };

      setNodes((prev) => {
        const next = { ...prev, [nodeId]: finalizedNode };
        persistProjectNodes(next);
        return next;
      });

      setSelectedDocNode((prev) => (prev && prev.id === nodeId ? finalizedNode : prev));

      // Read base64 slice for Python engines execution
      let fileB64 = '';
      try {
        const slice = file.slice(0, 4 * 1024 * 1024);
        const buf = await slice.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i += 8192) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
        }
        fileB64 = btoa(binary);
      } catch (readErr) {
        console.warn('Could not read file slice for workflow runner:', readErr);
      }

      // Auto-trigger extraction workflow on file drop
      triggerWorkflowExecution('file_drop', {
        triggerType: 'file_drop',
        triggerLabel: `file_drop: ${file.name}`,
        file: {
          name: file.name,
          file_name: file.name,
          size: file.size,
          size_bytes: file.size,
          type: file.type || 'application/octet-stream',
          url: result.secure_url,
          cloudinaryUrl: result.secure_url,
          publicId: result.public_id,
          doc_id: nodeId,
          b64: fileB64,
          file_bytes_b64: fileB64,
        },
        doc_id: nodeId,
        nodeId: nodeId,
      });
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

      const loadedEngines = fullProject.engines && fullProject.engines.length > 0 ? fullProject.engines : ['resource_bridge', 'file_detection', 'document_extractor'];
      const mergedEngines = Array.from(new Set(['resource_bridge', 'file_detection', 'document_extractor', ...loadedEngines]));
      setEngines(mergedEngines);
      if (fullProject.currentEngine) {
        setCurrentEngine(fullProject.currentEngine);
      }
      if (fullProject.enginesData) {
        setEnginesData(fullProject.enginesData);
      }
      setWorkflowLogs(fullProject.workflowLogs || []);

      const activeWf = fullProject.currentWorkflow || 'extraction';
      setCurrentWorkflow(activeWf);
      const wfEntry = fullProject.workflowsData?.[activeWf];
      const isOldSkeleton = wfEntry?.nodes && Object.keys(wfEntry.nodes).length <= 2 && wfEntry.nodes.input && wfEntry.nodes.output;
      if (wfEntry && !isOldSkeleton) {
        if (wfEntry.nodes) {
          setWorkflowNodes(wfEntry.nodes);
        }
        if (wfEntry.threads) {
          setWorkflowThreads(wfEntry.threads);
        }
      } else if (DEFAULT_WORKFLOWS[activeWf]) {
        setWorkflowNodes(DEFAULT_WORKFLOWS[activeWf].nodes);
        setWorkflowThreads(DEFAULT_WORKFLOWS[activeWf].threads);
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

  const handleRenameExploration = (expUid, newName) => {
    const sanitized = newName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    if (!sanitized) return;

    const proj = currentProjectRef.current || currentProject;
    if (!proj) return;

    const updatedExplorationsData = {
      ...(proj.explorationsData || {}),
      [expUid]: {
        ...(proj.explorationsData?.[expUid] || {}),
        name: sanitized,
      },
    };

    const updatedProject = {
      ...proj,
      explorationsData: updatedExplorationsData,
      updatedAt: new Date().toISOString(),
    };

    currentProjectRef.current = updatedProject;
    setCurrentProject(updatedProject);
    saveProject(updatedProject).catch((err) => console.error('Failed to save renamed exploration:', err));
  };

  // Engine tools are async (validation and test runs call the Python server); callers must await.
  const handleExecuteEngineTool = async (toolName, args) => {
    const proj = currentProjectRef.current;
    const res = await runEngineTool(
      { engines: getAllEngineIds(engines, proj?.engines || []), enginesData: proj?.enginesData || enginesData },
      toolName,
      args || {}
    );

    if (res.updatedEnginesData) {
      const nextEngines = res.updatedEngines || getAllEngineIds(engines, proj?.engines || []);
      setEngines(nextEngines);
      setEnginesData(res.updatedEnginesData);
      if (currentProjectRef.current) {
        const updatedProject = {
          ...currentProjectRef.current,
          engines: nextEngines,
          enginesData: res.updatedEnginesData,
          updatedAt: new Date().toISOString(),
        };
        currentProjectRef.current = updatedProject;
        setCurrentProject(updatedProject);
        saveProject(updatedProject).catch((err) => console.error('Failed to save engine from tool:', err));
      }
    }
    return res;
  };

  const handleExecuteInvestigationTool = (toolName, args) => {
    if (ENGINE_TOOL_NAMES.includes(toolName)) {
      return handleExecuteEngineTool(toolName, args);
    }
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

    if (res.updatedNodes || res.updatedConnections) {
      // Nodes created by this tool call are AI-generated: flag them for auto layout, then arrange
      // the tree. Nodes the user has dragged (userMoved) and resources are never repositioned.
      const base = res.updatedNodes || currentExpNodes;
      const flagged = { ...base };
      for (const id of Object.keys(base)) {
        if (!currentExpNodes[id] && base[id].type !== 'document' && base[id].category !== 'resource') {
          flagged[id] = { ...base[id], autoLayout: true };
        }
      }
      res.updatedNodes = layoutAutoNodes(flagged, res.updatedConnections || currentExpConnections);
    }

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

  const isPredefinedWorkflow = Boolean(DEFAULT_WORKFLOWS[currentWorkflow]);
  const currentWfDisplayName = currentProject?.workflowsData?.[currentWorkflow]?.name || currentWorkflow;

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
          explorationsData={currentProject?.explorationsData || {}}
          currentExploration={currentExploration}
          onSelectExploration={(exp) => {
            handleSelectExploration(exp);
            setCurrentView('canvas');
          }}
          onCreateExploration={() => {
            handleCreateExploration();
            setCurrentView('canvas');
          }}
          onRenameExploration={handleRenameExploration}
          workflows={workflows}
          workflowsData={currentProject?.workflowsData || {}}
          currentWorkflow={currentWorkflow}
          onSelectWorkflow={handleSelectWorkflow}
          onCreateWorkflow={handleCreateWorkflow}
          onRenameWorkflow={handleRenameWorkflow}
          engines={engines}
          enginesData={enginesData}
          currentEngine={currentEngine}
          onSelectEngine={handleSelectEngine}
          onCreateEngine={handleCreateEngine}
          onOpenEngines={() => {
            setCurrentEngine(engines[0] || 'file_detection');
            setCurrentView('engines');
          }}
          onOpenTools={() => setCurrentView('tools')}
          onOpenSynthesis={() => setCurrentView('synthesis')}
          onOpenLogs={() => setCurrentView('logs')}
          isWorkflowRunning={isWorkflowRunning}
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

      {/* Documents Page View, Tools Page View, Synthesis Page View, Logs Page View, Workflow Canvas View, or Exploration Canvas View */}
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
      ) : currentView === 'synthesis' ? (
        <SynthesisPage />
      ) : currentView === 'logs' ? (
        <LogsPage workflowLogs={workflowLogs} />
      ) : currentView === 'engines' ? (
        <EnginesPage
          engines={engines}
          currentEngine={currentEngine}
          enginesData={enginesData}
          onSelectEngine={handleSelectEngine}
          onCreateEngine={handleCreateEngine}
          onUpdateEngineCode={handleUpdateEngineCode}
          onDeleteEngine={handleDeleteEngine}
        />
      ) : currentView === 'workflow' ? (
        <>
          {/* Top-Right Workflow Controls & Minimap Cluster */}
          <div className="workflow-top-right-cluster">
            {/* Delete Workflow Button (active for custom workflows, disabled/locked for predefined) */}
            <button
              type="button"
              className={`workflow-top-delete-btn ${isPredefinedWorkflow ? 'disabled' : ''}`}
              onClick={() => {
                if (!isPredefinedWorkflow) {
                  setShowWorkflowDeleteModal(true);
                }
              }}
              disabled={isPredefinedWorkflow}
              title={
                isPredefinedWorkflow
                  ? 'Predefined workflows are protected and cannot be deleted'
                  : `Delete workflow "${currentWfDisplayName}"`
              }
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
              {isPredefinedWorkflow && (
                <svg className="btn-lock-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </button>

            {/* Top-Right Expandable Interactive Minimap */}
            <Minimap
              nodes={workflowNodes}
              camera={camera}
              viewportWidth={viewport.width}
              viewportHeight={viewport.height}
              onCameraChange={setCamera}
            />
          </div>

          {/* Independent Models & Engines Component below Minimap */}
          <ModelsPanel
            onAddModelAgent={(model) => handleAddAgent(model)}
            engines={engines}
            enginesData={enginesData}
            onAddEngineNode={(engine) => handleAddEngineNode(engine)}
          />

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
            onDropEngine={(engine, pos) => handleAddEngineNode(engine, pos)}
            onCanvasPointerMove={handleCanvasPointerMove}
            onCanvasPointerUp={handleCanvasPointerUp}
            onCanvasClick={() => setActiveNodeMenuId(null)}
          >
            {/* Connecting threads between nodes (click to inspect/set condition) */}
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
                  condition={thread.condition || ''}
                  onClickThread={() => setSelectedThreadId(thread.id)}
                  onDelete={handleDeleteThread}
                  isRunning={isWorkflowLoading}
                  isWorkflow={true}
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
                isWorkflow={true}
              />
            )}

            {/* Render all workflow nodes (Input, Output, Agents, and Engines) */}
            {Object.values(workflowNodes).map((node) => {
              const displayTitle = node.type === 'engine'
                ? (getEngineDisplayName(node.engineId, enginesData) || node.title)
                : node.title;
              const displaySub = node.type === 'engine'
                ? (getEngineDescription(node.engineId, enginesData) || node.description || node.sub || 'Custom processing engine')
                : node.sub;
              return (
                <WorkflowNode
                  key={node.id}
                  id={node.id}
                  title={displayTitle}
                  sub={displaySub}
                  type={node.type}
                  inputSource={node.inputSource}
                  x={node.x}
                  y={node.y}
                  width={node.width || 185}
                  zoom={camera.zoom}
                  isSelected={selectedWorkflowNodeId === node.id || selectedAgentNodeId === node.id || selectedEngineNodeId === node.id}
                  onMove={handleWorkflowNodeMove}
                  onClick={handleWorkflowNodeClick}
                  onPortStart={handlePortStart}
                  onPortEnd={handlePortEnd}
                />
              );
            })}

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
            workflowName={currentWorkflow}
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

          {/* Workflow Engine Settings & Quick-View Modal */}
          <EngineConfigModal
            isOpen={Boolean(selectedEngineNodeId && workflowNodes[selectedEngineNodeId])}
            engineNode={selectedEngineNodeId ? workflowNodes[selectedEngineNodeId] : null}
            enginesData={enginesData}
            onClose={() => setSelectedEngineNodeId(null)}
            onDeleteNode={handleDeleteAgent}
            onOpenDetails={(engId) => {
              setCurrentEngine(engId);
              setCurrentView('engines');
            }}
            onUpdateEngine={handleUpdateWorkflowNode}
          />

          {/* Thread Condition Modal */}
          {(() => {
            const activeThread = selectedThreadId
              ? workflowThreads.find((t) => t.id === selectedThreadId)
              : null;
            return (
              <ThreadConditionModal
                isOpen={Boolean(activeThread)}
                thread={activeThread}
                fromNode={activeThread ? workflowNodes[activeThread.from] : null}
                toNode={activeThread ? workflowNodes[activeThread.to] : null}
                onClose={() => setSelectedThreadId(null)}
                onSaveCondition={handleUpdateThreadCondition}
                onDeleteThread={(threadId, fromId, toId) => {
                  handleDeleteThread(threadId, fromId, toId);
                  setSelectedThreadId(null);
                }}
              />
            );
          })()}

          {/* Workflow Delete Confirmation Modal */}
          <WorkflowDeleteModal
            isOpen={showWorkflowDeleteModal}
            workflowName={currentWorkflow}
            displayName={currentWfDisplayName}
            onClose={() => setShowWorkflowDeleteModal(false)}
            onConfirm={() => handleDeleteWorkflow(currentWorkflow)}
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

          {/* Exploration Dot Grid Canvas with Direct File Drag & Drop and Relationship Ports */}
          <DotGridCanvas
            camera={camera}
            onCameraChange={setCamera}
            onDropFile={handleFileDrop}
            onCanvasPointerMove={handleExplorationCanvasPointerMove}
            onCanvasPointerUp={handleExplorationCanvasPointerUp}
            onCanvasClick={() => setSelectedGroupNodeIds(new Set())}
          >
            {/* Dynamic relationship cables between connected nodes */}
            {Object.values(connections).map((conn) => {
              const startNode = nodes[conn.source_node_id];
              const endNode = nodes[conn.target_node_id];
              if (!startNode || !endNode) return null;
              return (
                <Thread
                  key={conn.id || conn.connection_id}
                  id={conn.id || conn.connection_id}
                  start={startNode}
                  end={endNode}
                  status={conn.status || 'active'}
                  isRejected={conn.status === 'rejected'}
                  isAnalyzing={conn.status === 'analyzing'}
                  label={conn.label || conn.relationship_type || ''}
                  onClickThread={() => setSelectedExplorationThreadId(conn.id || conn.connection_id)}
                />
              );
            })}

            {/* Live connecting thread when dragging from an exploration port */}
            {liveExplorationThread && nodes[liveExplorationThread.from] && (
              <Thread
                start={nodes[liveExplorationThread.from]}
                end={{
                  x: liveExplorationThread.currentX,
                  y: liveExplorationThread.currentY,
                  width: 0,
                  height: 0,
                }}
              />
            )}

            {/* Dynamic movable document nodes & extracted nodes */}
            {Object.values(nodes).map((node) => (
              <MovableNode
                key={node.id}
                id={node.id}
                x={node.x}
                y={node.y}
                width={node.width}
                zoom={camera.zoom}
                data={node}
                isSelected={selectedGroupNodeIds.has(node.id)}
                onDragStart={handleNodeDragStart}
                onMove={handleNodeMove}
                onDragEnd={handleNodeDragEnd}
                onClick={() => handleNodeClick(node)}
                onPortStart={handleExplorationPortStart}
                onPortEnd={handleExplorationPortEnd}
              />
            ))}
          </DotGridCanvas>

          {/* Exploration Thread Inspector Modal */}
          {(() => {
            const activeConn = selectedExplorationThreadId
              ? connections[selectedExplorationThreadId] ||
                Object.values(connections).find(
                  (c) => c.id === selectedExplorationThreadId || c.connection_id === selectedExplorationThreadId
                )
              : null;
            return (
              <ExplorationThreadModal
                isOpen={Boolean(activeConn)}
                thread={activeConn}
                sourceNode={activeConn ? nodes[activeConn.source_node_id] : null}
                targetNode={activeConn ? nodes[activeConn.target_node_id] : null}
                onClose={() => setSelectedExplorationThreadId(null)}
                onDelete={handleDeleteExplorationThread}
              />
            );
          })()}
        </>
      )}
    </>
  );
}
