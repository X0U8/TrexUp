import { useState, useEffect, useRef } from 'react';
import SERVER_PY_SOURCE from '../../../../agent/server.py?raw';
import '../Engines/EnginesPage.css';

export default function ServerStatusIndicator() {
  const [serverStatus, setServerStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [showServerTooltip, setShowServerTooltip] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [downloadedServer, setDownloadedServer] = useState(false);
  const [showServerSetupModal, setShowServerSetupModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('https://api.meta.ai/v1');
  const [copiedRunCmd, setCopiedRunCmd] = useState(false);

  const hoverTimeoutRef = useRef(null);

  // Check Python engine server health
  useEffect(() => {
    let isMounted = true;
    const checkServer = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8001/health', { method: 'GET' });
        if (res.ok && isMounted) {
          setServerStatus('online');
          return;
        }
      } catch (err) {
        // Server unreachable
      }
      if (isMounted) setServerStatus('offline');
    };

    checkServer();
    const interval = setInterval(checkServer, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (serverStatus !== 'online') {
      setShowServerTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowServerTooltip(false);
    }, 250);
  };

  const handleDownloadServer = (e) => {
    e.stopPropagation();
    setShowServerTooltip(false);
    setShowServerSetupModal(true);
  };

  const handleGenerateServer = (e) => {
    if (e) e.preventDefault();
    try {
      let rawKey = apiKeyInput.trim();
      if (rawKey.includes('MODEL_API_KEY=')) {
        const match = rawKey.match(/MODEL_API_KEY=([^\r\n]+)/);
        if (match) rawKey = match[1].trim();
      } else if (rawKey.includes('=')) {
        rawKey = rawKey.split('=').pop().trim();
      }

      const rawBaseUrl = baseUrlInput.trim() || 'https://api.meta.ai/v1';

      let customizedSource = SERVER_PY_SOURCE;
      if (rawKey) {
        customizedSource = customizedSource.replace(
          'DEFAULT_API_KEY = ""',
          `DEFAULT_API_KEY = ${JSON.stringify(rawKey)}`
        );
      }
      if (rawBaseUrl && rawBaseUrl !== 'https://api.meta.ai/v1') {
        customizedSource = customizedSource.replace(
          'DEFAULT_BASE_URL = "https://api.meta.ai/v1"',
          `DEFAULT_BASE_URL = ${JSON.stringify(rawBaseUrl)}`
        );
      }

      // Download single merged standalone server.py
      const sBlob = new Blob([customizedSource], { type: 'text/x-python;charset=utf-8' });
      const sUrl = URL.createObjectURL(sBlob);
      const sLink = document.createElement('a');
      sLink.href = sUrl;
      sLink.download = 'server.py';
      document.body.appendChild(sLink);
      sLink.click();
      document.body.removeChild(sLink);
      URL.revokeObjectURL(sUrl);

      setDownloadedServer(true);
      setTimeout(() => setDownloadedServer(false), 3000);
    } catch (err) {
      console.error('Failed to generate server.py:', err);
    }
  };

  return (
    <>
      <div
        className="engine-server-pill-wrap"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={`engine-server-pill ${serverStatus}`}
          onClick={() => setShowServerSetupModal(true)}
          title="Configure local Python server and environment (.env)"
        >
          <span className={`status-dot ${serverStatus === 'online' ? 'online' : 'offline'}`} />
          <span className="status-label">
            {serverStatus === 'online' ? 'Server: Online' : 'Server: Offline'}
          </span>
        </div>

        {/* Offline Helper Popover on Hover */}
        {serverStatus !== 'online' && showServerTooltip && (
          <div
            className="server-offline-popover"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="popover-header-row">
              <span className="popover-title">Start Python Server</span>
            </div>

            <div className="popover-section">
              <div className="popover-step-row">
                <span className="popover-step-index">1</span>
                <span className="popover-sub">Get configured server and environment:</span>
              </div>
              <button
                type="button"
                className="popover-download-btn"
                onClick={handleDownloadServer}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Configure server & .env</span>
              </button>
            </div>

            <div className="popover-section">
              <div className="popover-step-row">
                <span className="popover-step-index">2</span>
                <span className="popover-sub">Run in your terminal:</span>
              </div>
              <div className="popover-code-row">
                <code>python3 ~/Downloads/server.py</code>
                <button
                  type="button"
                  className="popover-copy-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText('python3 ~/Downloads/server.py');
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 1800);
                  }}
                >
                  {copiedCmd ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Server & Environment Setup Modal */}
      {showServerSetupModal && (
        <div
          className="engine-modal-overlay"
          onClick={() => setShowServerSetupModal(false)}
        >
          <div
            className="engine-modal-card engine-server-setup-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="engine-server-setup-header">
              <div className="engine-server-setup-title-row">
                <h4 className="engine-modal-title">Python Server & Environment Setup</h4>
                <button
                  type="button"
                  className="engine-server-setup-close"
                  onClick={() => setShowServerSetupModal(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <p className="engine-modal-desc">
                Paste your Meta API key to download a self-contained server.py file.
              </p>
            </div>

            <div className="engine-server-live-status">
              <span className={`status-dot ${serverStatus === 'online' ? 'online' : 'offline'}`} />
              <span className="engine-server-status-text">
                {serverStatus === 'online'
                  ? 'Server is running on http://127.0.0.1:8001'
                  : 'Server is offline (127.0.0.1:8001)'}
              </span>
            </div>

            <form onSubmit={handleGenerateServer} className="engine-server-setup-form">
              <div className="engine-server-field-group">
                <label htmlFor="server-api-key-input" className="engine-server-label">
                  Meta API Key
                </label>
                <input
                  id="server-api-key-input"
                  type="text"
                  className="engine-server-key-input"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste your key (e.g. LLM_...)"
                  autoFocus
                  spellCheck={false}
                />
              </div>

              <div className="engine-server-field-group">
                <label htmlFor="server-base-url-input" className="engine-server-label">
                  Base URL
                </label>
                <input
                  id="server-base-url-input"
                  type="text"
                  className="engine-server-readonly-input"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder="https://api.meta.ai/v1"
                />
              </div>

              <div className="engine-server-run-instructions">
                <span className="engine-server-inst-label">Terminal command to run:</span>
                <div className="engine-server-cmd-box">
                  <code>python3 server.py</code>
                  <button
                    type="button"
                    className="engine-server-copy-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText('python3 server.py');
                      setCopiedRunCmd(true);
                      setTimeout(() => setCopiedRunCmd(false), 2000);
                    }}
                  >
                    {copiedRunCmd ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="engine-modal-actions">
                <button
                  type="button"
                  className="engine-modal-btn-cancel"
                  onClick={() => setShowServerSetupModal(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className={`engine-server-btn-download ${downloadedServer ? 'downloaded' : ''}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>{downloadedServer ? 'Downloaded server.py' : 'Download server.py'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
