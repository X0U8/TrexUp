#!/usr/bin/env python3
import sys
import os
import json
import time
import base64
import mimetypes
import io
import re
import csv
import zlib
import struct
import zipfile
import urllib
import urllib.request
import hashlib
import threading
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler

HOST = "127.0.0.1"
PORT = 8001
DOCS_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "documents")
os.makedirs(DOCS_STORAGE_DIR, exist_ok=True)


def ensure_dependencies():
    """Checks and automatically installs required dependencies if missing."""
    required = {
        "openai": "openai>=1.0.0",
        "pypdf": "pypdf>=5.0.0",
    }
    missing = []
    for mod, pkg in required.items():
        try:
            __import__(mod)
        except ImportError:
            missing.append((mod, pkg))

    if missing:
        import subprocess

        for mod, pkg in missing:
            print(f"[Setup] Missing dependency '{mod}'. Auto-installing {pkg}...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])
                print(f"[Setup] Successfully installed {mod}.")
            except Exception as e:
                print(f"[Setup Warning] Could not auto-install {pkg}: {e}")
                print(f"[Setup Warning] Please run: pip install -r requirements.txt")


ensure_dependencies()


def load_env_file():
    env_paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "agent", ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "meta_project", "agent", ".env"),
    ]
    for p in env_paths:
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ.setdefault(k.strip(), v.strip())
            except Exception:
                pass


load_env_file()


def get_meta_client():
    try:
        from openai import OpenAI

        key = os.environ.get("MODEL_API_KEY", "")
        base_url = os.environ.get("MODEL_API_BASE_URL", "https://api.meta.ai/v1")
        if not key:
            load_env_file()
            key = os.environ.get("MODEL_API_KEY", "")
        if not key:
            raise ValueError("MODEL_API_KEY is not set in agent/.env")
        return OpenAI(api_key=key, base_url=base_url, timeout=120, max_retries=3)
    except Exception as e:
        print(f"[ModelClient] Initialization error: {e}")
        return None


def resolve_local_document(input_data):
    """
    Ensures document associated with doc_id is downloaded/cached locally on disk.
    On first run it downloads/caches the file; subsequent runs are fast from local cache.
    """
    if not isinstance(input_data, dict):
        return input_data

    doc_info = input_data.get("file") or input_data.get("document") or input_data
    if not isinstance(doc_info, dict):
        doc_info = input_data

    doc_id = (
        doc_info.get("doc_id")
        or input_data.get("doc_id")
        or doc_info.get("nodeId")
        or input_data.get("nodeId")
        or ""
    )
    file_name = (
        doc_info.get("file_name")
        or doc_info.get("name")
        or input_data.get("file_name")
        or input_data.get("name")
        or "unnamed"
    )
    b64_data = (
        doc_info.get("file_bytes_b64")
        or input_data.get("file_bytes_b64")
        or doc_info.get("b64")
        or ""
    )
    download_url = (
        doc_info.get("url")
        or doc_info.get("cloudinaryUrl")
        or input_data.get("url")
        or input_data.get("cloudinaryUrl")
        or ""
    )

    clean_prefix = re.sub(r"[^a-zA-Z0-9_-]", "_", doc_id) if doc_id else ""
    clean_filename = os.path.basename(file_name)
    target_filename = f"{clean_prefix}_{clean_filename}" if clean_prefix else clean_filename
    target_path = os.path.join(DOCS_STORAGE_DIR, target_filename)

    # 1. Download or write to disk if not yet cached
    if not os.path.exists(target_path) or os.path.getsize(target_path) == 0:
        if b64_data:
            try:
                if "," in b64_data[:60]:
                    b64_data = b64_data.split(",", 1)[1]
                decoded_bytes = base64.b64decode(b64_data)
                with open(target_path, "wb") as f:
                    f.write(decoded_bytes)
                print(f"[Storage] Cached binary from payload -> {target_path} ({len(decoded_bytes)} bytes)")
            except Exception as e:
                print(f"[Storage] Failed to decode base64: {e}")
        elif download_url and download_url.startswith(("http://", "https://")):
            try:
                import urllib.request
                print(f"[Storage] First-run: downloading {file_name} (doc_id={doc_id}) from {download_url}...")
                req = urllib.request.Request(download_url, headers={"User-Agent": "Trex-Engine-Runner/1.0"})
                with urllib.request.urlopen(req, timeout=20) as resp:
                    with open(target_path, "wb") as f:
                        f.write(resp.read())
                print(f"[Storage] Cached document locally -> {target_path} ({os.path.getsize(target_path)} bytes)")
            except Exception as e:
                print(f"[Storage] Failed to download {download_url}: {e}")

    # 2. If cached file exists, populate local path, real size and header bytes
    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        actual_size = os.path.getsize(target_path)
        with open(target_path, "rb") as f:
            header_sample = f.read(8192)

        input_data["file_path"] = target_path
        input_data["local_path"] = target_path
        input_data["size_bytes"] = actual_size
        input_data["size"] = actual_size
        input_data["header_bytes"] = header_sample

        for sub_key in ["file", "document"]:
            if isinstance(input_data.get(sub_key), dict):
                input_data[sub_key]["file_path"] = target_path
                input_data[sub_key]["local_path"] = target_path
                input_data[sub_key]["size_bytes"] = actual_size
                input_data[sub_key]["size"] = actual_size
                input_data[sub_key]["header_bytes"] = header_sample
    elif b64_data:
        try:
            if "," in b64_data[:60]:
                b64_data = b64_data.split(",", 1)[1]
            header_sample = base64.b64decode(b64_data[:512])
            input_data["header_bytes"] = header_sample
            if isinstance(input_data.get("file"), dict):
                input_data["file"]["header_bytes"] = header_sample
        except Exception:
            pass

    return input_data


