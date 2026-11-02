import { useState, useRef, useEffect, useMemo } from 'react';
import './EnginesPage.css';

const DEFAULT_ENGINES = {
  file_detection: {
    id: 'file_detection',
    name: 'File Detection Engine',
    code: `# File Detection Engine
# Pure function entry: def run(input_data, context=None) -> dict

import os
import base64
import mimetypes

MAGIC_SIGNATURES = [
    (b'%PDF', 'pdf', 'document'),
    (b'\\x89PNG\\r\\n\\x1a\\n', 'png', 'image'),
    (b'\\xff\\xd8\\xff', 'jpeg', 'image'),
    (b'GIF87a', 'gif', 'image'),
    (b'GIF89a', 'gif', 'image'),
    (b'RIFF', 'wav', 'audio'),
    (b'ID3', 'mp3', 'audio'),
    (b'\\xff\\xfb', 'mp3', 'audio'),
    (b'PK\\x03\\x04', 'zip', 'archive'),
]

MAX_FILE_SIZE_MB = 50.0

def run(input_data, context=None):
    if isinstance(input_data, dict) and ('file_name' in input_data or 'name' in input_data):
        file_name = input_data.get('file_name') or input_data.get('name', 'unnamed')
        size_bytes = input_data.get('size_bytes', 0)
        size_mb = size_bytes / (1024 * 1024) if size_bytes else 0.0

        if size_mb > MAX_FILE_SIZE_MB:
            return {
                "status": "rejected",
                "valid": False,
                "reason": f"File exceeds maximum limit of {MAX_FILE_SIZE_MB}MB",
                "file_name": file_name,
                "size_mb": round(size_mb, 2)
            }

        # 1. Read real binary magic bytes from the header
        raw_header = b""
        b64_data = input_data.get("file_bytes_b64")
        if b64_data:
            try:
                raw_header = base64.b64decode(b64_data)
            except Exception:
                pass

        real_format = None
        real_category = None
        for sig, fmt, cat in MAGIC_SIGNATURES:
            if raw_header.startswith(sig) or (sig == b'RIFF' and sig in raw_header[:12]):
                real_format = fmt
                real_category = cat
                break

        # 2. Check declared filename extension
        ext = os.path.splitext(file_name)[1].lower().lstrip('.')
        claimed_format = ext or 'unknown'

        # 3. Detect mismatched or renamed extensions (e.g. PDF renamed to .jpg)
        if real_format:
            compat = {
                'jpeg': ['jpg', 'jpeg'],
                'jpg': ['jpg', 'jpeg'],
                'pdf': ['pdf'],
                'png': ['png'],
                'wav': ['wav'],
                'mp3': ['mp3'],
                'gif': ['gif'],
            }
            allowed_exts = compat.get(real_format, [real_format])
            if claimed_format not in allowed_exts:
                return {
                    "status": "mismatch_detected",
                    "valid": False,
                    "reason": f"Header indicates real format is {real_format.upper()}, but filename claimed .{claimed_format}",
                    "file_name": file_name,
                    "real_format": real_format,
                    "claimed_format": claimed_format,
                    "category": real_category,
                    "size_mb": round(size_mb, 2)
                }

        detected_category = real_category or ('image' if ext in ['png', 'jpg', 'jpeg', 'webp'] else 'audio' if ext in ['mp3', 'wav'] else 'document')
        detected_format = real_format or claimed_format
        mime_guess, _ = mimetypes.guess_type(file_name)

        return {
            "status": "verified",
            "valid": True,
            "file_name": file_name,
            "category": detected_category,
            "format": detected_format,
            "mime_type": mime_guess or f"application/{detected_format}",
            "size_mb": round(size_mb, 2),
            "binary_verified": bool(real_format)
        }

    return {
        "status": "verified",
        "valid": True,
        "input_type": "text",
        "content": str(input_data)[:200]
    }
`,
  },
};

