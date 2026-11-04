# Trex Up 🚀

Autonomous Multi-Modal Experimental & Verification Agent built for the **Meta Global AI Developer Hackathon**.

## Architecture Pattern

Following Meta's verifiable agent blueprint:

- `agent/`: The autonomous agentic loop (`Plan -> Act -> Observe`), tool registry, and multi-tier verification checks.
- `cases/`: The case/scenario dossiers, objectives, documents, and visual inputs.
- `ground_truth/`: Benchmark evaluation criteria and ground-truth standards.
- `world/`: The simulation environment / outside world interactions.
- `ui/`: The interactive real-time visual console for monitoring agent progress and human-in-the-loop sign-off.

## Run the engine server

The backend (`agent/server.py`) runs engines and calls the Meta models on `http://127.0.0.1:8001`. It needs `openai` and `pypdf`. On macOS with Homebrew Python, `pip install` outside a virtual environment is blocked (PEP 668), so use a venv:

```bash
cd agent
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
```

Bring your own key: create `agent/.env` with `MODEL_API_KEY=...` (and optionally `MODEL_API_BASE_URL`, default `https://api.meta.ai/v1`). The file is gitignored.

Restart the server after any change to `server.py`. The Engines page's **Download server.py** button gives you the same file, but it needs the same venv and `.env` next to it.
