import { useState, useRef, useEffect } from 'react';
import './UploadModal.css';

export default function UploadModal({ isOpen, onClose, onFileUpload }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onFileUpload?.(selectedFile);
    }
    onClose();
  };

  return (
    <div
      className="upload-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="upload-box">
        <div className="upload-header">
          <span>Upload</span>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          className="upload-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div className="dropzone-text">
            {selectedFile ? selectedFile.name : 'Choose file or drop here'}
          </div>
        </div>

        <div className="upload-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleUpload}
            disabled={!selectedFile}
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