const getEngineInitialCode = (engineId, enginesData) => {
  if (enginesData?.[engineId]?.code) {
    if (engineId === 'file_detection' && !enginesData[engineId].code.includes('file_bytes_b64')) {
      return DEFAULT_ENGINES.file_detection.code;
    }
    return enginesData[engineId].code;
  }
  if (engineId === 'file_detection') {
    return DEFAULT_ENGINES.file_detection.code;
  }
  return `# ${engineId}
# Pure function entry: def run(input_data, context=None) -> dict

def run(input_data, context=None):
    """
    ${engineId} processing logic.
    """
    return {
        "status": "success",
        "engine": "${engineId}",
        "output": input_data
    }
`;
};

// Static inspection of Python code without executing it
function inspectPythonEngine(code = '') {
  // 1. Dependency detection
  const importLines = code.match(/^(?:from\s+([a-zA-Z0-9_]+)|import\s+([a-zA-Z0-9_]+))/gm) || [];
  const dependencies = [];
  for (const line of importLines) {
    const m = line.match(/(?:from|import)\s+([a-zA-Z0-9_]+)/);
    if (m && m[1] && !dependencies.includes(m[1])) {
      dependencies.push(m[1]);
    }
  }

  // 2. Type Hint detection
  const typeHintMatch = code.match(/def\s+run\s*\(\s*input_data\s*:\s*([^,\)=]+)/);
  const typeHint = typeHintMatch ? typeHintMatch[1].trim().toLowerCase() : '';

  // Extract input processing logic (exclude return statements so return types aren't confused with input types)
  const runFuncMatch = code.match(/def\s+run\s*\([^)]*\):([\s\S]*)/);
  const runBody = runFuncMatch ? runFuncMatch[1].split(/\n\s*return\b/)[0] : code;
  const lowerBody = runBody.toLowerCase();

  // 3. Static usage heuristics on input_data
  const textMatches = [
    'input_data.get("text"',
    "input_data.get('text'",
    'input_data.get("prompt"',
    "input_data.get('prompt'",
    'input_data.get("content"',
    "input_data.get('content'",
    'input_data.get("query"',
    "input_data.get('query'",
    'isinstance(input_data, str)',
    'str(input_data)',
    'input_data.split',
    'input_data.lower',
    'input_data.strip',
  ];

  const fileMatches = [
    'input_data.get("file"',
    "input_data.get('file'",
    'input_data.get("file_name"',
    "input_data.get('file_name'",
    'input_data.get("file_bytes"',
    "input_data.get('file_bytes'",
    'file_bytes',
    'header_bytes',
    'magic_signatures',
    'mimetypes.guess_type',
  ];

  let inferredInput = 'json';
  if (typeHint.includes('str') || typeHint.includes('text')) {
    inferredInput = 'text';
  } else if (textMatches.some((kw) => lowerBody.includes(kw))) {
    inferredInput = 'text';
  } else if (fileMatches.some((kw) => lowerBody.includes(kw))) {
    inferredInput = 'file';
  } else if (lowerBody.includes('json.loads') || lowerBody.includes('input_data.get(')) {
    inferredInput = 'json';
  }

  // 4. Output modality inference
  let inferredOutput = 'json';
  const returnMatch = code.match(/return\s+([\s\S]*)/);
  const returnSnippet = returnMatch ? returnMatch[1].toLowerCase() : lowerBody;

  if (
    returnSnippet.includes('"type": "file"') ||
    returnSnippet.includes("'type': 'file'") ||
    returnSnippet.includes('"type":"file"') ||
    returnSnippet.includes("'type':'file'")
  ) {
    inferredOutput = 'file';
  } else if (
    (returnSnippet.includes('str(') || returnSnippet.includes('f"') || returnSnippet.includes("f'")) &&
    !returnSnippet.includes('{') &&
    !returnSnippet.includes('dict') &&
    !returnSnippet.includes('status')
  ) {
    inferredOutput = 'text';
  } else {
    inferredOutput = 'json';
  }

  return {
    inferredInput, // 'file' | 'text' | 'json'
    inferredOutput, // 'file' | 'text' | 'json'
    dependencies,
  };
}

