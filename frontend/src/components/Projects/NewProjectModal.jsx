import { useState, useEffect, useRef } from 'react';
import './NewProjectModal.css';
import { saveProject } from '../../utils/db';
import { DEFAULT_EXTRACTION_WORKFLOW, DEFAULT_CONNECTION_WORKFLOW } from '../../utils/workflowTemplates';

export default function NewProjectModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setGoal('');
      setIsSaving(false);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isSaving) return;

    setIsSaving(true);
    const newProject = {
      id: `proj-${Date.now()}`,
      name: trimmedName,
      goal: goal.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: {},
      explorations: ['exploration_01'],
      currentExploration: 'exploration_01',
      workflows: ['extraction', 'connection_synthesis'],
      currentWorkflow: 'extraction',
      workflowsData: {
        extraction: DEFAULT_EXTRACTION_WORKFLOW,
        connection_synthesis: DEFAULT_CONNECTION_WORKFLOW,
      },
      engines: ['resource_bridge', 'file_detection', 'document_extractor', 'node_context_builder'],
      currentEngine: 'file_detection',
    };

    try {
      await saveProject(newProject);
      onCreated?.(newProject);
      onClose();
    } catch (err) {
      console.error('Failed to save project:', err);
      setIsSaving(false);
    }
  };

  return (
    <div
      className="new-proj-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-modal="true"
      role="dialog"
    >
      <div className="new-proj-modal">
        <div className="new-proj-header">
          <span className="new-proj-title">New project</span>
          <button
            type="button"
            className="new-proj-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="new-proj-form">
          {/* Project Name (max 50 chars) */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="proj-name">Project name</label>
              <span className="form-char-count">{name.length}/50</span>
            </div>
            <input
              id="proj-name"
              ref={nameInputRef}
              type="text"
              className="form-input"
              placeholder="Project name"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Goal / What it is trying to achieve (max 200 chars, optional) */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="proj-goal">
                What are you trying to achieve?{' '}
                <span className="form-optional-tag">(optional)</span>
              </label>
              <span className="form-char-count">{goal.length}/200</span>
            </div>
            <textarea
              id="proj-goal"
              className="form-textarea"
              placeholder="What are you working on?"
              maxLength={200}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <div className="new-proj-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create"
              disabled={!name.trim() || isSaving}
            >
              {isSaving ? 'Creating...' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
