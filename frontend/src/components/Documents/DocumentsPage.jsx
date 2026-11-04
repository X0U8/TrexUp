import { useState, useEffect, useMemo } from 'react';
import { getAllProjects } from '../../utils/db';
import './DocumentsPage.css';

const SERVER_BASE = 'http://127.0.0.1:8001';
const TEXT_EXTS = ['txt', 'md', 'csv', 'tsv', 'json', 'log', 'py', 'js', 'html', 'css', 'xml', 'yaml', 'yml'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov'];

function getFileExtension(filename = '') {
  const clean = filename.split(/[\\/]/).pop() || '';
  if (!clean.includes('.')) return '';
  return clean.split('.').pop().toLowerCase();
}

function getFileTypeCategory(ext = '') {
  if (ext === 'pdf') return 'pdf';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (TEXT_EXTS.includes(ext)) return 'text';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  return 'other';
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [textContent, setTextContent] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadAllDocuments = async () => {
    setIsLoading(true);
    try {
      const mergedMap = new Map();

      // 1. Fetch documents from IndexedDB
      const projects = await getAllProjects();
      const isDocNode = (node) =>
        Boolean(
          node &&
            (node.category === 'resource' ||
              node.type === 'document' ||
              node.node_type === 'document' ||
              (typeof node.fileSize === 'number' && node.fileSize > 0) ||
              (typeof node.file_size === 'number' && node.file_size > 0) ||
              Boolean(node.cloudinaryUrl) ||
              Boolean(node.local_path))
        );

      projects.forEach((proj) => {
        if (proj.explorationsData) {
          Object.entries(proj.explorationsData).forEach(([expName, expData]) => {
            if (expData?.nodes) {
              Object.values(expData.nodes).forEach((node) => {
                if (isDocNode(node)) {
                  const fname = node.name || node.title || node.filename || 'Untitled document';
                  const key = node.local_path || `${proj.id}-${node.id}`;
                  mergedMap.set(key, {
                    ...node,
                    key,
                    name: fname,
                    filename: fname,
                    fileSize: node.fileSize || node.file_size || 0,
                    size_bytes: node.fileSize || node.file_size || 0,
                    projectId: proj.id,
                    projectName: proj.name,
                    explorationName: expName,
                    source: 'canvas',
                  });
                }
              });
            }
          });
        }
      });

      // 2. Fetch documents from server storage
      try {
        const res = await fetch(`${SERVER_BASE}/api/documents`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && Array.isArray(data.documents)) {
            data.documents.forEach((serverDoc) => {
              const localPath = serverDoc.local_path;
              const existing = Array.from(mergedMap.values()).find(
                (d) => d.local_path === localPath || d.filename === serverDoc.filename
              );

              if (existing) {
                existing.serverSynced = true;
                existing.url = serverDoc.url || existing.url;
                existing.size_bytes = serverDoc.size_bytes || existing.size_bytes || existing.fileSize;
                existing.fileSize = existing.size_bytes;
                existing.mime_type = serverDoc.mime_type || existing.mime_type;
                existing.modified_at = serverDoc.modified_at;
              } else {
                mergedMap.set(localPath || serverDoc.filename, {
                  id: `storage_${serverDoc.filename}`,
                  name: serverDoc.filename,
                  filename: serverDoc.filename,
                  title: serverDoc.filename,
                  local_path: serverDoc.local_path,
                  url: serverDoc.url,
                  fileSize: serverDoc.size_bytes,
                  size_bytes: serverDoc.size_bytes,
                  mime_type: serverDoc.mime_type,
                  modified_at: serverDoc.modified_at,
                  source: 'storage',
                  serverSynced: true,
                });
              }
            });
          }
        }
      } catch {
        // server offline fallback
      }

      const docsList = Array.from(mergedMap.values());
      docsList.sort((a, b) => ((b.modified_at || b.updatedAt || 0) > (a.modified_at || a.updatedAt || 0) ? 1 : -1));

      setDocuments(docsList);
      if (!selectedDoc && docsList.length > 0) {
        setSelectedDoc(docsList[0]);
      } else if (selectedDoc) {
        const refreshed = docsList.find((d) => d.name === selectedDoc.name || d.id === selectedDoc.id);
        if (refreshed) setSelectedDoc(refreshed);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllDocuments();
  }, []);

  const previewUrl = useMemo(() => {
    if (!selectedDoc) return '';
    if (selectedDoc.url && selectedDoc.url.startsWith('http')) {
      return selectedDoc.url;
    }
    if (selectedDoc.local_path) {
      const base = selectedDoc.local_path.split(/[\\/]/).pop();
      return `${SERVER_BASE}/storage/documents/${encodeURIComponent(base)}`;
    }
    return selectedDoc.localBlobUrl || selectedDoc.cloudinaryUrl || '';
  }, [selectedDoc]);

  const selectedExt = useMemo(() => {
    return getFileExtension(selectedDoc?.filename || selectedDoc?.name || '');
  }, [selectedDoc]);

  const selectedCategory = useMemo(() => {
    return getFileTypeCategory(selectedExt);
  }, [selectedExt]);

  useEffect(() => {
    if (!selectedDoc || selectedCategory !== 'text' || !previewUrl) {
      setTextContent('');
      setTextError(false);
      return;
    }

    let isMounted = true;
    setTextLoading(true);
    setTextError(false);

    fetch(previewUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((data) => {
        if (isMounted) setTextContent(data);
      })
      .catch(() => {
        if (isMounted) setTextError(true);
      })
      .finally(() => {
        if (isMounted) setTextLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDoc, previewUrl, selectedCategory]);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const name = (doc.name || doc.filename || '').toLowerCase();
      const ext = getFileExtension(name);
      const cat = getFileTypeCategory(ext);

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!name.includes(q)) return false;
      }

      if (activeFilter === 'pdf') return cat === 'pdf';
      if (activeFilter === 'image') return cat === 'image';
      if (activeFilter === 'text') return cat === 'text';

      return true;
    });
  }, [documents, searchQuery, activeFilter]);

  const handleCopyLink = () => {
    if (!previewUrl) return;
    navigator.clipboard.writeText(previewUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div className="doc-page-container">
      {/* Clean Minimal Header */}
      <header className="doc-page-header">
        <div className="doc-header-left">
          <h1 className="doc-page-heading">Documents</h1>
          <span className="doc-count-tag">{documents.length}</span>
        </div>

        <div className="doc-header-right">
          <button
            type="button"
            className="doc-btn-icon"
            onClick={loadAllDocuments}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Two Column Workspace */}
      <div className="doc-workspace">
        {/* Left Side: Document List */}
        <aside className="doc-list-panel">
          <div className="doc-search-wrapper">
            <input
              type="text"
              placeholder="Filter documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="doc-search-input"
            />
          </div>

          <div className="doc-filter-tabs">
            {[
              { id: 'all', label: 'All' },
              { id: 'pdf', label: 'PDF' },
              { id: 'image', label: 'Images' },
              { id: 'text', label: 'Text' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`doc-filter-tab ${activeFilter === tab.id ? 'active' : ''}`}
                onClick={() => setActiveFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="doc-scroll-list">
            {isLoading ? (
              <div className="doc-empty-hint">Loading...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="doc-empty-hint">No documents found</div>
            ) : (
              filteredDocs.map((doc) => {
                const ext = getFileExtension(doc.name || doc.filename || '');
                const isSelected = selectedDoc && (selectedDoc.name === doc.name || selectedDoc.id === doc.id);

                return (
                  <div
                    key={doc.key || doc.id || doc.name}
                    className={`doc-row-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <svg className="doc-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>

                    <div className="doc-row-details">
                      <span className="doc-row-name" title={doc.name}>
                        {doc.name}
                      </span>
                      <div className="doc-row-sub">
                        <span>{ext || 'file'}</span>
                        <span className="doc-row-dot">·</span>
                        <span>{formatBytes(doc.fileSize || doc.size_bytes)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Side: Preview & Details */}
        <main className="doc-preview-panel">
          {selectedDoc ? (
            <div className="doc-preview-content">
              {/* Preview Bar */}
              <div className="doc-preview-top">
                <div className="doc-preview-meta">
                  <h2 className="doc-preview-name">{selectedDoc.name}</h2>
                  <div className="doc-meta-subline">
                    <span>{formatBytes(selectedDoc.fileSize || selectedDoc.size_bytes)}</span>
                    <span className="doc-meta-dot">·</span>
                    <span>{selectedExt || 'file'}</span>
                  </div>
                </div>

                <div className="doc-actions-group">
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      download={selectedDoc.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="doc-btn-action"
                    >
                      Download
                    </a>
                  )}

                  {previewUrl && (
                    <button
                      type="button"
                      className="doc-btn-action"
                      onClick={handleCopyLink}
                    >
                      {copiedLink ? 'Copied' : 'Copy link'}
                    </button>
                  )}
                </div>
              </div>

              {/* Viewer Area */}
              <div className="doc-preview-view">
                {selectedCategory === 'pdf' && previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title={selectedDoc.name}
                    className="doc-frame-pdf"
                  />
                ) : selectedCategory === 'image' && previewUrl ? (
                  <div className="doc-image-wrap">
                    <img
                      src={previewUrl}
                      alt={selectedDoc.name}
                      className="doc-img-view"
                    />
                  </div>
                ) : selectedCategory === 'text' ? (
                  <div className="doc-text-wrap">
                    {textLoading ? (
                      <div className="doc-status-text">Loading...</div>
                    ) : textError ? (
                      <div className="doc-status-text">
                        Could not display preview.{' '}
                        {previewUrl && (
                          <a href={previewUrl} target="_blank" rel="noreferrer">
                            Open raw file
                          </a>
                        )}
                      </div>
                    ) : (
                      <pre className="doc-code-text">{textContent || 'Empty document'}</pre>
                    )}
                  </div>
                ) : (
                  <div className="doc-fallback-view">
                    <p>Preview not available for this format.</p>
                    {previewUrl && (
                      <a href={previewUrl} download={selectedDoc.name} className="doc-btn-action">
                        Download file
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Minimal Footer */}
              <div className="doc-preview-bottom">
                <div className="doc-foot-item">
                  <span className="doc-foot-label">Path:</span>
                  <span className="doc-foot-value" title={selectedDoc.local_path || ''}>
                    {selectedDoc.local_path || 'Browser memory'}
                  </span>
                </div>
                {selectedDoc.metadata?.original_url && (
                  <div className="doc-foot-item">
                    <span className="doc-foot-label">Source:</span>
                    <a
                      href={selectedDoc.metadata.original_url}
                      target="_blank"
                      rel="noreferrer"
                      className="doc-foot-link"
                    >
                      {selectedDoc.metadata.original_url}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="doc-no-selection">
              <p>Select a document to inspect</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