function renderModalityIcon(type, titlePrefix = '') {
  switch (type) {
    case 'text':
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}Text`}
        >
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      );
    case 'file':
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}File`}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'code':
    case 'json':
    default:
      return (
        <svg
          key={type}
          className="engine-mod-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          title={`${titlePrefix}JSON / Data`}
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
  }
}

const SERVER_PY_TEMPLATE = `#!/usr/bin/env python3
import sys
import os
import json
import time
import base64
import mimetypes
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler

HOST = "127.0.0.1"
PORT = 8001


class EngineRequestHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def do_OPTIONS(self):
        self._set_cors_headers(200)

    def do_GET(self):
        if self.path in ["/health", "/api/health", "/"]:
            self._set_cors_headers(200)
            response = {
                "status": "online",
                "service": "trex-engine-runner",
                "version": "1.0.0",
                "python_version": sys.version.split()[0],
                "host": f"{HOST}:{PORT}",
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
        else:
            self._set_cors_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

    def do_POST(self):
        if self.path == "/api/engines/run":
            start_time = time.perf_counter()
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length)

                data = json.loads(body_bytes.decode("utf-8"))
                code = data.get("code", "")
                input_data = data.get("input_data", {})

                if isinstance(input_data, dict) and "file_bytes_b64" in input_data:
                    raw_b64 = input_data["file_bytes_b64"]
                    try:
                        header_bytes = base64.b64decode(raw_b64[:128])
                        input_data["header_bytes"] = header_bytes
                    except Exception:
                        pass

                exec_scope = {
                    "__name__": "__main__",
                    "os": os,
                    "sys": sys,
                    "json": json,
                    "mimetypes": mimetypes,
                }

                exec(code, exec_scope)

                if "run" not in exec_scope or not callable(exec_scope["run"]):
                    raise ValueError("The engine script must define an entry function: def run(input_data, context=None)")

                output = exec_scope["run"](input_data)
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

                self._set_cors_headers(200)
                res = {
                    "status": "success",
                    "output": output,
                    "duration_ms": duration_ms,
                    "server": "local-python",
                }
                self.wfile.write(json.dumps(res).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Executed engine ({duration_ms}ms)")

            except Exception as e:
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                err_trace = traceback.format_exc()
                print(f"[{time.strftime('%X')}] Engine error: {str(e)}")
                self._set_cors_headers(200)
                res = {
                    "status": "error",
                    "error": str(e),
                    "traceback": err_trace,
                    "duration_ms": duration_ms,
                }
                self.wfile.write(json.dumps(res).encode("utf-8"))
        else:
            self._set_cors_headers(404)
            self.wfile.write(json.dumps({"error": "Unknown POST route"}).encode("utf-8"))

    def log_message(self, format, *args):
        pass


def run_server():
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, EngineRequestHandler)
    print(f"Trex Engine Server running on http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.server_close()


if __name__ == "__main__":
    run_server()
`;

