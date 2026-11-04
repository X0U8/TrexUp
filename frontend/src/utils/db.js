import { refreshSynthesisPrompts } from './workflowTemplates';
const DB_NAME = 'TrexUpDB';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const CHAT_STORE_NAME = 'global_chat';

// One shared connection for the whole app (opening a new one per call wastes connections).
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHAT_STORE_NAME)) {
        db.createObjectStore(CHAT_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

// Saves run one after another, so an older snapshot can never finish after a newer one.
let saveQueue = Promise.resolve();

/**
 * Saves a project. Resolves only when IndexedDB has committed the write, so a reload right after
 * a change does not lose it.
 */
export function saveProject(project) {
  const run = saveQueue.then(async () => {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(project);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('save aborted'));
    });
    return project;
  });
  saveQueue = run.catch(() => {});
  return run;
}

/**
 * Work that was in progress when the page was closed cannot resume, so mark it as interrupted
 * instead of leaving nodes spinning and runs marked as running forever.
 */
function recoverInterruptedState(project) {
  if (!project) return project;
  const fixNodes = (nodes = {}) => {
    const out = {};
    for (const [id, n] of Object.entries(nodes)) {
      const stuck = n?.extracting || n?.status === 'extracting' || n?.status === 'running';
      out[id] = stuck ? { ...n, extracting: false, status: 'interrupted' } : n;
    }
    return out;
  };
  const explorationsData = {};
  for (const [expId, exp] of Object.entries(project.explorationsData || {})) {
    const connections = {};
    for (const [cid, c] of Object.entries(exp?.connections || {})) {
      connections[cid] =
        c?.kind === 'workflow_run' && c.status === 'running' ? { ...c, status: 'interrupted' } : c;
    }
    explorationsData[expId] = { ...exp, nodes: fixNodes(exp?.nodes), connections };
  }
  const workflowLogs = (project.workflowLogs || []).map((r) =>
    r?.status === 'running' ? { ...r, status: 'interrupted' } : r
  );
  return {
    ...project,
    nodes: project.nodes ? fixNodes(project.nodes) : project.nodes,
    explorationsData: project.explorationsData ? explorationsData : project.explorationsData,
    workflowLogs,
  };
}

export async function getAllProjects() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const list = req.result || [];
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Fetch lightweight project metadata only (no heavy nodes, explorationsData, or workflowsData).
 * Prevents memory issues and crashes when projects contain large node trees.
 */
export async function getProjectsMetadata() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const list = [];

    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const val = cursor.value || {};
        list.push({
          id: val.id,
          name: val.name || 'Untitled project',
          goal: val.goal || '',
          createdAt: val.createdAt,
          updatedAt: val.updatedAt,
          pinned: Boolean(val.pinned),
        });
        cursor.continue();
      } else {
        list.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
        resolve(list);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Updates only specific metadata fields for a project without wiping or overwriting its nodes/data.
 */
export async function updateProjectMeta(id, metaUpdates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) {
        reject(new Error(`Project ${id} not found`));
        return;
      }
      const updated = {
        ...existing,
        ...metaUpdates,
        updatedAt: new Date().toISOString(),
      };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}


export async function getProject(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result ? recoverInterruptedState(refreshSynthesisPrompts(req.result)) : null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGlobalChat(chatData) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CHAT_STORE_NAME);
      const payload = {
        id: 'global_session',
        ...chatData,
        updatedAt: new Date().toISOString(),
      };
      const req = store.put(payload);

      req.onsuccess = () => resolve(payload);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save global chat to IndexedDB:', err);
    return null;
  }
}

export async function getGlobalChat() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHAT_STORE_NAME, 'readonly');
      const store = tx.objectStore(CHAT_STORE_NAME);
      const req = store.get('global_session');

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get global chat from IndexedDB:', err);
    return null;
  }
}

export async function clearGlobalChat() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CHAT_STORE_NAME);
      const req = store.delete('global_session');

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to clear global chat in IndexedDB:', err);
    return false;
  }
}

