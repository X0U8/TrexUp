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
import ResourceDeleteModal from './components/DocumentModal/ResourceDeleteModal';
import WorkflowDeleteModal from './components/Workflow/WorkflowDeleteModal';
import WorkflowInfoModal from './components/Workflow/WorkflowInfoModal';
import WorkflowRunConfirmCard from './components/Workflow/WorkflowRunConfirmCard';
import ManualWorkflowsModal from './components/Workflow/ManualWorkflowsModal';
import WorkflowLogSimulation from './components/Logs/WorkflowLogSimulation';
import DeletionApprovalToast from './components/Approval/DeletionApprovalToast';
import ProjectsPage from './components/Projects/ProjectsPage';
import DocumentsPage from './components/Documents/DocumentsPage';
import ToolsPage from './components/Tools/ToolsPage';
import EnginesPage from './components/Engines/EnginesPage';
import LogsPage from './components/Logs/LogsPage';
import Breadcrumbs from './components/Navigation/Breadcrumbs';
import ModelsPanel from './components/Models/ModelsPanel';
import ModelChatPanel from './components/Chat/ModelChatPanel';
import { executeNodeTool } from './tools/nodeLifecycleTools';
import { runEngineTool, ENGINE_TOOL_NAMES } from './tools/engine';
import { runWorkflowTool, WORKFLOW_TOOL_NAMES } from './tools/workflow';
import { layoutAutoNodes, getSubtreeNodeIds } from './utils/treeLayout';
import { saveProject, getProject, getAllProjects } from './utils/db';
import { getEngineDisplayName, getEngineDescription, getAllEngineIds } from './utils/engineUtils';
import ProjectLoadingScreen from './components/Common/ProjectLoadingScreen';
import ServerStatusIndicator from './components/Common/ServerStatusIndicator';
import { DEFAULT_EXTRACTION_WORKFLOW, DEFAULT_WORKFLOWS } from './utils/workflowTemplates';
import { generateSequentialNodeId, generateSequentialThreadId } from './utils/nodeIdUtils';
import { findWorkflowForTrigger, findWorkflowsForTrigger, executeWorkflow } from './utils/workflowRunner';

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

  // Viewport Culling: Compute visible bounds with buffer so off-screen nodes skip rendering
  const visibleBounds = useMemo(() => {
    const zoom = camera.zoom || 1;
    const buffer = 350 / zoom;
    const minX = -camera.x / zoom - buffer;
    const maxX = (-camera.x + (viewport.width || 1200)) / zoom + buffer;
    const minY = -camera.y / zoom - buffer;
    const maxY = (-camera.y + (viewport.height || 800)) / zoom + buffer;
    return { minX, maxX, minY, maxY };
  }, [camera.x, camera.y, camera.zoom, viewport.width, viewport.height]);

  const isNodeInViewport = (node, defaultWidth = 280, defaultHeight = 80) => {
    if (!node) return false;
    const w = node.width || defaultWidth;
    const h = node.height || defaultHeight;
    return (
      node.x + w >= visibleBounds.minX &&
      node.x <= visibleBounds.maxX &&
      node.y + h >= visibleBounds.minY &&
      node.y <= visibleBounds.maxY
    );
  };

  const isThreadInViewport = (startNode, endNode) => {
    if (!startNode || !endNode) return false;
    const minX = Math.min(startNode.x, endNode.x);
    const maxX = Math.max(startNode.x + (startNode.width || 185), endNode.x + (endNode.width || 185));
    const minY = Math.min(startNode.y, endNode.y);
    const maxY = Math.max(startNode.y + (startNode.height || 72), endNode.y + (endNode.height || 72));
    return (
      maxX >= visibleBounds.minX &&
      minX <= visibleBounds.maxX &&
      maxY >= visibleBounds.minY &&
      minY <= visibleBounds.maxY
    );
  };

  const [nodes, setNodes] = useState({});
  const [connections, setConnections] = useState({});
  const [selectedDocNode, setSelectedDocNode] = useState(null);
  const [chatFocusNode, setChatFocusNode] = useState(null);
  const [isDocsCollectionOpen, setIsDocsCollectionOpen] = useState(false);
  const [explorations, setExplorations] = useState(['exploration_01']);
  const [currentExploration, setCurrentExploration] = useState('exploration_01');
  const [workflows, setWorkflows] = useState(['extraction', 'connection_synthesis']);
  const [currentWorkflow, setCurrentWorkflow] = useState('extraction');
  const currentWorkflowRef = useRef('extraction');
  useEffect(() => {
    currentWorkflowRef.current = currentWorkflow;
  }, [currentWorkflow]);

  const [engines, setEngines] = useState(['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder']);
  const [currentEngine, setCurrentEngine] = useState('file_detection');
  const [enginesData, setEnginesData] = useState({});
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);
  const [isWorkflowAssembling, setIsWorkflowAssembling] = useState(false);
  const [workflowAssemblingTitle, setWorkflowAssemblingTitle] = useState('Generating Workflow Pipeline');
  const [workflowAssemblingStatus, setWorkflowAssemblingStatus] = useState('AI is analyzing requirements & building nodes...');

  const handleWorkflowAssemblingChange = (isAssembling, status, title, workflowId) => {
    setIsWorkflowAssembling(isAssembling);
    if (status) setWorkflowAssemblingStatus(status);
    if (title) setWorkflowAssemblingTitle(title);
    // The AI building a workflow never moves the user to another page. The loading line shows progress;
    // the user opens the workflow when they want to.
    if (workflowId) currentWorkflowRef.current = workflowId;
  };
  const [selectedWorkflowNodeId, setSelectedWorkflowNodeId] = useState(null);
  const [selectedAgentNodeId, setSelectedAgentNodeId] = useState(null);
  const [selectedEngineNodeId, setSelectedEngineNodeId] = useState(null);
  const [activeNodeMenuId, setActiveNodeMenuId] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [workflowThreads, setWorkflowThreads] = useState(DEFAULT_EXTRACTION_WORKFLOW.threads);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [workflowLogs, setWorkflowLogs] = useState([]);
  const [toolLogs, setToolLogs] = useState([]);
  const [workflowDropConfirm, setWorkflowDropConfirm] = useState(null);
  const [showManualWorkflowsModal, setShowManualWorkflowsModal] = useState(false);
  const [isDraggingWorkflow, setIsDraggingWorkflow] = useState(false);
  const [armedWorkflow, setArmedWorkflow] = useState(null);
  const draggingWorkflowRef = useRef(null);
  const armedWorkflowRef = useRef(null);
  const [activeSimulationLogRun, setActiveSimulationLogRun] = useState(null);
  const runningNodeIdsRef = useRef(new Set());
  const [, setRunningNodeIds] = useState(new Set());
  const [liveConnectingThread, setLiveConnectingThread] = useState(null);
  const [liveExplorationThread, setLiveExplorationThread] = useState(null);
  const [selectedExplorationThreadId, setSelectedExplorationThreadId] = useState(null);
  const [workflowNodes, setWorkflowNodes] = useState(DEFAULT_EXTRACTION_WORKFLOW.nodes);
  const [showWorkflowDeleteModal, setShowWorkflowDeleteModal] = useState(false);
  const [showWorkflowInfoModal, setShowWorkflowInfoModal] = useState(false);
  const [showResourceDeleteModal, setShowResourceDeleteModal] = useState(false);
  const [resourceNodeToDelete, setResourceNodeToDelete] = useState(null);
  const [notification, setNotification] = useState(null);
  const [pendingToolApproval, setPendingToolApproval] = useState(null);
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

              const loadedEngines = proj.engines && proj.engines.length > 0 ? proj.engines : ['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder'];
              const mergedEngines = Array.from(new Set(['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder', ...loadedEngines]));
              setEngines(mergedEngines);
              if (proj.enginesData) {
                setEnginesData(proj.enginesData);
              }
              if (proj.currentEngine) {
                setCurrentEngine(proj.currentEngine);
              }
              setWorkflowLogs(proj.workflowLogs || []);
              setToolLogs(proj.toolLogs || []);

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
    const isResource =
      node.category === 'resource' ||
      node.type === 'document' ||
      node.type === 'resource' ||
      Boolean(node.cloudinaryUrl) ||
      Boolean(node.fileSize);

    // If a manual workflow was armed by clicking in the modal, execute it on this node
    if (armedWorkflowRef.current && !isResource) {
      const wf = armedWorkflowRef.current;
      setArmedWorkflow(null);
      armedWorkflowRef.current = null;
      handleWorkflowDropOnNode(wf, node);
      return;
    }

    setSelectedDocNode(node);
    setChatFocusNode(node);

    // Select the parent node and all its child nodes in exploration (vice versa will not happen)
    const group = getSubtreeNodeIds(node.id, connectionsRef.current, nodesRef.current);
    setSelectedGroupNodeIds(group);
  };

  const handleNodeDragStart = (id) => {
    const node = nodesRef.current[id];
    if (!node) return;

    // Moving a node moves that node and all its child nodes (vice versa will not happen)
    const activeGroup = getSubtreeNodeIds(id, connectionsRef.current, nodesRef.current);
    setSelectedGroupNodeIds(activeGroup);

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
      return next;
    });
  };

  // Positions are saved once, when the drag ends (not on every pointer move).
  const handleNodeDragEnd = () => {
    persistProjectNodes(nodesRef.current);
    groupDragRef.current = null;
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

  const handleRequestDeleteResource = (node) => {
    if (!node) return;
    setResourceNodeToDelete(node);
    setShowResourceDeleteModal(true);
  };

  const handleDeleteResourceNode = async (nodeToDelete) => {
    if (!nodeToDelete) return;
    const nodeId = typeof nodeToDelete === 'string' ? nodeToDelete : (nodeToDelete.id || nodeToDelete.node_id);
    if (!nodeId) return;

    const targetNode = nodesRef.current[nodeId] || (typeof nodeToDelete === 'object' ? nodeToDelete : null);
    const nodeTitle = targetNode?.name || targetNode?.title || nodeId;

    // Collect all nodes to delete in the tree starting from the source file
    const nodesToDelete = getSubtreeNodeIds(nodeId, connectionsRef.current, nodesRef.current);

    // 1. Remove all collected tree nodes from state
    const nextNodes = { ...nodesRef.current };
    nodesToDelete.forEach((id) => {
      delete nextNodes[id];
    });
    nodesRef.current = nextNodes;
    setNodes(nextNodes);

    // 2. Remove all connected threads touching any deleted node
    const nextConnections = { ...connectionsRef.current };
    Object.keys(nextConnections).forEach((key) => {
      const conn = nextConnections[key];
      if (
        conn &&
        (nodesToDelete.has(conn.source_node_id) ||
          nodesToDelete.has(conn.target_node_id) ||
          nodesToDelete.has(conn.source) ||
          nodesToDelete.has(conn.target))
      ) {
        delete nextConnections[key];
      }
    });
    connectionsRef.current = nextConnections;
    setConnections(nextConnections);

    // 3. Clear UI selections
    setSelectedDocNode(null);
    setChatFocusNode((prev) => (prev && nodesToDelete.has(prev.id || prev.node_id) ? null : prev));
    setSelectedGroupNodeIds((prev) => {
      const next = new Set(prev);
      nodesToDelete.forEach((id) => next.delete(id));
      return next;
    });

    // 4. Update project in memory and save completely to IndexedDB storage
    if (currentProjectRef.current) {
      const proj = currentProjectRef.current;
      const expName = currentExploration || 'exploration_01';
      const currentExp = proj.explorationsData?.[expName] || {};

      // Filter from proj.documents if exists
      const updatedDocuments = Array.isArray(proj.documents)
        ? proj.documents.filter((d) => d && !nodesToDelete.has(d.id) && !nodesToDelete.has(d.doc_id) && d.name !== nodeTitle)
        : proj.documents;

      const updatedProject = {
        ...proj,
        documents: updatedDocuments,
        explorationsData: {
          ...(proj.explorationsData || {}),
          [expName]: {
            ...currentExp,
            nodes: nextNodes,
            connections: nextConnections,
          },
        },
        updatedAt: new Date().toISOString(),
      };

      currentProjectRef.current = updatedProject;
      setCurrentProject(updatedProject);
      saveProject(updatedProject).catch((err) => console.error('Failed to save project after deleting resource:', err));
    }

    // 5. Delete document file completely from backend storage if server is active
    try {
      await fetch('http://127.0.0.1:8001/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: nodeId,
          file_name: targetNode?.name || targetNode?.title || '',
          url: targetNode?.url || targetNode?.cloudinaryUrl || '',
          local_path: targetNode?.local_path || targetNode?.localPath || '',
        }),
      });
    } catch {
      // Local server offline or file already removed
    }

    const rawType = targetNode?.category || targetNode?.type || targetNode?.node_type || 'node';
    const typeLabel = rawType.charAt(0).toUpperCase() + rawType.slice(1);
    setNotification(`${typeLabel} "${nodeTitle}" deleted`);
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
      const isVision = modelId?.toLowerCase().includes('spark') || modelName?.toLowerCase().includes('vision');
      const newAgent = {
        id,
        title: 'Agent',
        sub: modelName,
        type: 'agent',
        modelId,
        modelName,
        systemPrompt: '',
        temperature: 0.7,
        reasoningEffort: 'minimal',
        tools: true,
        inputSource: isVision ? 'both' : 'previous',
        contextSources: {
          inputFile: isVision,
          inputMetadata: true,
          previousOutput: true,
          previousMetadata: true,
        },
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

  function extractConnectionAiVerdict(finalRun) {
    const agentNode =
      finalRun?.nodes?.agent_1 ||
      Object.values(finalRun?.nodes || {}).find((n) => n.type === 'agent');
    const engineNode = finalRun?.nodes?.engine_1;

    if (engineNode?.outputData?.valid === false || engineNode?.outputData?.status === 'rejected') {
      return {
        connected: false,
        status: 'rejected',
        relationship: 'rejected',
        label: 'No logical connection',
        explanation:
          engineNode?.outputData?.reason ||
          engineNode?.outputData?.error ||
          'Connection criteria not met.',
      };
    }

    const rawCandidates = [
      agentNode?.outputData?.text,
      agentNode?.outputData?.synthesis,
      agentNode?.outputData?.agent_synthesis,
      finalRun?.nodes?.output?.outputData?.synthesis,
    ].filter(Boolean);

    for (const candidate of rawCandidates) {
      if (typeof candidate === 'object' && candidate !== null) {
        if (candidate.connected !== undefined || candidate.relationship || candidate.label) {
          const isConnected = candidate.connected !== false;
          return {
            connected: isConnected,
            status: isConnected ? 'active' : 'rejected',
            relationship: candidate.relationship || (isConnected ? 'connected' : 'unrelated'),
            label: candidate.label || (isConnected ? 'Connected' : 'No logical connection'),
            explanation: candidate.explanation || '',
          };
        }
      }
      if (typeof candidate === 'string') {
        let cleanText = candidate.trim();
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        }
        try {
          const parsed = JSON.parse(cleanText);
          if (parsed && typeof parsed === 'object') {
            const isConnected = parsed.connected !== false;
            return {
              connected: isConnected,
              status: isConnected ? 'active' : 'rejected',
              relationship: parsed.relationship || (isConnected ? 'connected' : 'unrelated'),
              label: parsed.label || (isConnected ? 'Connected' : 'No logical connection'),
              explanation: parsed.explanation || '',
            };
          }
        } catch {
          const jsonMatch = cleanText.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed && typeof parsed === 'object') {
                const isConnected = parsed.connected !== false;
                return {
                  connected: isConnected,
                  status: isConnected ? 'active' : 'rejected',
                  relationship: parsed.relationship || (isConnected ? 'connected' : 'unrelated'),
                  label: parsed.label || (isConnected ? 'Connected' : 'No logical connection'),
                  explanation: parsed.explanation || '',
                };
              }
            } catch { }
          }
        }
      }
    }

    if (finalRun?.status === 'completed') {
      return {
        connected: true,
        status: 'active',
        relationship: 'connected',
        label: 'Connected',
        explanation: 'Relationship synthesized and verified by workflow.',
      };
    }

    return {
      connected: true,
      status: 'active',
      relationship: 'manual_connection',
      label: 'Manual Connection',
      explanation: 'Manual connection established by user.',
    };
  }

  const triggerWorkflowExecution = async (triggerType, triggerPayload) => {
    const targetDocId = triggerPayload?.nodeId || triggerPayload?.doc_id;
    try {
      const matchedWfs = findWorkflowsForTrigger(currentProjectRef.current, triggerType);
      if (!matchedWfs || matchedWfs.length === 0) {
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

      // Execute all matched workflows sequentially (one by one) to prevent API concurrency collisions
      const runResults = [];
      for (const matchedWf of matchedWfs) {
        try {
          const runRes = await executeWorkflow({
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
          runResults.push({ status: 'fulfilled', value: runRes });
        } catch (wfErr) {
          runResults.push({ status: 'rejected', reason: wfErr });
        }
      }
      const successfulRuns = runResults
        .filter((r) => r.status === 'fulfilled' && r.value)
        .map((r) => r.value);
      const isAnyCompleted = successfulRuns.some((run) => run.status === 'completed');

      // Update node status when extraction completes
      if (targetDocId) {
        const resolvedPath =
          successfulRuns.find(
            (run) => run?.nodes?.engine_bridge?.outputData?.local_path
          )?.nodes?.engine_bridge?.outputData?.local_path ||
          successfulRuns.find(
            (run) => run?.nodes?.engine_bridge?.outputData?.file_path
          )?.nodes?.engine_bridge?.outputData?.file_path;

        setNodes((prev) => {
          if (!prev[targetDocId]) return prev;
          const updated = {
            ...prev[targetDocId],
            local_path: resolvedPath || prev[targetDocId].local_path,
            status: isAnyCompleted ? 'verified' : (prev[targetDocId].status === 'extracting' ? 'not checked' : prev[targetDocId].status),
            extracting: false,
            extractionCompleted: isAnyCompleted,
            updatedAt: new Date().toISOString(),
          };
          const next = { ...prev, [targetDocId]: updated };
          persistProjectNodes(next);
          return next;
        });
      }

      // Update connection verdict when node_connect relationship synthesis completes
      if (triggerType === 'node_connect') {
        const targetConnId =
          triggerPayload?.connectionId ||
          triggerPayload?.connection?.id ||
          triggerPayload?.connection?.connection_id;

        if (targetConnId && successfulRuns.length > 0) {
          const verdict = extractConnectionAiVerdict(successfulRuns[0]);
          setConnections((prev) => {
            const existing = prev[targetConnId];
            if (!existing) return prev;
            const updated = {
              ...existing,
              status: verdict.status,
              label: verdict.label,
              relationship_type: verdict.relationship,
              explanation: verdict.explanation,
              ai_verdict: verdict,
              updatedAt: new Date().toISOString(),
            };
            const next = { ...prev, [targetConnId]: updated };

            if (currentProjectRef.current && currentExploration) {
              const currentExp = currentProjectRef.current.explorationsData?.[currentExploration] || {};
              const updatedProject = {
                ...currentProjectRef.current,
                explorationsData: {
                  ...(currentProjectRef.current.explorationsData || {}),
                  [currentExploration]: {
                    ...currentExp,
                    connections: next,
                  },
                },
              };
              currentProjectRef.current = updatedProject;
              setCurrentProject(updatedProject);
              saveProject(updatedProject).catch((err) => console.error('Failed to save connection verdict:', err));
            }

            return next;
          });
        }
      }

      // Persist logs in project
      if (currentProjectRef.current && successfulRuns.length > 0) {
        setWorkflowLogs((prev) => {
          const runIds = new Set(successfulRuns.map((r) => r.id));
          const updatedLogs = [...successfulRuns, ...prev.filter((r) => !runIds.has(r.id))];
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
      if (triggerType === 'node_connect') {
        const targetConnId =
          triggerPayload?.connectionId ||
          triggerPayload?.connection?.id ||
          triggerPayload?.connection?.connection_id;
        if (targetConnId) {
          setConnections((prev) => {
            if (!prev[targetConnId]) return prev;
            const updated = {
              ...prev[targetConnId],
              status: 'active',
              label: 'Manual Connection',
              relationship_type: 'manual_connection',
              explanation: 'Manual connection established by user.',
              updatedAt: new Date().toISOString(),
            };
            const next = { ...prev, [targetConnId]: updated };
            if (currentProjectRef.current && currentExploration) {
              const currentExp = currentProjectRef.current.explorationsData?.[currentExploration] || {};
              const updatedProject = {
                ...currentProjectRef.current,
                explorationsData: {
                  ...(currentProjectRef.current.explorationsData || {}),
                  [currentExploration]: {
                    ...currentExp,
                    connections: next,
                  },
                },
              };
              currentProjectRef.current = updatedProject;
              setCurrentProject(updatedProject);
              saveProject(updatedProject).catch((e) => console.error('Failed to save fallback connection:', e));
            }
            return next;
          });
        }
      }
    } finally {
      setIsWorkflowRunning(false);
    }
  };

  const handleWorkflowDropOnNode = (workflow, targetNode, position) => {
    const wf = workflow || draggingWorkflowRef.current || armedWorkflowRef.current;
    draggingWorkflowRef.current = null;
    armedWorkflowRef.current = null;
    setArmedWorkflow(null);
    setIsDraggingWorkflow(false);
    setShowManualWorkflowsModal(false);
    if (!targetNode || !targetNode.id) return;

    const isResource =
      targetNode.category === 'resource' ||
      targetNode.type === 'document' ||
      targetNode.type === 'resource' ||
      Boolean(targetNode.cloudinaryUrl) ||
      Boolean(targetNode.fileSize);
    if (isResource) {
      setNotification('Workflows can only be run on canvas nodes');
      return;
    }

    if (runningNodeIdsRef.current.has(targetNode.id)) {
      setNotification('Already running on this node');
      return;
    }
    if (!wf) return;
    setWorkflowDropConfirm({ workflow: wf, node: targetNode, position });
  };

  const handleExecuteManualWorkflow = async (workflow, sourceNode) => {
    if (!workflow || !sourceNode) return;
    const nodeId = sourceNode.id;
    if (runningNodeIdsRef.current.has(nodeId)) {
      setNotification('Already running on this node');
      return;
    }

    runningNodeIdsRef.current.add(nodeId);
    setRunningNodeIds(new Set(runningNodeIdsRef.current));
    setIsWorkflowRunning(true);

    // Show circular loader on the source node (reuses existing extraction loader)
    const prevStatus = sourceNode.status || 'verified';
    setNodes((prev) => {
      if (!prev[nodeId]) return prev;
      const updated = {
        ...prev[nodeId],
        extracting: true,
        status: 'extracting',
        updatedAt: new Date().toISOString(),
      };
      const next = { ...prev, [nodeId]: updated };
      persistProjectNodes(next);
      return next;
    });

    const wfId = workflow.workflowId || workflow.id;
    const wfName = workflow.workflowName || workflow.name || wfId;
    const wfData = currentProjectRef.current?.workflowsData?.[wfId] || DEFAULT_WORKFLOWS[wfId];

    // Build input payload strictly from the dropped node (not whole canvas)
    // Only what the run needs: the node itself, once. File fields only when the node has a file.
    const hasFile = Boolean(sourceNode.file_bytes_b64 || sourceNode.local_path || sourceNode.localPath);
    const compactNode = {
      id: sourceNode.id,
      title: sourceNode.title || sourceNode.name || 'Untitled Node',
      description: sourceNode.description || sourceNode.content || '',
      type: sourceNode.type || (sourceNode.category === 'resource' ? 'document' : 'finding'),
      ...(sourceNode.metadata && Object.keys(sourceNode.metadata).length > 0 ? { metadata: sourceNode.metadata } : {}),
      ...(hasFile
        ? {
          file_name: sourceNode.file_name || sourceNode.fileName || sourceNode.title || '',
          local_path: sourceNode.local_path || sourceNode.localPath || '',
          file_bytes_b64: sourceNode.file_bytes_b64 || sourceNode.b64 || '',
        }
        : {}),
    };

    const triggerPayload = {
      triggerType: 'manual',
      triggerLabel: `manual: ${wfName} on ${compactNode.title}`,
      node: compactNode,
      nodeId: sourceNode.id,
      exploration_id: currentExploration,
      ...(hasFile
        ? {
          doc_id: sourceNode.doc_id || sourceNode.id,
          file_name: compactNode.file_name,
          local_path: compactNode.local_path,
          file_bytes_b64: compactNode.file_bytes_b64,
        }
        : {}),
    };

    try {
      const runRecord = await executeWorkflow({
        workflowId: wfId,
        workflowData: wfData,
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
        },
      });

      // Keep runRecord in logs and project
      setWorkflowLogs((prev) => {
        const existingIdx = prev.findIndex((r) => r.id === runRecord.id);
        const updated = existingIdx >= 0
          ? prev.map((r, i) => (i === existingIdx ? runRecord : r))
          : [runRecord, ...prev];
        if (currentProjectRef.current) {
          currentProjectRef.current = { ...currentProjectRef.current, workflowLogs: updated };
          saveProject({
            ...currentProjectRef.current,
            updatedAt: new Date().toISOString(),
          }).catch((err) => console.error('Failed to save run logs:', err));
        }
        return updated;
      });

      const isFailed = runRecord.status === 'failed';
      let createdIds = runRecord.createdNodeIds || [];

      // A run that created no canvas nodes but produced text or an image gets one result node,
      // so the special thread has an endpoint and the output is visible on the canvas.
      const resultNode =
        !isFailed && createdIds.length === 0 && (runRecord.resultOutput?.text || runRecord.resultOutput?.image_path)
          ? {
            id: `res_${runRecord.id}`,
            node_id: `res_${runRecord.id}`,
            exploration_id: currentExploration,
            name: `${wfName} result`,
            title: `${wfName} result`,
            description: runRecord.resultOutput.text || 'Generated image',
            content: runRecord.resultOutput.text || '',
            type: 'finding',
            category: 'info',
            status: 'proposed',
            x: (sourceNode.x || 0) + 420,
            y: sourceNode.y || 0,
            metadata: { workflow_run_id: runRecord.id, workflow_id: wfId },
            ...(runRecord.resultOutput.image_path
              ? {
                local_path: runRecord.resultOutput.image_path,
                localPath: runRecord.resultOutput.image_path,
                file_name: 'generated_image.webp',
              }
              : {}),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          : null;
      if (resultNode) {
        createdIds = [resultNode.id];
        // If the text is very long (> 2000 chars), persist it as a local text file in storage
        if (runRecord.resultOutput?.text && runRecord.resultOutput.text.length > 2000) {
          const rawText = runRecord.resultOutput.text;
          const textFilename = `${wfName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_result_${Date.now()}.txt`;
          try {
            const upRes = await fetch('http://127.0.0.1:8001/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file_name: textFilename,
                doc_id: `txt_${Date.now()}`,
                file_bytes_b64: btoa(unescape(encodeURIComponent(rawText))),
              }),
            });
            if (upRes.ok) {
              const data = await upRes.json().catch(() => ({}));
              if (data?.local_path) {
                resultNode.local_path = data.local_path;
                resultNode.localPath = data.local_path;
                resultNode.file_name = textFilename;
              }
            }
          } catch (uploadErr) {
            console.warn('Could not persist long text to local server:', uploadErr);
          }
        }
      }

      // Build the new canvas state from the latest refs in one step, then set it once and save it once.
      // (Doing this inside state updaters let concurrent saves overwrite each other's threads.)
      const restoredSource = {
        ...(nodesRef.current[nodeId] || sourceNode),
        extracting: false,
        status: isFailed ? prevStatus : 'verified',
        updatedAt: new Date().toISOString(),
      };
      const updatedNodes = { ...nodesRef.current, [nodeId]: restoredSource };
      if (resultNode) updatedNodes[resultNode.id] = resultNode;
      createdIds.forEach((cid) => {
        if (updatedNodes[cid]) {
          updatedNodes[cid] = { ...updatedNodes[cid], autoLayout: true };
        }
      });

      const nextConns = { ...connectionsRef.current };
      if (createdIds.length > 0) {
        createdIds.forEach((cid, idx) => {
          const threadId = `conn_run_${runRecord.id}_${cid}`;
          const targetNode = updatedNodes[cid];
          const desc = `Workflow "${wfName}": processed "${sourceNode.title || sourceNode.name || 'node'}" and generated "${targetNode?.title || targetNode?.name || cid}".`;
          nextConns[threadId] = {
            id: threadId,
            connection_id: threadId,
            source_node_id: nodeId,
            target_node_id: cid,
            kind: 'workflow_run',
            runId: runRecord.id,
            workflowId: wfId,
            workflowName: wfName,
            label: wfName,
            workflowDescription: wfData?.description || 'Manual workflow execution',
            description: desc,
            status: runRecord.status,
            startedAt: runRecord.startTime,
            finishedAt: new Date().toISOString(),
            createdNodeIds: createdIds,
            runRecord,
            isFirstOfRun: idx === 0,
          };
        });
      } else {
        // Keep the special thread even if the run failed or created nothing (red failed thread)
        const threadId = `conn_run_${runRecord.id}_failed`;
        nextConns[threadId] = {
          id: threadId,
          connection_id: threadId,
          source_node_id: nodeId,
          target_node_id: `stub_${runRecord.id}`,
          kind: 'workflow_run',
          runId: runRecord.id,
          workflowId: wfId,
          workflowName: wfName,
          label: wfName,
          workflowDescription: wfData?.description || 'Manual workflow execution',
          description: `Workflow "${wfName}" execution failed on "${sourceNode.title || sourceNode.name || 'node'}".`,
          status: 'failed',
          startedAt: runRecord.startTime,
          finishedAt: new Date().toISOString(),
          createdNodeIds: [],
          runRecord,
          isFirstOfRun: true,
          endPosition: {
            x: restoredSource.x + (restoredSource.width || 185) + 120,
            y: restoredSource.y + 10,
            width: 14,
            height: 14,
          },
        };
      }

      // Tree-place the new nodes under the source, then update the refs, state and storage together.
      const positionedNodes = layoutAutoNodes(updatedNodes, nextConns);
      nodesRef.current = positionedNodes;
      connectionsRef.current = nextConns;
      setNodes(positionedNodes);
      setConnections(nextConns);

      if (currentProjectRef.current && currentExploration) {
        const currentExp = currentProjectRef.current.explorationsData?.[currentExploration] || {};
        const updatedProject = {
          ...currentProjectRef.current,
          explorationsData: {
            ...(currentProjectRef.current.explorationsData || {}),
            [currentExploration]: {
              ...currentExp,
              nodes: positionedNodes,
              connections: nextConns,
              updatedAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date().toISOString(),
        };
        currentProjectRef.current = updatedProject;
        saveProject(updatedProject).catch((err) => console.error('Failed to persist run connections:', err));
      }
    } catch (err) {
      console.error('Manual workflow run failed:', err);
      // Reset source node loading
      setNodes((prevNodes) => {
        if (!prevNodes[nodeId]) return prevNodes;
        const next = {
          ...prevNodes,
          [nodeId]: {
            ...prevNodes[nodeId],
            extracting: false,
            status: prevStatus,
          },
        };
        persistProjectNodes(next);
        return next;
      });
    } finally {
      runningNodeIdsRef.current.delete(nodeId);
      setRunningNodeIds(new Set(runningNodeIdsRef.current));
      setIsWorkflowRunning(runningNodeIdsRef.current.size > 0);
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
              relationship_type: 'analyzing',
              label: 'Analyzing connection...',
              status: 'analyzing',
              is_manual: true,
              source: 'manual',
              createdAt: new Date().toISOString(),
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
            const sNode = nodes[sourceId] || { id: sourceId };
            const tNode = nodes[targetNodeId] || { id: targetNodeId };
            triggerWorkflowExecution('node_connect', {
              triggerType: 'node_connect',
              triggerLabel: `node_connect: Node #${sourceId} → Node #${targetNodeId}`,
              connectionId: newConnId,
              connection: newConnection,
              sourceNode: sNode,
              targetNode: tNode,
              source_node: sNode,
              target_node: tNode,
              exploration_id: currentExploration || 'exploration_01',
              node_pair: {
                source_node: sNode,
                target_node: tNode,
                exploration_id: currentExploration || 'exploration_01',
              },
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
            name: nextName,
            description: 'Custom processing workflow pipeline.',
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
    setIsWorkflowAssembling(false);
    currentWorkflowRef.current = wfName;
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

  const handleUpdateWorkflowMetadata = (wfUid, { name: newName, description: newDesc }) => {
    const sanitized = (newName || '').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    if (!sanitized) return;

    const proj = currentProjectRef.current || currentProject;
    if (!proj) return;

    const baseData = proj.workflowsData?.[wfUid] || DEFAULT_WORKFLOWS[wfUid] || {};
    const updatedWorkflowsData = {
      ...(proj.workflowsData || {}),
      [wfUid]: {
        ...baseData,
        name: sanitized,
        description: typeof newDesc === 'string' ? newDesc.trim() : baseData.description || '',
      },
    };

    const updatedProject = {
      ...proj,
      workflowsData: updatedWorkflowsData,
      updatedAt: new Date().toISOString(),
    };

    currentProjectRef.current = updatedProject;
    setCurrentProject(updatedProject);
    saveProject(updatedProject).catch((err) => console.error('Failed to save updated workflow metadata:', err));
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
    if (['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder'].includes(engId)) return;
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
    const isVideoOrGif =
      /\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v|gif)$/i.test(file.name) ||
      file.type?.startsWith('video/') ||
      file.type === 'image/gif';

    if (isVideoOrGif) {
      setNotification(`"${file.name}" is not supported. Video and GIF files are disabled.`);
      return;
    }

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

    const localBlobUrl = URL.createObjectURL(file);

    // Read full base64 data for local storage and Python engines execution
    let fileB64 = '';
    try {
      fileB64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = String(reader.result || '');
          const comma = res.indexOf(',');
          resolve(comma !== -1 ? res.slice(comma + 1) : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (readErr) {
      console.warn('Could not read file base64:', readErr);
    }

    let resolvedUrl = localBlobUrl;
    let localFilePath = '';

    // Persist to local Python server if available
    try {
      const upRes = await fetch('http://127.0.0.1:8001/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          doc_id: nodeId,
          file_bytes_b64: fileB64,
        }),
      });
      if (upRes.ok) {
        const upData = await upRes.json();
        if (upData.url) resolvedUrl = upData.url;
        if (upData.local_path) localFilePath = upData.local_path;
      }
    } catch {
      // Local server offline; browser blob URL works seamlessly
    }

    const finalizedNode = {
      ...initialNode,
      url: resolvedUrl,
      cloudinaryUrl: resolvedUrl,
      local_path: localFilePath,
      localPath: localFilePath,
      localBlobUrl,
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
        url: resolvedUrl,
        cloudinaryUrl: resolvedUrl,
        local_path: localFilePath,
        localPath: localFilePath,
        doc_id: nodeId,
        b64: fileB64,
        file_bytes_b64: fileB64,
      },
      doc_id: nodeId,
      nodeId: nodeId,
    });
  };

  const handleSelectProject = async (project) => {
    if (!project || !project.id) return;
    try {
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

      const loadedEngines = fullProject.engines && fullProject.engines.length > 0 ? fullProject.engines : ['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder'];
      const mergedEngines = Array.from(new Set(['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder', ...loadedEngines]));
      setEngines(mergedEngines);
      if (fullProject.currentEngine) {
        setCurrentEngine(fullProject.currentEngine);
      }
      if (fullProject.enginesData) {
        setEnginesData(fullProject.enginesData);
      }
      setWorkflowLogs(fullProject.workflowLogs || []);
      setToolLogs(fullProject.toolLogs || []);

      const activeWf = fullProject.currentWorkflow || 'extraction';
      setCurrentWorkflow(activeWf);
      const wfEntry = fullProject.workflowsData?.[activeWf];
      const isOldSkeleton = wfEntry?.nodes && Object.keys(wfEntry.nodes).length <= 2 && wfEntry.nodes.input && wfEntry.nodes.output;
      if (wfEntry && !isOldSkeleton) {
        if (wfEntry.nodes) {
          setWorkflowNodes(wfEntry.nodes);
        }
        if (wfEntry.threads) {
          const cleanThreads = Array.isArray(wfEntry.threads)
            ? wfEntry.threads.map((t) =>
              t.condition && t.condition.includes('video')
                ? { ...t, condition: "category == 'image'" }
                : t
            )
            : wfEntry.threads;
          setWorkflowThreads(cleanThreads);
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

  const handleExecuteWorkflowTool = async (toolName, args) => {
    const isCreating = toolName === 'create_workflow';
    if (isCreating) {
      setIsWorkflowAssembling(true);
    }
    try {
      const proj = currentProjectRef.current;
      const activeWorkflowId = currentWorkflowRef.current || currentWorkflow;
      const res = await runWorkflowTool(
        {
          workflows: workflows || proj?.workflows || ['extraction', 'connection_synthesis'],
          workflowsData: proj?.workflowsData || {},
          currentWorkflow: activeWorkflowId,
          engines: getAllEngineIds(engines, proj?.engines || []),
          enginesData: proj?.enginesData || enginesData,
          isWorkflowRunning: isWorkflowRunning,
          workflowLogs: workflowLogs || proj?.workflowLogs || [],
          onWorkflowProgress: (updatedRun) => {
            setWorkflowLogs((prev) => {
              const existingIdx = prev.findIndex((r) => r.id === updatedRun.id);
              if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = updatedRun;
                return next;
              }
              return [updatedRun, ...prev];
            });
          },
          onExecuteTool: handleExecuteInvestigationTool,
        },
        toolName,
        args || {}
      );

      if (res.run_record || res.runRecord) {
        const record = res.run_record || res.runRecord;
        setWorkflowLogs((prev) => {
          const existingIdx = prev.findIndex((r) => r.id === record.id);
          const updated = existingIdx >= 0
            ? prev.map((r, i) => (i === existingIdx ? record : r))
            : [record, ...prev];
          if (currentProjectRef.current) {
            const updatedProject = {
              ...currentProjectRef.current,
              workflowLogs: updated,
              updatedAt: new Date().toISOString(),
            };
            currentProjectRef.current = updatedProject;
            saveProject(updatedProject).catch((err) => console.error('Failed to save tool run logs:', err));
          }
          return updated;
        });
      }

      if (res.updatedWorkflows || res.updatedWorkflowsData || res.currentWorkflow) {
        const nextWorkflows = res.updatedWorkflows || workflows;
        const nextWorkflowsData = res.updatedWorkflowsData || proj?.workflowsData || {};
        const nextCurrentWorkflow = res.currentWorkflow || activeWorkflowId;

        currentWorkflowRef.current = nextCurrentWorkflow;
        if (res.updatedWorkflows) setWorkflows(nextWorkflows);
        setCurrentWorkflow(nextCurrentWorkflow);

        const activeData = nextWorkflowsData[nextCurrentWorkflow] || DEFAULT_WORKFLOWS[nextCurrentWorkflow];
        if (activeData) {
          if (activeData.nodes) setWorkflowNodes(activeData.nodes);
          if (activeData.threads) setWorkflowThreads(activeData.threads);
        }

        if (currentProjectRef.current) {
          const updatedProject = {
            ...currentProjectRef.current,
            workflows: nextWorkflows,
            workflowsData: nextWorkflowsData,
            currentWorkflow: nextCurrentWorkflow,
            updatedAt: new Date().toISOString(),
          };
          currentProjectRef.current = updatedProject;
          setCurrentProject(updatedProject);
          saveProject(updatedProject).catch((err) => console.error('Failed to save workflow from tool:', err));
        }
      } else if (res.updatedWorkflowNodes || res.updatedWorkflowThreads) {
        if (res.updatedWorkflowNodes) setWorkflowNodes(res.updatedWorkflowNodes);
        if (res.updatedWorkflowThreads) setWorkflowThreads(res.updatedWorkflowThreads);

        const targetWfId = currentWorkflowRef.current || currentWorkflow;
        if (currentProjectRef.current) {
          const updatedProject = {
            ...currentProjectRef.current,
            workflowsData: {
              ...(currentProjectRef.current.workflowsData || {}),
              [targetWfId]: {
                ...(currentProjectRef.current.workflowsData?.[targetWfId] || {}),
                nodes: res.updatedWorkflowNodes || workflowNodes,
                threads: res.updatedWorkflowThreads || workflowThreads,
              },
            },
            updatedAt: new Date().toISOString(),
          };
          currentProjectRef.current = updatedProject;
          setCurrentProject(updatedProject);
          saveProject(updatedProject).catch((err) => console.error('Failed to save workflow nodes from tool:', err));
        }
      }

      return res;
    } finally {
      if (isCreating) {
        setIsWorkflowAssembling(false);
      }
    }
  };

  const recordToolExecution = (toolName, args, res, durationMs) => {
    const isDenied = Boolean(res?.denied);
    const isError = Boolean(res?.error) && !isDenied;
    const status = isDenied ? 'denied' : isError ? 'failed' : 'success';

    const toolRecord = {
      id: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      toolName,
      category: ENGINE_TOOL_NAMES.includes(toolName)
        ? 'engine'
        : WORKFLOW_TOOL_NAMES.includes(toolName)
        ? 'workflow'
        : 'canvas',
      args,
      result: res,
      status,
      startTime: new Date().toLocaleTimeString(),
      duration: `${Math.round(durationMs)}ms`,
      timestamp: Date.now(),
    };

    setToolLogs((prev) => {
      const next = [toolRecord, ...prev];
      if (currentProjectRef.current) {
        currentProjectRef.current = { ...currentProjectRef.current, toolLogs: next };
        saveProject(currentProjectRef.current).catch(() => {});
      }
      return next;
    });
  };

  const handleExecuteInvestigationTool = async (toolName, args) => {
    const startMs = performance.now();
    let res = null;
    try {
      res = await (async () => {
      // Intercept destructive / deletion tool calls for user permission
      const isDeletion =
        toolName === 'delete_node' ||
        toolName === 'remove_connection' ||
        toolName === 'delete_workflow' ||
        toolName === 'delete_workflow_node' ||
        toolName === 'delete_engine' ||
        toolName.startsWith('delete_') ||
        toolName.startsWith('remove_');

      if (isDeletion) {
        let itemLabel = toolName.replace(/_/g, ' ');
        if (toolName === 'delete_node') {
          const targetExp = args?.exploration_id || currentExploration;
          const expNodes =
            currentProjectRef.current?.explorationsData?.[targetExp]?.nodes || nodesRef.current || {};
          if (args.delete_all || args.node_id === 'all' || args.node_id === '*') {
            itemLabel = 'all exploration nodes';
          } else if (Array.isArray(args.node_ids)) {
            itemLabel = `${args.node_ids.length} exploration nodes`;
          } else if (args.node_id) {
            const n = expNodes[args.node_id];
            const type = n?.category || n?.type || 'node';
            itemLabel = `${type} "${n?.title || n?.name || args.node_id}"`;
          }
        } else if (toolName === 'remove_connection') {
          itemLabel = `thread "${args.connection_id}"`;
        } else if (toolName === 'delete_workflow') {
          itemLabel = `workflow "${args.workflow_name || args.workflow_id || args.name || ''}"`;
        } else if (toolName === 'delete_workflow_node') {
          itemLabel = `workflow node "${args.node_id}"`;
        } else if (toolName === 'delete_engine') {
          itemLabel = `engine "${args.engine_id || args.name || ''}"`;
        }

        const approved = await new Promise((resolve) => {
          setPendingToolApproval({
            id: Math.random().toString(36).substring(2, 9),
            toolName,
            itemLabel,
            args,
            timeoutSeconds: 30,
            resolve,
          });
        });

        setPendingToolApproval(null);

        if (!approved) {
          return {
            error: `User denied permission to execute ${toolName} for ${itemLabel}. Action not allowed.`,
            denied: true,
            status: 'denied',
          };
        }
      }

      if (ENGINE_TOOL_NAMES.includes(toolName)) {
        return handleExecuteEngineTool(toolName, args);
      }
      if (WORKFLOW_TOOL_NAMES.includes(toolName)) {
        return handleExecuteWorkflowTool(toolName, args);
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

      const toolExecutionResult = await executeNodeTool(
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

      if (toolExecutionResult.updatedNodes || toolExecutionResult.updatedConnections) {
        // Nodes created by this tool call are AI-generated: flag them for auto layout, then arrange
        // the tree. Nodes the user has dragged (userMoved) and resources are never repositioned.
        const base = toolExecutionResult.updatedNodes || currentExpNodes;
        const flagged = { ...base };
        for (const id of Object.keys(base)) {
          if (!currentExpNodes[id] && base[id].type !== 'document' && base[id].category !== 'resource') {
            flagged[id] = { ...base[id], autoLayout: true };
          }
        }
        toolExecutionResult.updatedNodes = layoutAutoNodes(flagged, toolExecutionResult.updatedConnections || currentExpConnections);
      }

      if (toolExecutionResult.updatedNodes) {
        nextNodes = toolExecutionResult.updatedNodes;
        if (targetExp === currentExploration) {
          nodesRef.current = toolExecutionResult.updatedNodes;
          setNodes(toolExecutionResult.updatedNodes);
        }
      }

      if (toolExecutionResult.updatedConnections) {
        nextConnections = toolExecutionResult.updatedConnections;
        if (targetExp === currentExploration) {
          connectionsRef.current = toolExecutionResult.updatedConnections;
          setConnections(toolExecutionResult.updatedConnections);
        }
      }

      persistProjectNodes(nextNodes, targetExp, nextConnections);
      return toolExecutionResult;
    })();
    } catch (err) {
      console.error(`Tool execution error in ${toolName}:`, err);
      res = { error: err?.message || String(err), status: 'failed' };
    }

    recordToolExecution(toolName, args, res, performance.now() - startMs);
    return res;
  };

  const isPredefinedWorkflow = Boolean(DEFAULT_WORKFLOWS[currentWorkflow]);
  const currentWfDisplayName =
    currentProject?.workflowsData?.[currentWorkflow]?.name ||
    DEFAULT_WORKFLOWS[currentWorkflow]?.name ||
    currentWorkflow;
  const currentWfDescription =
    currentProject?.workflowsData?.[currentWorkflow]?.description ||
    DEFAULT_WORKFLOWS[currentWorkflow]?.description ||
    '';

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

      {/* Floating right-side approval bar for AI deletions */}
      <DeletionApprovalToast
        approval={pendingToolApproval}
        onDecision={(approved) => {
          if (pendingToolApproval?.resolve) {
            pendingToolApproval.resolve(approved);
          }
          setPendingToolApproval(null);
        }}
      />

      {/* Top Floating Navigation: Logo + Hamburger + Breadcrumb Nav Line */}
      <header className="top-nav-bar">
        <img
          src="/logo.jpg"
          alt="Trex"
          className="top-nav-logo"
        />
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
        engines={engines}
        enginesData={enginesData}
        workflows={currentProject?.workflows || {}}
        onExecuteTool={handleExecuteInvestigationTool}
        focusedNode={chatFocusNode}
        onClearFocusedNode={() => setChatFocusNode(null)}
        onWorkflowAssemblingChange={handleWorkflowAssemblingChange}
      />

      {/* Documents Page View, Tools Page View, Synthesis Page View, Logs Page View, Workflow Canvas View, or Exploration Canvas View */}
      {currentView === 'documents' ? (
        <DocumentsPage
          currentExploration={currentExploration}
          currentProject={currentProject}
          onBackToCanvas={() => setCurrentView('canvas')}
          onOpenDocument={async (doc) => {
            try {
              const proj = doc.projectId ? await getProject(doc.projectId) : currentProject;
              if (proj) {
                setCurrentProject(proj);
                const exps = proj.explorations && proj.explorations.length > 0
                  ? proj.explorations
                  : ['exploration_01'];
                setExplorations(exps);

                const expName = doc.explorationName || currentExploration || 'exploration_01';
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
          onAddDocumentToCanvas={async (doc) => {
            const expName = currentExploration || 'exploration_01';
            const shortHash = Math.random().toString(36).substring(2, 8);
            const nodeId = `node_doc_${shortHash}`;
            const targetX = 300;
            const targetY = 240;
            const newDocNode = {
              id: nodeId,
              node_id: nodeId,
              name: doc.name || doc.filename || 'Document',
              title: doc.name || doc.filename || 'Document',
              fileSize: doc.fileSize || doc.size_bytes || 0,
              type: 'document',
              node_type: 'document',
              category: 'resource',
              status: 'active',
              local_path: doc.local_path || doc.localPath || '',
              localPath: doc.local_path || doc.localPath || '',
              url: doc.url || '',
              mime_type: doc.mime_type || '',
              x: targetX,
              y: targetY,
              width: 280,
              height: 72,
              autoLayout: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            const expNodes = nodesRef.current || {};
            const nextNodes = layoutAutoNodes({ ...expNodes, [nodeId]: newDocNode }, connectionsRef.current);
            setNodes(nextNodes);
            nodesRef.current = nextNodes;
            persistProjectNodes(nextNodes, expName);
            setSelectedDocNode(newDocNode);
            setCurrentView('canvas');
          }}
        />
      ) : currentView === 'tools' ? (
        <ToolsPage />
      ) : currentView === 'logs' ? (
        <LogsPage workflowLogs={workflowLogs} toolLogs={toolLogs} />
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
            {/* Workflow Info & Details Button */}
            <button
              type="button"
              className="workflow-top-info-btn"
              onClick={() => setShowWorkflowInfoModal(true)}
              title={`View details, components, and statistics for "${currentWfDisplayName}"`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Details</span>
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

          {/* Minimalist one-line top loading indicator (no text, zero clutter) */}
          {isWorkflowAssembling && <div className="workflow-top-loading-line" />}

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
              if (!isThreadInViewport(startNode, endNode)) return null;
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
            {liveConnectingThread &&
              workflowNodes[liveConnectingThread.from] && (
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
              const isSelected =
                selectedWorkflowNodeId === node.id ||
                selectedAgentNodeId === node.id ||
                selectedEngineNodeId === node.id;
              if (!isSelected && !isNodeInViewport(node, node.width || 185, 56)) {
                return null;
              }
              const displayTitle =
                node.type === 'engine'
                  ? getEngineDisplayName(node.engineId, enginesData) || node.title
                  : node.title;
              const displaySub =
                node.type === 'engine'
                  ? getEngineDescription(node.engineId, enginesData) ||
                  node.description ||
                  node.sub ||
                  'Custom processing engine'
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
                  isSelected={
                    selectedWorkflowNodeId === node.id ||
                    selectedAgentNodeId === node.id ||
                    selectedEngineNodeId === node.id
                  }
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

          {/* Workflow Info & Metrics Modal */}
          <WorkflowInfoModal
            isOpen={showWorkflowInfoModal}
            workflowId={currentWorkflow}
            workflowName={currentWfDisplayName}
            workflowDescription={currentWfDescription}
            workflowNodes={workflowNodes}
            workflowThreads={workflowThreads}
            isPredefined={isPredefinedWorkflow}
            onClose={() => setShowWorkflowInfoModal(false)}
            onUpdateMetadata={(meta) => handleUpdateWorkflowMetadata(currentWorkflow, meta)}
            onDelete={() => {
              setShowWorkflowInfoModal(false);
              setShowWorkflowDeleteModal(true);
            }}
          />

          {/* Workflow Delete Confirmation Modal */}
          <WorkflowDeleteModal
            isOpen={showWorkflowDeleteModal}
            workflowName={currentWorkflow}
            displayName={currentWfDisplayName}
            onClose={() => setShowWorkflowDeleteModal(false)}
            onConfirm={() => {
              handleDeleteWorkflow(currentWorkflow);
              setShowWorkflowDeleteModal(false);
            }}
          />
        </>
      ) : (
        <>
          {/* Top-Right Exploration Cluster: Server Status Indicator + Minimap */}
          <div className="exploration-top-right-cluster">
            <ServerStatusIndicator />
            <Minimap
              nodes={nodes}
              camera={camera}
              viewportWidth={viewport.width}
              viewportHeight={viewport.height}
              onCameraChange={setCamera}
            />
          </div>

          {/* Workflows Button on Exploration Canvas */}
          {(() => {
            const eligibleCount = workflows.filter((wfId) => {
              const data = currentProject?.workflowsData?.[wfId];
              const inputNode =
                data?.nodes?.input ||
                Object.values(data?.nodes || {}).find((n) => n.type === 'input');
              const isManual = inputNode?.trigger === 'manual';
              if (!isManual) return false;
              const accepted = inputNode?.acceptedTypes || ['canvas_nodes', 'files'];
              return (
                accepted.includes('canvas_nodes') ||
                accepted.some((t) => ['canvas_nodes', 'findings', 'hypotheses', 'evidence'].includes(t))
              );
            }).length;

            return (
              <button
                type="button"
                className="exploration-workflows-btn"
                onClick={() => setShowManualWorkflowsModal(true)}
                title="Open manual workflows to run on canvas nodes"
              >

                <span>Workflows</span>
                {eligibleCount > 0 && (
                  <span className="wf-btn-count">{eligibleCount}</span>
                )}
              </button>
            );
          })()}

          {/* Manual Workflows Modal */}
          <ManualWorkflowsModal
            isOpen={showManualWorkflowsModal}
            onClose={() => {
              setShowManualWorkflowsModal(false);
              setIsDraggingWorkflow(false);
            }}
            workflows={workflows}
            workflowsData={currentProject?.workflowsData || {}}
            isDraggingWorkflow={isDraggingWorkflow}
            onStartDragWorkflow={(wf) => {
              draggingWorkflowRef.current = wf;
              setIsDraggingWorkflow(true);
            }}
            onEndDragWorkflow={() => {
              setIsDraggingWorkflow(false);
            }}
            onSelectWorkflow={(wf) => {
              setArmedWorkflow(wf);
              armedWorkflowRef.current = wf;
              setShowManualWorkflowsModal(false);
              setNotification(`Click any canvas node to run "${wf.workflowName || wf.name}"`);
            }}
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
            onDelete={handleRequestDeleteResource}
          />

          {/* Resource Node Delete Confirmation Modal */}
          <ResourceDeleteModal
            isOpen={showResourceDeleteModal}
            node={resourceNodeToDelete}
            onClose={() => {
              setShowResourceDeleteModal(false);
              setResourceNodeToDelete(null);
            }}
            onConfirm={() => {
              if (resourceNodeToDelete) {
                handleDeleteResourceNode(resourceNodeToDelete);
              }
              setShowResourceDeleteModal(false);
              setResourceNodeToDelete(null);
            }}
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
              let endNode = nodes[conn.target_node_id];
              if (!endNode && conn.kind === 'workflow_run' && (conn.endPosition || startNode)) {
                endNode = conn.endPosition || {
                  x: startNode.x + (startNode.width || 185) + 120,
                  y: startNode.y + 10,
                  width: 14,
                  height: 14,
                };
              }
              if (!startNode || !endNode) return null;
              if (!isThreadInViewport(startNode, endNode)) return null;
              return (
                <Thread
                  key={conn.id || conn.connection_id}
                  id={conn.id || conn.connection_id}
                  start={startNode}
                  end={endNode}
                  status={conn.status || 'active'}
                  kind={conn.kind || ''}
                  isRejected={conn.status === 'rejected' || (conn.kind === 'workflow_run' && conn.status === 'failed')}
                  isAnalyzing={conn.status === 'analyzing' || (conn.kind === 'workflow_run' && conn.status === 'running')}
                  isManual={Boolean(conn.is_manual || conn.source === 'manual')}
                  label={conn.label || (conn.kind === 'workflow_run' ? conn.workflowName : conn.relationship_type) || ''}
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
            {Object.values(nodes).map((node) => {
              const isSelected = selectedGroupNodeIds.has(node.id);
              if (!isSelected && !isNodeInViewport(node, node.width || 280, 72)) {
                return null;
              }
              return (
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
                  onDropWorkflow={handleWorkflowDropOnNode}
                  isWorkflowDragging={isDraggingWorkflow || Boolean(armedWorkflow)}
                />
              );
            })}
          </DotGridCanvas>

          {/* Exploration Thread Inspector Modal */}
          {(() => {
            const activeConn = selectedExplorationThreadId
              ? connections[selectedExplorationThreadId] ||
              Object.values(connections).find(
                (c) => c.id === selectedExplorationThreadId || c.connection_id === selectedExplorationThreadId
              )
              : null;
            if (!activeConn) return null;

            return (
              <ExplorationThreadModal
                isOpen={Boolean(activeConn)}
                thread={activeConn}
                sourceNode={activeConn ? nodes[activeConn.source_node_id] : null}
                targetNode={activeConn ? nodes[activeConn.target_node_id] : null}
                onClose={() => setSelectedExplorationThreadId(null)}
                onDelete={handleDeleteExplorationThread}
                onViewLogs={(thread) => {
                  const targetRun =
                    thread.runRecord ||
                    workflowLogs.find((r) => r.id === thread.runId);
                  if (targetRun) {
                    setActiveSimulationLogRun(targetRun);
                  }
                }}
              />
            );
          })()}

          {/* Workflow Log Simulation Inspector (When opened from thread modal) */}
          {activeSimulationLogRun && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2000,
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <WorkflowLogSimulation
                run={activeSimulationLogRun}
                onBack={() => setActiveSimulationLogRun(null)}
              />
            </div>
          )}
        </>
      )}

      {/* Manual Workflow Run Confirm Card */}
      {workflowDropConfirm && (
        <WorkflowRunConfirmCard
          workflow={workflowDropConfirm.workflow}
          node={workflowDropConfirm.node}
          position={workflowDropConfirm.position}
          onConfirm={() => {
            const { workflow, node } = workflowDropConfirm;
            setWorkflowDropConfirm(null);
            handleExecuteManualWorkflow(workflow, node);
          }}
          onCancel={() => setWorkflowDropConfirm(null)}
        />
      )}

      {/* Armed Workflow Banner */}
      {armedWorkflow && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#0f172a',
            color: '#ffffff',
            padding: '7px 16px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}
        >
          <span>Click any canvas node to run <strong>{armedWorkflow.workflowName || armedWorkflow.name}</strong></span>
          <button
            type="button"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
            onClick={() => {
              setArmedWorkflow(null);
              armedWorkflowRef.current = null;
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