export default function EnginesPage({
  engines = ['file_detection'],
  currentEngine = 'file_detection',
  enginesData = {},
  onSelectEngine,
  onUpdateEngineCode,
}) {
  const activeEngineId = currentEngine || 'file_detection';
  const [editorCode, setEditorCode] = useState(() =>
    getEngineInitialCode(activeEngineId, enginesData)
  );

  const [uploadedFile, setUploadedFile] = useState(null);
  const [rawTextInput, setRawTextInput] = useState('Sample research text for extraction analysis.');
  const [rawJsonInput, setRawJsonInput] = useState('{\\n  "query": "analyze findings",\\n  "threshold": 0.8\\n}');
  const [simOutput, setSimOutput] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [showServerTooltip, setShowServerTooltip] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [downloadedServer, setDownloadedServer] = useState(false);

  const fileInputRef = useRef(null);

  // Statically inspect the current Python code
  const inspection = useMemo(() => inspectPythonEngine(editorCode), [editorCode]);
  const effectiveInputType = inspection.inferredInput;

  // Detect if engine returned a file object
  const fileOutput = useMemo(() => {
    if (!simOutput || typeof simOutput !== 'object') return null;
    const target =
      simOutput.output && typeof simOutput.output === 'object' && simOutput.output.type === 'file'
        ? simOutput.output
        : simOutput.type === 'file'
        ? simOutput
        : null;

    if (target && (target.filename || target.file_name)) {
      return {
        filename: target.filename || target.file_name || 'output_file',
        mimeType: target.mime_type || target.mimeType || 'text/plain',
        content: target.content ?? target.text ?? target.file_bytes_b64 ?? '',
        isBase64: Boolean(target.file_bytes_b64),
      };
    }
    return null;
  }, [simOutput]);

  const handleDownloadOutputFile = () => {
    if (!fileOutput) return;
    try {
      let blob;
      if (fileOutput.isBase64) {
        const byteCharacters = atob(fileOutput.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: fileOutput.mimeType });
      } else {
        blob = new Blob([fileOutput.content], { type: fileOutput.mimeType });
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileOutput.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download output file:', err);
    }
  };

  const handleDownloadServer = (e) => {
    e.stopPropagation();
    try {
      const blob = new Blob([SERVER_PY_TEMPLATE], { type: 'text/x-python;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'server.py';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadedServer(true);
      setTimeout(() => setDownloadedServer(false), 2500);
    } catch (err) {
      console.error('Failed to download server.py:', err);
    }
  };

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

  // Sync editor when active engine changes
  useEffect(() => {
    const code = getEngineInitialCode(activeEngineId, enginesData);
    setEditorCode(code);
    setSimOutput(null);
    if (activeEngineId === 'file_detection' && enginesData?.['file_detection']?.code !== code) {
      onUpdateEngineCode?.('file_detection', code);
    }
  }, [activeEngineId, enginesData]);

  const handleCodeChange = (e) => {
    const val = e.target.value;
    setEditorCode(val);
    onUpdateEngineCode?.(activeEngineId, val);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setSimOutput(null);
  };

  const runSimulation = async () => {
    setIsSimulating(true);

    // Prepare payload based on effective input type
    let inputPayload = null;

    if (effectiveInputType === 'file') {
      if (!uploadedFile) {
        setSimOutput({
          error: 'No file selected. Please click or drop a file above to test.',
        });
        setIsSimulating(false);
        return;
      }

      inputPayload = {
        file_name: uploadedFile.name,
        name: uploadedFile.name,
        size_bytes: uploadedFile.size,
        mime_type: uploadedFile.type || 'application/octet-stream',
      };

      try {
        const slice = uploadedFile.slice(0, 64);
        const buf = await slice.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binaryStr = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binaryStr += String.fromCharCode(bytes[i]);
        }
        inputPayload.file_bytes_b64 = btoa(binaryStr);
      } catch (err) {
        console.warn('Could not read binary slice:', err);
      }
    } else if (effectiveInputType === 'text') {
      inputPayload = {
        text: rawTextInput,
        content: rawTextInput,
      };
    } else {
      try {
        inputPayload = JSON.parse(rawJsonInput);
      } catch {
        inputPayload = { raw: rawJsonInput };
      }
    }

    // Execute via local Python server
    try {
      const res = await fetch('http://127.0.0.1:8001/api/engines/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editorCode,
          input_data: inputPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          setSimOutput(data.output);
          setServerStatus('online');
        } else if (data.status === 'error') {
          setSimOutput({ error: data.error, traceback: data.traceback });
        }
      } else {
        setSimOutput({
          status: 'error',
          error: `Server returned HTTP ${res.status}`,
        });
      }
    } catch {
      setServerStatus('offline');
      setSimOutput({
        status: 'error',
        error: 'Python server is offline. Please start the server to execute engine code.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const hoverTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setShowServerTooltip(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowServerTooltip(false);
    }, 250);
  };

  return (
    <div className="engines-page-container">
      {/* Top Bar - Clean and minimal */}
      <div className="engines-top-bar">
        {/* Left side empty for fixed top breadcrumbs capsule */}
        <div />

        {/* Right side: Server status pill + Save button */}
        <div className="engines-top-right">
          <div
            className="engine-server-pill-wrap"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div
              className={`engine-server-pill ${serverStatus}`}
              onClick={() => setShowServerTooltip((prev) => !prev)}
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
                    <span className="popover-sub">Get standalone server file:</span>
                  </div>
                  <button
                    type="button"
                    className={`popover-download-btn ${downloadedServer ? 'downloaded' : ''}`}
                    onClick={handleDownloadServer}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>{downloadedServer ? 'Downloaded server.py' : 'Download server.py'}</span>
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

          <button
            type="button"
            className="engine-save-btn"
            onClick={() => onUpdateEngineCode?.(activeEngineId, editorCode)}
          >
            Save
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="engines-workspace-grid">
        {/* Left: Clean White Python Code Editor */}
        <div className="engine-code-card">
          <textarea
            className="engine-code-area"
            value={editorCode}
            onChange={handleCodeChange}
            spellCheck="false"
            placeholder="Write Python engine code here..."
          />
        </div>

        {/* Right: Universal Simulation with Inferred Input */}
        <div className="engine-sim-card">
          <div className="engine-sim-header">
            <span className="engine-sim-title">Simulation</span>
            <div
              className="engine-io-pill"
            >
              <div className="engine-mod-group">
                {renderModalityIcon(effectiveInputType, 'Input: ')}
              </div>
              <span className="engine-mod-arrow">→</span>
              <div className="engine-mod-group">
                {renderModalityIcon(fileOutput ? 'file' : inspection.inferredOutput, 'Output: ')}
              </div>
            </div>
          </div>

          <div className="engine-sim-body">
            {/* Dynamically Inferred Input based on static code inspection */}
            {effectiveInputType === 'file' ? (
              <div
                className="engine-upload-box"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden-file-input"
                  onChange={handleFileUpload}
                />
                {uploadedFile ? (
                  <div className="engine-file-selected">
                    <span className="engine-file-name">{uploadedFile.name}</span>
                    <span className="engine-file-size">
                      {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                ) : (
                  <span className="engine-upload-prompt">
                    Click or drop a file to test
                  </span>
                )}
              </div>
            ) : effectiveInputType === 'text' ? (
              <textarea
                className="engine-sim-text-input"
                placeholder="Enter text input to test..."
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
              />
            ) : (
              <textarea
                className="engine-sim-json-input"
                placeholder='Enter JSON input, e.g. {"key": "val"}...'
                value={rawJsonInput}
                onChange={(e) => setRawJsonInput(e.target.value)}
              />
            )}

            {/* Run Button */}
            <button
              type="button"
              className="engine-run-btn"
              onClick={runSimulation}
              disabled={isSimulating}
            >
              {isSimulating ? 'Running...' : 'Run'}
            </button>

            {/* Output Display */}
            <div className="engine-output-box">
              {simOutput ? (
                <div className="engine-output-content-wrap">
                  {/* Dedicated Output File Card when Engine returns a file */}
                  {fileOutput && (
                    <div className="engine-file-result-card">
                      <div className="file-result-main">
                        <svg className="file-result-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <div className="file-result-meta">
                          <span className="file-result-name">{fileOutput.filename}</span>
                          <span className="file-result-type">{fileOutput.mimeType}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="file-result-download-btn"
                        onClick={handleDownloadOutputFile}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Download</span>
                      </button>
                    </div>
                  )}

                  <pre className="engine-output-text">
                    {JSON.stringify(simOutput, null, 2)}
                  </pre>
                </div>
              ) : (
                <span className="engine-output-placeholder">
                  Output will appear here
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