FILES_REGISTRY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "files_registry.json")
_FILES_LOCK = threading.Lock()


def get_or_upload_file_id(client, file_path):
    """
    Meta Files API: Uploads document to Meta's user_data Files API and returns file_id.
    Caches file_id by SHA-256 in storage/files_registry.json so files are uploaded only once.
    """
    if not file_path or not os.path.isfile(file_path):
        return None
    try:
        with open(file_path, "rb") as f:
            content = f.read()
        if not content:
            return None
        file_sha = hashlib.sha256(content).hexdigest()

        registry = {}
        with _FILES_LOCK:
            if os.path.isfile(FILES_REGISTRY_PATH):
                try:
                    with open(FILES_REGISTRY_PATH, "r", encoding="utf-8") as rf:
                        registry = json.load(rf)
                except Exception:
                    registry = {}
            if file_sha in registry:
                return registry[file_sha]

        with open(file_path, "rb") as stream:
            uploaded = client.files.create(file=stream, purpose="user_data")
            file_id = uploaded.id

        with _FILES_LOCK:
            registry[file_sha] = file_id
            os.makedirs(os.path.dirname(FILES_REGISTRY_PATH), exist_ok=True)
            with open(FILES_REGISTRY_PATH, "w", encoding="utf-8") as wf:
                json.dump(registry, wf, indent=2)
        print(f"[Meta Files API] Uploaded {os.path.basename(file_path)} -> {file_id}")
        return file_id
    except Exception as e:
        print(f"[Meta Files API] Notice: could not upload file ({e}), falling back to text")
        return None


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
                "storage_dir": DOCS_STORAGE_DIR,
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

                # Resolve document caching on disk
                if isinstance(input_data, dict):
                    input_data = resolve_local_document(input_data)

                exec_scope = {
                    "__name__": "__main__",
                    "__file__": os.path.abspath(__file__),
                    "DOCS_STORAGE_DIR": DOCS_STORAGE_DIR,
                    "os": os,
                    "sys": sys,
                    "io": io,
                    "re": re,
                    "csv": csv,
                    "time": time,
                    "zlib": zlib,
                    "json": json,
                    "base64": base64,
                    "struct": struct,
                    "zipfile": zipfile,
                    "mimetypes": mimetypes,
                    "urllib": urllib,
                }

                exec(code, exec_scope)

                if "run" not in exec_scope or not callable(exec_scope["run"]):
                    raise ValueError("The engine script must define an entry function: def run(input_data, context=None)")

                # Strict Contract Validation against MANIFEST if declared
                manifest = exec_scope.get("MANIFEST")
                if isinstance(manifest, dict) and "inputs" in manifest and isinstance(manifest["inputs"], dict):
                    for port_name, port_spec in manifest["inputs"].items():
                        if isinstance(port_spec, dict) and port_spec.get("required"):
                            val = input_data.get(port_name) if isinstance(input_data, dict) else None
                            # Backward compatible fallback for flat single file/media payloads
                            if val is None and port_name in ["file", "document", "image", "audio", "video"] and isinstance(input_data, dict) and "file_name" in input_data:
                                val = input_data
                            if val is None or val == "":
                                raise ValueError(f"Missing required input '{port_name}' ({port_spec.get('type', 'any')})")

                output = exec_scope["run"](input_data)
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

                is_validation_failure = (
                    isinstance(output, dict)
                    and (
                        output.get("valid") is False
                        or output.get("status") in ["corrupted", "rejected", "failed", "security_quarantine", "error"]
                    )
                )

                if is_validation_failure:
                    # HTTP 422 Unprocessable Content for validation failure
                    self._set_cors_headers(422)
                    err_msg = output.get("reason") or output.get("error_message") or f"Engine returned {output.get('status')}"
                    res = {
                        "status": "error",
                        "error": err_msg,
                        "output": output,
                        "duration_ms": duration_ms,
                    }
                    self.wfile.write(json.dumps(res).encode("utf-8"))
                    print(f"[{time.strftime('%X')}] Engine validation failed -> HTTP 422 ({duration_ms}ms): {err_msg}")
                else:
                    # HTTP 200 OK for successful engine execution
                    self._set_cors_headers(200)
                    res = {
                        "status": "success",
                        "output": output,
                        "manifest": manifest if isinstance(manifest, dict) else None,
                        "duration_ms": duration_ms,
                        "server": "local-python",
                    }
                    self.wfile.write(json.dumps(res).encode("utf-8"))
                    print(f"[{time.strftime('%X')}] Executed engine -> HTTP 200 ({duration_ms}ms)")

            except Exception as e:
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                err_trace = traceback.format_exc()
                print(f"[{time.strftime('%X')}] Engine error -> HTTP 500 ({duration_ms}ms): {str(e)}")
                self._set_cors_headers(500)
                res = {
                    "status": "error",
                    "error": str(e),
                    "traceback": err_trace,
                    "duration_ms": duration_ms,
                }
                self.wfile.write(json.dumps(res).encode("utf-8"))
        elif self.path == "/api/agents/run":
            start_time = time.perf_counter()
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length)
                data = json.loads(body_bytes.decode("utf-8"))

                model_name = data.get("model", "muse-wonder-1.0")
                if model_name in ["muse-wonder", "muse_wonder"]:
                    model_name = "muse-wonder-1.0"
                elif model_name in ["muse-spark", "muse_spark"]:
                    model_name = "muse-spark-1.3"
                elif model_name in ["muse-voice", "muse-voice-transcribe"]:
                    model_name = "muse-voice-transcribe-1.0"

                system_prompt = data.get("system_prompt") or "You are an AI research assistant. Analyze the context and provide factual synthesis."
                prompt_text = data.get("prompt") or ""
                temp = data.get("temperature", 0.2)
                reasoning = data.get("reasoning_effort", "minimal")
                input_data = data.get("input_data", {})
                if isinstance(input_data, dict):
                    input_data = resolve_local_document(input_data)

                client = get_meta_client()
                if client is None:
                    raise RuntimeError("Meta Model API client is not configured or openai package missing.")

                file_path = ""
                if isinstance(input_data, dict):
                    file_path = (
                        input_data.get("local_path")
                        or input_data.get("file_path")
                        or (input_data.get("file", {}) if isinstance(input_data.get("file"), dict) else {}).get("local_path")
                        or (input_data.get("file", {}) if isinstance(input_data.get("file"), dict) else {}).get("file_path")
                        or ""
                    )

                file_id = get_or_upload_file_id(client, file_path) if file_path else None

                user_content = []
                user_content.append({"type": "input_text", "text": prompt_text or "Please analyze and extract structured findings."})
                if file_id:
                    user_content.append({"type": "input_file", "file_id": file_id})

                tools_spec = data.get("tools")
                tool_calls_data = []
                out_content = ""
                used_method = "chat.completions" if tools_spec else "responses.create"

                if tools_spec:
                    # When tools are declared, use chat.completions with tools specification
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt_text},
                    ]
                    call_kwargs = {
                        "model": model_name,
                        "messages": messages,
                        "tools": tools_spec,
                    }
                    if temp is not None:
                        try:
                            call_kwargs["temperature"] = float(temp)
                        except Exception:
                            pass
                    response = client.chat.completions.create(**call_kwargs)
                    choice = response.choices[0]
                    out_content = choice.message.content or ""
                    for tc in getattr(choice.message, "tool_calls", None) or []:
                        tool_calls_data.append({
                            "id": getattr(tc, "id", f"call_{len(tool_calls_data)}"),
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        })
                else:
                    try:
                        # Meta Gold Standard: responses.create with input_file
                        response = client.responses.create(
                            model=model_name,
                            instructions=system_prompt,
                            input=[{"role": "user", "content": user_content}],
                        )
                        out_content = getattr(response, "output_text", "") or ""
                    except Exception as resp_err:
                        print(f"[{time.strftime('%X')}] responses.create notice ({resp_err}); falling back to chat.completions")
                        messages = [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt_text},
                        ]
                        call_kwargs = {
                            "model": model_name,
                            "messages": messages,
                        }
                        if temp is not None:
                            try:
                                call_kwargs["temperature"] = float(temp)
                            except Exception:
                                pass
                        response = client.chat.completions.create(**call_kwargs)
                        out_content = response.choices[0].message.content or ""

                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

                self._set_cors_headers(200)
                res = {
                    "status": "success",
                    "model": model_name,
                    "response": out_content,
                    "tool_calls": tool_calls_data,
                    "output": {
                        "synthesis": out_content,
                        "agent_synthesis": out_content,
                        "tool_calls": tool_calls_data,
                        "model": model_name,
                        "duration_ms": duration_ms,
                    },
                }
                self.wfile.write(json.dumps(res).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Agent model '{model_name}' executed -> HTTP 200 ({duration_ms}ms)")

            except Exception as e:
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                err_msg = str(e)
                status_code = 500
                if "401" in err_msg or "authentication" in err_msg.lower():
                    status_code = 401
                elif "404" in err_msg or "not found" in err_msg.lower():
                    status_code = 404
                elif "429" in err_msg or "rate limit" in err_msg.lower():
                    status_code = 429
                elif "400" in err_msg:
                    status_code = 400

                self._set_cors_headers(status_code)
                res = {
                    "status": "error",
                    "error": err_msg,
                    "http_code": status_code,
                    "duration_ms": duration_ms,
                }
                self.wfile.write(json.dumps(res).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Agent model error -> HTTP {status_code} ({duration_ms}ms): {err_msg}")

        elif self.path == "/api/engines/validate":
            try:
                import ast

                content_length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(content_length).decode("utf-8"))
                code = data.get("code", "")
                result = {"valid": True}
                try:
                    tree = ast.parse(code)
                    problems = []
                    has_run = any(
                        isinstance(n, ast.FunctionDef) and n.name == "run" for n in tree.body
                    )
                    has_manifest = any(
                        isinstance(n, ast.Assign)
                        and any(isinstance(t, ast.Name) and t.id == "MANIFEST" for t in n.targets)
                        for n in tree.body
                    )
                    if not has_manifest:
                        problems.append("Missing top-level MANIFEST = {...}")
                    if not has_run:
                        problems.append("Missing entry function: def run(input_data, context=None)")
                    if problems:
                        result = {"valid": False, "error": "; ".join(problems), "problems": problems}
                except SyntaxError as se:
                    result = {
                        "valid": False,
                        "error": f"SyntaxError: {se.msg}",
                        "line": se.lineno,
                        "problems": [f"SyntaxError on line {se.lineno}: {se.msg}"],
                    }
                self._set_cors_headers(200)
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"valid": False, "error": str(e)}).encode("utf-8"))
        elif self.path == "/api/engines/inspect":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length)
                data = json.loads(body_bytes.decode("utf-8"))
                code = data.get("code", "")
                exec_scope = {}
                try:
                    exec(code, exec_scope)
                except Exception:
                    pass
                manifest = exec_scope.get("MANIFEST")
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({
                    "status": "success",
                    "manifest": manifest if isinstance(manifest, dict) else None
                }).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
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
