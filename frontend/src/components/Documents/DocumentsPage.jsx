import { useState, useEffect } from 'react';
import { getAllProjects } from '../../utils/db';
import './DocumentsPage.css';

export default function DocumentsPage({ onOpenDocument }) {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    async function loadDocs() {
      try {
        const projects = await getAllProjects();
        const allDocs = [];

        const isDocNode = (node) =>
          Boolean(
            node &&
              (node.category === 'resource' ||
                node.type === 'document' ||
                node.node_type === 'document' ||
                (typeof node.fileSize === 'number' && node.fileSize > 0) ||
                (typeof node.file_size === 'number' && node.file_size > 0) ||
                Boolean(node.cloudinaryUrl))
          );

        projects.forEach((proj) => {
          if (proj.explorationsData) {
            Object.entries(proj.explorationsData).forEach(([expName, expData]) => {
              if (expData?.nodes) {
                Object.values(expData.nodes).forEach((node) => {
                  if (isDocNode(node)) {
                    allDocs.push({
                      ...node,
                      projectId: proj.id,
                      projectName: proj.name,
                      explorationName: expName,
                    });
                  }
                });
              }
            });
          } else if (proj.nodes) {
            Object.values(proj.nodes).forEach((node) => {
              if (isDocNode(node)) {
                allDocs.push({
                  ...node,
                  projectId: proj.id,
                  projectName: proj.name,
                  explorationName: 'exploration_01',
                });
              }
            });
          }
        });

        setDocuments(allDocs);
      } catch (err) {
        console.error('Failed to load documents:', err);
      }
    }

    loadDocs();
  }, []);

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="documents-container">
      <div className="documents-list-box">
        {documents.length === 0 ? (
          <div className="documents-empty">
            <p>No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="documents-table">
            <div className="documents-table-head">
              <span className="th-name">Document Name</span>
              <span className="th-id">Document ID</span>
              <span className="th-size">Size</span>
              <span className="th-status">Status</span>
            </div>

            <div className="documents-table-body">
              {documents.map((doc) => (
                <div
                  key={`${doc.projectId}-${doc.id}`}
                  className="documents-table-row"
                  onClick={() => onOpenDocument?.(doc)}
                  title="Click to view in canvas"
                >
                  <div className="td-name">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>{doc.name || 'Untitled Document'}</span>
                  </div>

                  <span className="td-id">{doc.id}</span>
                  <span className="td-size">{formatSize(doc.fileSize)}</span>
                  <span className="td-status" title={doc.local_path ? `Local path: ${doc.local_path}` : ''}>
                    {doc.uploading ? 'uploading...' : (doc.local_path ? 'cached' : (doc.status || 'not checked'))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
