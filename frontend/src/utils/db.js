const DB_NAME = 'TrexUpDB';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const CHAT_STORE_NAME = 'global_chat';

function openDB() {
  return new Promise((resolve, reject) => {
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

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProject(project) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(project);

    req.onsuccess = () => resolve(project);
    req.onerror = () => reject(req.error);
  });
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

    req.onsuccess = () => resolve(req.result || null);
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

