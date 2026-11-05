<div align="center">
  <img src="./assets/logo.jpg" alt="Trex Logo" width="120" style="border-radius: 50%;" />
  <h1>Trex</h1>
  <p><strong>A visual multi-agent investigation & workflow platform powered by Meta AI models.</strong></p>
  <p><em>Built in a 10-day sprint.</em></p>
</div>

---

## Overview

**Trex** is an interactive research and investigation workbench that combines visual canvas exploration with automated multi-agent pipelines and deterministic Python engines. It allows users to drop documents, run structured workflows, inspect connections between findings, and collaborate with an autonomous AI research assistant.

---

## Project Structure

```text
Trex Up/
├── agent/
│   ├── server.py                    # Local FastAPI agent server & sandbox
│   ├── requirements.txt             # Agent server dependencies
│   └── storage/                     # Local documents & downloaded files
├── frontend/
│   ├── package.json                 # Frontend dependencies & scripts
│   ├── vite.config.js               # Vite configuration
│   └── src/
│       ├── App.jsx                  # Main application router & state manager
│       ├── index.css                # Global design system & theme tokens
│       ├── components/
│       │   ├── Canvas/              # Infinite exploration canvas & node rendering
│       │   ├── Workflow/            # DAG pipeline builder, thread & step modals
│       │   ├── Engines/             # Python engine code editor & runner
│       │   ├── Chat/                # AI assistant panel with tool execution
│       │   ├── Documents/           # Minimal document library & live preview
│       │   ├── Logs/                # Workflow & tool execution run logs
│       │   ├── Tools/               # Tool registry & inspector
│       │   └── Navigation/          # Header, breadcrumbs, and view switchers
│       ├── tools/
│       │   ├── nodes/               # Canvas tools, web search & file download
│       │   ├── workflow/            # Pipeline manipulation & execution tools
│       │   └── engine/              # Python engine management tools
│       └── utils/
│           ├── workflowRunner.js     # Workflow execution engine & context scoping
│           ├── db.js                # Local IndexedDB persistence
│           └── engineUtils.js       # Deterministic engine runtime helpers
└── assets/
    └── logo.jpg                     # Application logo
```

---

## Core Features

### 1. Exploration Canvas
- **Visual Knowledge Graph:** Create, move, and connect research nodes representing documents, findings, hypotheses, images, audio, and synthesis results.
- **Node Connections:** Draw directed relationships between nodes with automatic causal and logical analysis.
- **Direct Workflow Triggering:** Drag any workflow pipeline and drop it directly onto a canvas node to execute custom processing.
- **Canvas Tools:** Automatic tree auto-layout, zoom controls, minimap, and multi-exploration management per project.

### 2. Workflow Pipelines (DAG)
- **Visual Pipeline Designer:** Construct multi-step workflows connecting Entry/Input nodes, Python Engines, Meta AI Agents, and Canvas Output committers.
- **Flexible Triggers:** Activate pipelines via file drops, canvas node connections, or manual node execution.
- **Context Scoping:** Precisely control what data each step receives—original file metadata, upstream outputs, or full multimodal context.
- **Conditional Routing:** Thread branching based on dynamic stage outputs (e.g., routing to vision models when OCR flags low confidence).
- **Live Status Tracking:** Visual step progress showing pending, running, completed, skipped, or failed states in real time.

### 3. Deterministic Python Engines
- **In-Browser Code Editor:** Write and modify sandboxed Python data processors directly inside the app.
- **Built-in Engines:** Pre-configured engines for file type detection, text extraction, data normalization, and custom business logic.
- **Interactive Testing:** Test engines with custom JSON payloads and inspect execution duration and outputs before adding them to workflows.

### 4. Meta AI Model Integration
Built around Meta's specialized AI models via the Meta Model API:
- **`muse-spark-1.3`:** Fast reasoning, relationship analysis, structured extraction, and tool calling.
- **`muse-wonder-1.0`:** Deep synthesis, open-ended research analysis, and complex synthesis.
- **`muse-image-1.0`:** Text-to-image topic visualization and generation directly within workflow steps.
- **`muse-voice-transcribe-1.0`:** Speech-to-text audio transcription for audio research files.

### 5. Investigation AI Assistant & Tool Calling
- **Autonomous Agent:** Chat assistant capable of querying the canvas, searching documents, and creating structured nodes.
- **Live Web Search Grounding:** Real-time web search powered by the Meta Responses API (`tools=[{"type": "web_search"}]`), providing verified findings with inline citations.
- **Web File Downloader:** Downloads cited papers, PDFs, and external files directly into local project storage without canvas clutter.
- **Full Tool Calling Suite:** Tools for canvas manipulation (`create_node`, `connect_nodes`, `search_nodes`), workflow control, and log inspection.

### 6. Documents Page & Preview
- **Minimal Split-View Library:** Centralized view of all ingested and downloaded documents.
- **Live Preview:** Instant in-browser preview for PDF documents, images, and raw text files.
- **Clean Layout:** Minimalist design focused on document inspection and organization.

### 7. Execution Logs & Auditing
- **Workflow Traces:** Inspect historical pipeline runs with step-by-step inputs, outputs, execution duration, and errors.
- **Tool Call Traces:** Audit log of all actions executed by the assistant with parameter payloads and results.

---

## Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+)

### 1. Backend Setup
The backend provides the local execution sandbox, file storage, and Meta AI API bridge.

```bash
# Navigate to the backend directory
cd agent

# Install Python dependencies
pip install -r requirements.txt

# Start the agent server (runs on http://127.0.0.1:8001)
python server.py
```

> **Note:** The server will prompt for your Meta Model API key on first launch or read it from your environment (`MODEL_API_KEY`). You can also configure the server directly via the **Server** status indicator in the top navbar.

### 2. Frontend Setup

```bash
# In a new terminal, navigate to the frontend directory
cd frontend

# Install frontend dependencies
npm install

# Start the development server
npm run dev
```

Open your browser and navigate to:
```
http://localhost:5173
```

---

## Tech Stack

- **Frontend:** React, Vite, Vanilla CSS (Design system & glassmorphism tokens), Lucide Icons, IndexedDB
- **Backend:** Python, FastAPI, Uvicorn, Requests
- **AI & Grounding:** Meta Responses API, Search Grounding, Muse model family
