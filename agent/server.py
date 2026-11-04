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
import urllib.error
import urllib.parse
import hashlib
import threading
import traceback
import tempfile
import subprocess
import shutil
import uuid
from http.server import HTTPServer, ThreadingHTTPServer, BaseHTTPRequestHandler

HOST = "127.0.0.1"
PORT = 8001
DOCS_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "documents")
os.makedirs(DOCS_STORAGE_DIR, exist_ok=True)
EXPERIMENTS_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "experiments")
os.makedirs(EXPERIMENTS_STORAGE_DIR, exist_ok=True)


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
            installed = False
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", pkg], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                installed = True
            except Exception:
                pass

            if not installed:
                try:
                    subprocess.check_call([sys.executable, "-m", "pip", "install", "--break-system-packages", pkg])
                    installed = True
                except Exception as e:
                    print(f"[Setup Warning] Could not auto-install {pkg}: {e}")
                    print(f"[Setup Warning] Please run: pip install -r requirements.txt")

            if installed:
                print(f"[Setup] Successfully installed {mod}.")


ensure_dependencies()


def load_env_file():
    env_paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        os.path.join(os.getcwd(), ".env"),
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

DEFAULT_API_KEY = ""
DEFAULT_BASE_URL = "https://api.meta.ai/v1"


def get_meta_client():
    try:
        from openai import OpenAI

        key = os.environ.get("MODEL_API_KEY", "") or DEFAULT_API_KEY
        base_url = os.environ.get("MODEL_API_BASE_URL", "") or DEFAULT_BASE_URL or "https://api.meta.ai/v1"
        if not key:
            load_env_file()
            key = os.environ.get("MODEL_API_KEY", "") or DEFAULT_API_KEY
        if not key:
            raise ValueError("MODEL_API_KEY is not set.")
        return OpenAI(api_key=key, base_url=base_url, timeout=120, max_retries=3)
    except Exception as e:
        print(f"[ModelClient] Initialization error: {e}")
        return None


def persist_file_outputs(output, manifest):
    """An engine that declares a 'file' output may write it anywhere (often /tmp). Copy it into the
    project's document storage so it survives, and return it as a file with a URL for preview/download."""
    if not isinstance(output, dict) or not isinstance(manifest, dict):
        return output
    for port, spec in (manifest.get("outputs") or {}).items():
        if not isinstance(spec, dict) or spec.get("type") != "file":
            continue
        value = output.get(port)
        if isinstance(value, dict):
            value = value.get("path") or value.get("local_path") or value.get("file_path")
        if not isinstance(value, str) or not os.path.isfile(value):
            continue
        base = os.path.basename(value)
        stored_name = f"engine_out_{time.strftime('%Y%m%d%H%M%S')}_{base}"
        stored_path = os.path.join(DOCS_STORAGE_DIR, stored_name)
        shutil.copyfile(value, stored_path)
        mime, _ = mimetypes.guess_type(stored_name)
        output[port] = {
            "type": "file",
            "filename": base,
            "mime_type": mime or "application/octet-stream",
            "local_path": stored_path,
            "url": f"http://{HOST}:{PORT}/storage/documents/{urllib.parse.quote(stored_name)}",
        }
    return output


def enrich_single_user_message(m):
    """
    Enriches a single user message with local image vision inputs if local image file paths
    or document storage paths are referenced.
    """
    import base64
    import mimetypes
    import re

    raw_content = m.get("content")
    if raw_content is None:
        m["content"] = ""
    elif not isinstance(raw_content, (str, list)):
        m["content"] = str(raw_content)

    content = m["content"]
    if isinstance(content, str):
        # Extract absolute local paths or file:// paths
        paths = re.findall(r'(?:file://)?(/[^\s"\'<>\(\)\[\]]+\.(?:webp|png|jpe?g|gif|bmp))', content, re.IGNORECASE)

        # Extract local server storage URLs
        url_matches = re.findall(r'https?://[^\s"\'<>]+/storage/documents/([^\s"\'<>\?#]+)', content, re.IGNORECASE)
        for fname in url_matches:
            clean_fname = urllib.parse.unquote(fname)
            cand = os.path.join(DOCS_STORAGE_DIR, clean_fname)
            if cand not in paths and os.path.isfile(cand):
                paths.append(cand)

        # Extract any standalone image filename that exists in DOCS_STORAGE_DIR
        fnames = re.findall(r'\b([a-zA-Z0-9_\-]+\.(?:webp|png|jpe?g|gif))\b', content, re.IGNORECASE)
        for fn in fnames:
            cand = os.path.join(DOCS_STORAGE_DIR, fn)
            if cand not in paths and os.path.isfile(cand):
                paths.append(cand)

        image_urls = []
        for p in paths:
            if os.path.isfile(p):
                mime, _ = mimetypes.guess_type(p)
                mime = mime or "image/webp"
                try:
                    if os.path.getsize(p) <= 12 * 1024 * 1024:
                        with open(p, "rb") as f:
                            b64 = base64.b64encode(f.read()).decode("utf-8")
                        image_urls.append(f"data:{mime};base64,{b64}")
                except Exception as err:
                    print(f"[VisionEnrich] Error reading image {p}: {err}")

        if image_urls:
            m["content"] = [{"type": "text", "text": content}]
            for u in image_urls:
                m["content"].append({"type": "image_url", "image_url": {"url": u}})

    return m


def enrich_messages_with_local_images(messages):
    """
    Strictly normalizes OpenAI chat messages schema before passing to client.chat.completions.create:
    - role='user': can be string or list of content blocks (enriched with vision if images detected)
    - role='assistant': if tool_calls, content can be None or string (never list). If no tool_calls, must be string.
    - role='tool': content MUST strictly be string. Must have tool_call_id.
    - role='system': content MUST strictly be string.
    """
    clean_messages = []
    for raw_m in (messages or []):
        if not isinstance(raw_m, dict):
            continue
        m = dict(raw_m)
        role = m.get("role", "user")

        if role == "tool":
            c = m.get("content")
            if c is None:
                m["content"] = "{}"
            elif isinstance(c, (dict, list)):
                m["content"] = json.dumps(c)
            else:
                m["content"] = str(c)
            if not m.get("tool_call_id"):
                m["tool_call_id"] = "call_default"
            clean_messages.append({
                "role": "tool",
                "tool_call_id": str(m["tool_call_id"]),
                "content": m["content"]
            })
            continue

        if role == "assistant":
            tool_calls = m.get("tool_calls")
            c = m.get("content")
            entry = {"role": "assistant"}
            if tool_calls:
                entry["tool_calls"] = tool_calls
                if c is None or c == "":
                    entry["content"] = None
                elif isinstance(c, list):
                    entry["content"] = " ".join(
                        part.get("text", "") for part in c if isinstance(part, dict)
                    )
                else:
                    entry["content"] = str(c)
            else:
                if c is None:
                    entry["content"] = ""
                elif isinstance(c, list):
                    entry["content"] = " ".join(
                        part.get("text", "") for part in c if isinstance(part, dict)
                    )
                else:
                    entry["content"] = str(c)
            clean_messages.append(entry)
            continue

        if role == "system":
            c = m.get("content")
            if c is None:
                c = ""
            elif isinstance(c, list):
                c = " ".join(part.get("text", "") for part in c if isinstance(part, dict))
            else:
                c = str(c)
            clean_messages.append({"role": "system", "content": c})
            continue

        # Default role == 'user'
        clean_messages.append(enrich_single_user_message(m))

    return clean_messages


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
        (doc_info.get("file_name") if isinstance(doc_info, dict) else None)
        or (doc_info.get("name") if isinstance(doc_info, dict) else None)
        or input_data.get("file_name")
        or input_data.get("name")
        or (input_data.get("document") if isinstance(input_data.get("document"), str) else "")
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
        if os.path.isdir(DOCS_STORAGE_DIR):
            for existing in os.listdir(DOCS_STORAGE_DIR):
                if clean_filename and (existing == clean_filename or existing.endswith(f"_{clean_filename}")):
                    cand = os.path.join(DOCS_STORAGE_DIR, existing)
                    if os.path.isfile(cand) and os.path.getsize(cand) > 0:
                        target_path = cand
                        break
                elif clean_prefix and existing.startswith(f"{clean_prefix}_"):
                    cand = os.path.join(DOCS_STORAGE_DIR, existing)
                    if os.path.isfile(cand) and os.path.getsize(cand) > 0:
                        target_path = cand
                        break

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
_MODEL_LOCK = threading.Lock()


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


def transcribe_audio_meta(audio_path="", raw_bytes=None, filename="audio.wav", mode="DIARIZATION"):
    """
    Transcribes audio via Meta's official Speech-to-Text ASR endpoint:
    POST https://api.meta.ai/v1/asr/transcribe
    Converts audio to mono 16-bit integer PCM WAV (24 kHz) and sends multipart payload.
    """
    key = os.environ.get("MODEL_API_KEY", "") or DEFAULT_API_KEY
    if not key:
        load_env_file()
        key = os.environ.get("MODEL_API_KEY", "") or DEFAULT_API_KEY
    if not key:
        raise RuntimeError("Meta MODEL_API_KEY is not configured.")

    base_url = os.environ.get("MODEL_API_BASE_URL", "") or DEFAULT_BASE_URL or "https://api.meta.ai/v1"
    clean_base = base_url.rstrip("/")
    if clean_base.endswith("/v1"):
        asr_url = f"{clean_base}/asr/transcribe"
    else:
        asr_url = f"{clean_base}/v1/asr/transcribe"

    temp_dir = tempfile.gettempdir()
    src_path = audio_path
    if not src_path or not os.path.exists(src_path):
        if raw_bytes:
            src_ext = os.path.splitext(filename)[1] or ".mp3"
            src_path = os.path.join(temp_dir, f"raw_audio_{uuid.uuid4().hex[:8]}{src_ext}")
            with open(src_path, "wb") as f:
                f.write(raw_bytes)
        else:
            raise FileNotFoundError(f"Audio file '{filename}' could not be located on disk.")

    upload_wav_path = os.path.join(temp_dir, f"transcribe_{uuid.uuid4().hex[:8]}.wav")
    converted = False

    # 1. Convert to mono 16-bit 24kHz PCM WAV via macOS afconvert
    if os.path.exists("/usr/bin/afconvert"):
        cmd = ["/usr/bin/afconvert", "-f", "WAVE", "-d", "LEI16@24000", "-c", "1", src_path, upload_wav_path]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and os.path.exists(upload_wav_path) and os.path.getsize(upload_wav_path) > 0:
            converted = True

    # 2. Convert via ffmpeg if available
    if not converted:
        ffmpeg_bin = shutil.which("ffmpeg")
        if ffmpeg_bin:
            cmd = [ffmpeg_bin, "-y", "-i", src_path, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", upload_wav_path]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0 and os.path.exists(upload_wav_path) and os.path.getsize(upload_wav_path) > 0:
                converted = True

    final_audio_path = upload_wav_path if converted else src_path

    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    request_spec = {
        "mode": mode or "DIARIZATION",
        "model": "muse-voice-transcribe-1.0",
        "audioEncoding": "WAV",
    }

    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b'Content-Disposition: form-data; name="request"\r\n')
    body.extend(b'Content-Type: application/json\r\n\r\n')
    body.extend(json.dumps(request_spec).encode("utf-8"))
    body.extend(b'\r\n')

    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b'Content-Disposition: form-data; name="audio"; filename="audio.wav"\r\n')
    body.extend(b'Content-Type: audio/wav\r\n\r\n')
    with open(final_audio_path, "rb") as f:
        body.extend(f.read())
    body.extend(b'\r\n')
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    session_id = f"trex-{uuid.uuid4().hex[:12]}"
    full_url = f"{asr_url}?sessionId={session_id}"

    req = urllib.request.Request(
        full_url,
        data=bytes(body),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "Trex-Voice-Transcribe/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8", errors="replace")
        try:
            err_json = json.loads(err_body)
            msg = err_json.get("message") or err_json.get("error") or err_body
        except Exception:
            msg = err_body or str(he)
        raise RuntimeError(f"Meta ASR error ({he.code}): {msg}")

    if converted and os.path.exists(upload_wav_path):
        try:
            os.remove(upload_wav_path)
        except Exception:
            pass

    transcript = data.get("transcript") or ""
    turns = data.get("turns") or []
    lines = []
    for t in turns:
        spk = t.get("speaker") or "Speaker"
        t_text = t.get("transcript") or ""
        start_s = t.get("startMs", 0) / 1000.0
        end_s = t.get("endMs", 0) / 1000.0
        start_str = f"{int(start_s // 60):02d}:{int(start_s % 60):02d}"
        end_str = f"{int(end_s // 60):02d}:{int(end_s % 60):02d}"
        lines.append(f"[{start_str} - {end_str}] Speaker {spk}: {t_text}")

    formatted_transcript = "\n".join(lines) if lines else transcript

    return {
        "status": "success",
        "transcript": transcript,
        "formatted_transcript": formatted_transcript,
        "turns": turns,
        "audio_duration_ms": data.get("audioDurationMs", 0),
        "session_id": data.get("sessionId", session_id),
    }


class EngineRequestHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def do_OPTIONS(self):
        self._set_cors_headers(200)

    def _delete_document_files(self, doc_id="", file_name="", local_path="", url=""):
        deleted = []
        if local_path and os.path.isfile(local_path):
            try:
                os.remove(local_path)
                deleted.append(os.path.basename(local_path))
            except Exception as err:
                print(f"[DocumentDelete] Error removing {local_path}: {err}")

        if os.path.isdir(DOCS_STORAGE_DIR):
            clean_prefix = re.sub(r"[^a-zA-Z0-9_-]", "_", doc_id) if doc_id else ""
            clean_fn = os.path.basename(file_name) if file_name else ""
            url_fn = os.path.basename(urllib.parse.unquote(url.split("?")[0])) if url else ""

            for fname in os.listdir(DOCS_STORAGE_DIR):
                fpath = os.path.join(DOCS_STORAGE_DIR, fname)
                if not os.path.isfile(fpath):
                    continue
                should_delete = False
                if clean_prefix and (fname.startswith(f"{clean_prefix}_") or fname == clean_prefix):
                    should_delete = True
                elif clean_fn and (fname == clean_fn or fname.endswith(f"_{clean_fn}")):
                    should_delete = True
                elif url_fn and fname == url_fn:
                    should_delete = True

                if should_delete and fname not in deleted:
                    try:
                        os.remove(fpath)
                        deleted.append(fname)
                    except Exception as err:
                        print(f"[DocumentDelete] Error removing {fpath}: {err}")
        return deleted

    def do_DELETE(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length) if content_length > 0 else b""
            data = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}

            path_part = self.path.split("?")[0].rstrip("/")
            path_id = os.path.basename(path_part) if ("/api/documents/" in path_part or "/storage/documents/" in path_part) else ""
            doc_id = data.get("doc_id") or data.get("node_id") or data.get("id") or path_id or ""
            file_name = data.get("file_name") or data.get("name") or data.get("title") or ""
            local_path = data.get("local_path") or data.get("localPath") or ""
            url = data.get("url") or data.get("cloudinaryUrl") or ""

            deleted_files = self._delete_document_files(doc_id, file_name, local_path, url)
            self._set_cors_headers(200)
            res = {"status": "success", "deleted_files": deleted_files, "doc_id": doc_id}
            self.wfile.write(json.dumps(res).encode("utf-8"))
            print(f"[{time.strftime('%X')}] Document deleted from storage -> {deleted_files}")
        except Exception as e:
            self._set_cors_headers(500)
            self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))

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
        elif self.path in ["/api/documents", "/api/documents/"]:
            try:
                import datetime
                files = []
                if os.path.isdir(DOCS_STORAGE_DIR):
                    fnames = [fn for fn in os.listdir(DOCS_STORAGE_DIR) if not fn.startswith(".")]
                    fnames.sort(key=lambda x: os.path.getmtime(os.path.join(DOCS_STORAGE_DIR, x)), reverse=True)
                    for fname in fnames:
                        fpath = os.path.join(DOCS_STORAGE_DIR, fname)
                        if not os.path.isfile(fpath):
                            continue
                        mime, _ = mimetypes.guess_type(fpath)
                        stat = os.stat(fpath)
                        files.append({
                            "filename": fname,
                            "name": fname,
                            "url": f"http://{HOST}:{PORT}/storage/documents/{urllib.parse.quote(fname)}",
                            "local_path": fpath,
                            "size_bytes": stat.st_size,
                            "fileSize": stat.st_size,
                            "mime_type": mime or "application/octet-stream",
                            "modified_at": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        })
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({"status": "success", "documents": files}).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
        elif self.path.startswith("/storage/documents/") or self.path.startswith("/files/"):
            rel_name = self.path.split("/", 3)[-1]
            rel_name = urllib.parse.unquote(rel_name.split("?")[0])
            file_path = os.path.join(DOCS_STORAGE_DIR, os.path.basename(rel_name))
            if os.path.isfile(file_path):
                mime, _ = mimetypes.guess_type(file_path)
                mime = mime or "application/octet-stream"
                self._set_cors_headers(200, content_type=mime)
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self._set_cors_headers(404)
                self.wfile.write(json.dumps({"error": "File not found"}).encode("utf-8"))
        elif self.path.startswith("/api/experiments"):
            try:
                parsed = urllib.parse.urlparse(self.path)
                q = urllib.parse.parse_qs(parsed.query)
                project_id = q.get("project_id", [""])[0]
                experiment_id = q.get("experiment_id", [""])[0]
                if project_id and experiment_id:
                    clean_name = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', project_id)}_{re.sub(r'[^a-zA-Z0-9_-]', '_', experiment_id)}.json"
                    file_path = os.path.join(EXPERIMENTS_STORAGE_DIR, clean_name)
                    if os.path.isfile(file_path):
                        with open(file_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        self._set_cors_headers(200)
                        self.wfile.write(json.dumps({"status": "success", "data": data}).encode("utf-8"))
                    else:
                        self._set_cors_headers(200)
                        self.wfile.write(json.dumps({"status": "not_found", "data": None}).encode("utf-8"))
                elif project_id:
                    prefix = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', project_id)}_"
                    items = []
                    for fname in os.listdir(EXPERIMENTS_STORAGE_DIR):
                        if fname.startswith(prefix) and fname.endswith(".json"):
                            fpath = os.path.join(EXPERIMENTS_STORAGE_DIR, fname)
                            try:
                                with open(fpath, "r", encoding="utf-8") as f:
                                    items.append(json.load(f))
                            except Exception:
                                pass
                    self._set_cors_headers(200)
                    self.wfile.write(json.dumps({"status": "success", "experiments": items}).encode("utf-8"))
                else:
                    self._set_cors_headers(400)
                    self.wfile.write(json.dumps({"status": "error", "error": "Missing project_id"}).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
        else:
            self._set_cors_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

    def do_POST(self):
        if self.path in ["/api/upload", "/api/documents/upload"]:
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length)
                content_type = self.headers.get("Content-Type", "")

                doc_id = ""
                file_name = "document.bin"
                raw_bytes = b""

                if "application/json" in content_type:
                    data = json.loads(body_bytes.decode("utf-8"))
                    file_name = data.get("file_name") or data.get("name") or "document.bin"
                    doc_id = data.get("doc_id") or data.get("nodeId") or ""
                    b64_data = data.get("file_bytes_b64") or data.get("b64") or ""
                    if "," in b64_data[:60]:
                        b64_data = b64_data.split(",", 1)[1]
                    raw_bytes = base64.b64decode(b64_data)
                elif "multipart/form-data" in content_type:
                    boundary = content_type.split("boundary=")[-1].strip().encode("utf-8")
                    parts = body_bytes.split(b"--" + boundary)
                    for part in parts:
                        if b"filename=" in part:
                            header_part, file_part = part.split(b"\r\n\r\n", 1)
                            file_part = file_part.rstrip(b"\r\n--")
                            match = re.search(r'filename="([^"]+)"', header_part.decode("utf-8", "ignore"))
                            if match:
                                file_name = match.group(1)
                            raw_bytes = file_part
                            break
                else:
                    raw_bytes = body_bytes
                    header_fn = self.headers.get("X-File-Name", "")
                    if header_fn:
                        file_name = urllib.parse.unquote(header_fn)

                clean_prefix = re.sub(r"[^a-zA-Z0-9_-]", "_", doc_id) if doc_id else ""
                clean_filename = os.path.basename(file_name)
                target_filename = f"{clean_prefix}_{clean_filename}" if clean_prefix else clean_filename
                target_path = os.path.join(DOCS_STORAGE_DIR, target_filename)

                with open(target_path, "wb") as f:
                    f.write(raw_bytes)

                self._set_cors_headers(200)
                res = {
                    "status": "success",
                    "file_name": clean_filename,
                    "target_filename": target_filename,
                    "size_bytes": len(raw_bytes),
                    "local_path": target_path,
                    "file_path": target_path,
                    "url": f"http://{HOST}:{PORT}/storage/documents/{target_filename}",
                }
                self.wfile.write(json.dumps(res).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Document uploaded locally -> {target_path} ({len(raw_bytes)} bytes)")
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))

        elif self.path in ["/api/delete", "/api/documents/delete", "/api/upload/delete"]:
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length) if content_length > 0 else b""
                data = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}

                doc_id = data.get("doc_id") or data.get("node_id") or data.get("id") or ""
                file_name = data.get("file_name") or data.get("name") or data.get("title") or ""
                local_path = data.get("local_path") or data.get("localPath") or ""
                url = data.get("url") or data.get("cloudinaryUrl") or ""

                deleted_files = self._delete_document_files(doc_id, file_name, local_path, url)
                self._set_cors_headers(200)
                res = {"status": "success", "deleted_files": deleted_files, "doc_id": doc_id}
                self.wfile.write(json.dumps(res).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Document deleted from storage -> {deleted_files}")
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))

        elif self.path == "/api/experiments":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length)
                payload = json.loads(body_bytes.decode("utf-8"))
                project_id = payload.get("project_id", "default")
                experiment_id = payload.get("experiment_id", "experiment_01")
                exp_data = payload.get("data", {})

                clean_name = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', project_id)}_{re.sub(r'[^a-zA-Z0-9_-]', '_', experiment_id)}.json"
                file_path = os.path.join(EXPERIMENTS_STORAGE_DIR, clean_name)

                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(exp_data, f, indent=2)

                self._set_cors_headers(200)
                self.wfile.write(json.dumps({
                    "status": "success",
                    "project_id": project_id,
                    "experiment_id": experiment_id,
                    "local_path": file_path,
                }).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Experiment saved to device storage -> {file_path}")
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))

        elif self.path == "/api/engines/run":
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
                            # Backward compatible fallback for node_pair
                            if val is None and port_name in ["node_pair", "pair", "nodes"] and isinstance(input_data, dict):
                                if any(k in input_data for k in ["source_node", "sourceNode", "target_node", "targetNode"]):
                                    s_node = input_data.get("source_node") or input_data.get("sourceNode")
                                    t_node = input_data.get("target_node") or input_data.get("targetNode")
                                    val = {
                                        "source_node": s_node,
                                        "target_node": t_node,
                                        "exploration_id": input_data.get("exploration_id") or "exploration_01",
                                    }
                                    input_data["node_pair"] = val
                            if val is None or val == "":
                                raise ValueError(f"Missing required input '{port_name}' ({port_spec.get('type', 'any')})")

                output = persist_file_outputs(exec_scope["run"](input_data), manifest)
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

                client = get_meta_client()
                if client is None:
                    raise RuntimeError("Meta client is not configured. Please ensure MODEL_API_KEY is configured in your .env file.")

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

                file_path = ""
                if isinstance(input_data, dict):
                    file_path = (
                        input_data.get("local_path")
                        or input_data.get("file_path")
                        or (input_data.get("file", {}) if isinstance(input_data.get("file"), dict) else {}).get("local_path")
                        or (input_data.get("file", {}) if isinstance(input_data.get("file"), dict) else {}).get("file_path")
                        or ""
                    )

                # Image generation (muse-image-1.0): one image from the prompt, returned inline as a data URL.
                if model_name == "muse-image-1.0":
                    image_prompt = (prompt_text or "").strip()[:4000]
                    if not image_prompt:
                        raise ValueError("Image step needs a prompt: connect an upstream text step or write one in the agent settings.")
                    img_res = client.images.generate(model=model_name, prompt=image_prompt, n=1)
                    img_b64 = img_res.data[0].b64_json
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    self._set_cors_headers(200)
                    res = {
                        "status": "success",
                        "model": model_name,
                        "response": "",
                        "tool_calls": [],
                        "output": {
                            "synthesis": "Image generated from the prompt.",
                            "agent_synthesis": "Image generated from the prompt.",
                            "image_prompt": image_prompt,
                            "image_data_url": f"data:image/webp;base64,{img_b64}",
                            "model": model_name,
                            "duration_ms": duration_ms,
                        },
                    }
                    self.wfile.write(json.dumps(res).encode("utf-8"))
                    print(f"[{time.strftime('%X')}] Image generated -> HTTP 200 ({duration_ms}ms)")
                    return

                # Check for Muse Voice Transcribe / audio ASR
                if model_name == "muse-voice-transcribe-1.0":
                    raw_b64 = ""
                    if isinstance(input_data, dict):
                        raw_b64 = (
                            input_data.get("file_bytes_b64")
                            or input_data.get("b64")
                            or (input_data.get("file", {}) if isinstance(input_data.get("file"), dict) else {}).get("b64")
                            or (input_data.get("file", {}) if isinstance(input_data.get("file"), dict) else {}).get("file_bytes_b64")
                            or ""
                        )
                    raw_bytes = None
                    if raw_b64:
                        try:
                            if "," in raw_b64[:60]:
                                raw_b64 = raw_b64.split(",", 1)[1]
                            raw_bytes = base64.b64decode(raw_b64)
                        except Exception:
                            pass

                    file_name = (
                        (input_data.get("file_name") if isinstance(input_data, dict) else "")
                        or (input_data.get("name") if isinstance(input_data, dict) else "")
                        or (input_data.get("document") if isinstance(input_data, dict) else "")
                        or ((input_data.get("file", {}) if isinstance(input_data.get("file"), dict) else {}).get("name"))
                        or "recording.wav"
                    )

                    audio_res = transcribe_audio_meta(
                        audio_path=file_path,
                        raw_bytes=raw_bytes,
                        filename=file_name,
                        mode="DIARIZATION",
                    )
                    out_content = audio_res.get("formatted_transcript") or audio_res.get("transcript") or ""
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    self._set_cors_headers(200)
                    res = {
                        "status": "success",
                        "model": "muse-voice-transcribe-1.0",
                        "response": out_content,
                        "tool_calls": [],
                        "output": {
                            "transcript": audio_res.get("transcript", ""),
                            "formatted_transcript": out_content,
                            "synthesis": out_content,
                            "agent_synthesis": out_content,
                            "extracted_text": out_content,
                            "turns": audio_res.get("turns", []),
                            "audio_duration_ms": audio_res.get("audio_duration_ms", 0),
                            "model": "muse-voice-transcribe-1.0",
                            "duration_ms": duration_ms,
                        },
                    }
                    self.wfile.write(json.dumps(res).encode("utf-8"))
                    print(f"[{time.strftime('%X')}] Muse Voice Transcribe -> completed in {duration_ms}ms ({len(out_content)} chars)")
                    return

                should_include_file = data.get("include_file")
                if should_include_file is None and isinstance(input_data, dict):
                    should_include_file = bool(input_data.get("file") or input_data.get("file_bytes_b64") or input_data.get("include_raw_file"))
                elif should_include_file is None:
                    should_include_file = False

                # A file produced by an earlier step (for example a generated image) is attached explicitly.
                step_image_path = data.get("image_path") or ""
                if step_image_path and os.path.isfile(step_image_path):
                    file_path = step_image_path
                    should_include_file = True

                file_id = get_or_upload_file_id(client, file_path) if (file_path and should_include_file) else None

                # Guard against context window token overflow from accidental base64 or giant text
                if prompt_text and len(prompt_text) > 40000:
                    print(f"[{time.strftime('%X')}] Notice: prompt_text length is {len(prompt_text)} chars, truncating to 40000 to prevent context token overflow")
                    prompt_text = prompt_text[:40000] + "\n\n[Context truncated to fit model context window]"

                user_content = []
                user_content.append({"type": "input_text", "text": prompt_text or "Please analyze and extract structured findings."})
                if file_id:
                    user_content.append({"type": "input_file", "file_id": file_id})

                # Normalize tools into flat format for Meta's responses.create (and nested format for chat.completions fallback)
                raw_tools = data.get("tools")
                responses_tools = []
                chat_tools = []
                if raw_tools and isinstance(raw_tools, list):
                    for t in raw_tools:
                        if not isinstance(t, dict):
                            continue
                        t_type = t.get("type")
                        if t_type == "tool_search":
                            continue
                        if t_type == "namespace":
                            for sub_t in t.get("tools") or []:
                                if isinstance(sub_t, dict):
                                    fn_obj = sub_t.get("function") if isinstance(sub_t.get("function"), dict) else sub_t
                                    fn_name = fn_obj.get("name") or sub_t.get("name")
                                    fn_desc = fn_obj.get("description") or sub_t.get("description") or ""
                                    fn_params = fn_obj.get("parameters") or sub_t.get("parameters") or {"type": "object", "properties": {}}
                                    if fn_name:
                                        responses_tools.append({
                                            "type": "function",
                                            "name": fn_name,
                                            "description": fn_desc,
                                            "parameters": fn_params,
                                        })
                                        chat_tools.append({
                                            "type": "function",
                                            "function": {
                                                "name": fn_name,
                                                "description": fn_desc,
                                                "parameters": fn_params,
                                            }
                                        })
                        elif t_type == "function":
                            fn_obj = t.get("function") if isinstance(t.get("function"), dict) else t
                            fn_name = fn_obj.get("name") or t.get("name")
                            fn_desc = fn_obj.get("description") or t.get("description") or ""
                            fn_params = fn_obj.get("parameters") or t.get("parameters") or {"type": "object", "properties": {}}
                            if fn_name:
                                responses_tools.append({
                                    "type": "function",
                                    "name": fn_name,
                                    "description": fn_desc,
                                    "parameters": fn_params,
                                })
                                chat_tools.append({
                                    "type": "function",
                                    "function": {
                                        "name": fn_name,
                                        "description": fn_desc,
                                        "parameters": fn_params,
                                    }
                                })

                tool_calls_data = []
                out_content = ""
                used_method = "responses.create"

                tool_names_sent = [t.get("name") for t in responses_tools] if responses_tools else []
                print(f"[{time.strftime('%X')}] agents/run -> model={model_name}, tools_sent={len(responses_tools)} {tool_names_sent}")

                try:
                    # Gold Standard: Meta's official responses.create (supports input_file and tools simultaneously)
                    resp_kwargs = {
                        "model": model_name,
                        "instructions": system_prompt,
                        "input": [{"role": "user", "content": user_content}],
                    }
                    if responses_tools:
                        resp_kwargs["tools"] = responses_tools
                        # Note: parallel_tool_calls is not sent; Meta models default to parallel and some don't accept this param

                    print(f"[{time.strftime('%X')}] responses.create called with {len(resp_kwargs.get('tools', []))} tools")
                    with _MODEL_LOCK:
                        response = client.responses.create(**resp_kwargs)

                    text_parts = []
                    output_items = getattr(response, "output", []) or []
                    print(f"[{time.strftime('%X')}] responses.create output items: {[getattr(i, 'type', '?') for i in output_items]}")
                    for item in output_items:
                        i_type = getattr(item, "type", None)
                        if i_type == "function_call":
                            raw_name = getattr(item, "name", "")
                            call_id = getattr(item, "call_id", "") or getattr(item, "id", f"call_{len(tool_calls_data)}")
                            args = getattr(item, "arguments", "{}")
                            print(f"[{time.strftime('%X')}] responses.create -> tool_call: {raw_name}")
                            tool_calls_data.append({
                                "id": call_id,
                                "name": raw_name.split(".")[-1],
                                "raw_name": raw_name,
                                "arguments": args,
                            })
                        elif i_type == "message":
                            for c in getattr(item, "content", []) or []:
                                if getattr(c, "type", None) == "output_text":
                                    text_parts.append(getattr(c, "text", ""))

                    out_content = " ".join(text_parts).strip() or getattr(response, "output_text", "") or ""
                    print(f"[{time.strftime('%X')}] responses.create done -> tool_calls={len(tool_calls_data)}, text_len={len(out_content)}")

                except Exception as resp_err:
                    print(f"[{time.strftime('%X')}] responses.create FAILED ({resp_err}); falling back to chat.completions")
                    used_method = "chat.completions"
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt_text},
                    ]
                    call_kwargs = {
                        "model": model_name,
                        "messages": messages,
                    }
                    if chat_tools:
                        call_kwargs["tools"] = chat_tools
                        print(f"[{time.strftime('%X')}] chat.completions called with {len(chat_tools)} tools")
                    if temp is not None:
                        try:
                            call_kwargs["temperature"] = float(temp)
                        except Exception:
                            pass
                    try:
                        with _MODEL_LOCK:
                            response = client.chat.completions.create(**call_kwargs)
                        choice = response.choices[0]
                        out_content = choice.message.content or ""
                        tc_list = getattr(choice.message, "tool_calls", None) or []
                        print(f"[{time.strftime('%X')}] chat.completions done -> tool_calls={len(tc_list)}, text_len={len(out_content)}")
                        for tc in tc_list:
                            tool_calls_data.append({
                                "id": getattr(tc, "id", f"call_{len(tool_calls_data)}"),
                                "name": tc.function.name.split(".")[-1],
                                "raw_name": tc.function.name,
                                "arguments": tc.function.arguments,
                            })
                    except Exception as chat_err:
                        # do not silently drop tools and fall to text-only; surface the error
                        print(f"[{time.strftime('%X')}] chat.completions with tools FAILED ({chat_err}); returning error")
                        raise chat_err

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

            except (BrokenPipeError, ConnectionResetError):
                pass
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

                try:
                    self._set_cors_headers(status_code)
                    res = {
                        "status": "error",
                        "error": err_msg,
                        "http_code": status_code,
                        "duration_ms": duration_ms,
                    }
                    self.wfile.write(json.dumps(res).encode("utf-8"))
                except Exception:
                    pass
                print(f"[{time.strftime('%X')}] Agent model error -> HTTP {status_code} ({duration_ms}ms): {err_msg}")

        elif self.path in ["/api/chat/completions", "/api/meta/v1/chat/completions", "/v1/chat/completions"]:
            start_time = time.perf_counter()
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length)
                data = json.loads(body_bytes.decode("utf-8"))

                model_name = data.get("model", "muse-spark-1.3")
                if model_name in ["muse-wonder", "muse_wonder"]:
                    model_name = "muse-wonder-1.0"
                elif model_name in ["muse-spark", "muse_spark"]:
                    model_name = "muse-spark-1.3"
                elif model_name in ["muse-voice", "muse-voice-transcribe"]:
                    model_name = "muse-voice-transcribe-1.0"

                messages = enrich_messages_with_local_images(data.get("messages", []))
                tools_spec = data.get("tools")
                temp = data.get("temperature")
                reasoning = data.get("reasoning_effort")

                client = get_meta_client()
                if client is None:
                    raise RuntimeError("Meta client is not configured. Please ensure MODEL_API_KEY is configured in your .env file.")

                call_kwargs = {
                    "model": model_name,
                    "messages": messages,
                }
                if tools_spec:
                    call_kwargs["tools"] = tools_spec
                if temp is not None:
                    try:
                        call_kwargs["temperature"] = float(temp)
                    except Exception:
                        pass
                if reasoning:
                    call_kwargs["reasoning_effort"] = reasoning

                with _MODEL_LOCK:
                    response = client.chat.completions.create(**call_kwargs)

                choices_data = []
                for c in getattr(response, "choices", []):
                    msg = c.message
                    t_calls = []
                    for tc in getattr(msg, "tool_calls", None) or []:
                        raw_name = tc.function.name
                        norm_name = raw_name.split(".")[-1] if "." in raw_name else raw_name
                        t_calls.append({
                            "id": getattr(tc, "id", f"call_{len(t_calls)}"),
                            "type": "function",
                            "function": {
                                "name": norm_name,
                                "arguments": tc.function.arguments,
                            }
                        })
                    choices_data.append({
                        "index": getattr(c, "index", 0),
                        "message": {
                            "role": getattr(msg, "role", "assistant"),
                            "content": getattr(msg, "content", "") or "",
                            "tool_calls": t_calls if t_calls else None,
                        },
                        "finish_reason": getattr(c, "finish_reason", "stop"),
                    })

                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                res = {
                    "id": getattr(response, "id", f"chatcmpl_{int(time.time())}"),
                    "object": "chat.completion",
                    "created": getattr(response, "created", int(time.time())),
                    "model": model_name,
                    "choices": choices_data,
                    "duration_ms": duration_ms,
                }
                self._set_cors_headers(200)
                self.wfile.write(json.dumps(res).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Chat completion '{model_name}' -> HTTP 200 ({duration_ms}ms)")
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
                print(f"[{time.strftime('%X')}] Chat completion error -> HTTP {status_code} ({duration_ms}ms): {err_msg}")

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
        elif self.path == "/api/web/search":
            start_time = time.perf_counter()
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length)
                data = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}

                query = data.get("query", "").strip()
                if not query:
                    raise ValueError("Search query is required.")

                search_context_size = data.get("search_context_size", "medium")
                if search_context_size not in ["low", "medium", "high"]:
                    search_context_size = "medium"

                model_name = data.get("model", "muse-spark-1.3")
                client = get_meta_client()
                if client is None:
                    raise RuntimeError("Meta client is not configured. Ensure MODEL_API_KEY is set.")

                with _MODEL_LOCK:
                    res = client.responses.create(
                        model=model_name,
                        input=query,
                        tools=[{"type": "web_search", "search_context_size": search_context_size}],
                    )

                citations = []
                searched = any(getattr(item, "type", "") == "web_search_call" for item in getattr(res, "output", []))
                seen_urls = set()

                for item in getattr(res, "output", []):
                    if getattr(item, "type", "") != "message":
                        continue
                    for block in getattr(item, "content", []):
                        if getattr(block, "type", "") != "output_text":
                            continue
                        text = getattr(block, "text", "")
                        for ann in (getattr(block, "annotations", []) or []):
                            if getattr(ann, "type", "") == "url_citation":
                                url = getattr(ann, "url", "")
                                if url and url not in seen_urls:
                                    seen_urls.add(url)
                                    s_idx = getattr(ann, "start_index", 0)
                                    e_idx = getattr(ann, "end_index", len(text))
                                    passage = text[s_idx:e_idx] if 0 <= s_idx <= e_idx <= len(text) else ""
                                    citations.append({
                                        "title": getattr(ann, "title", "Web Source"),
                                        "url": url,
                                        "passage": passage.strip(),
                                    })

                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({
                    "status": "success",
                    "query": query,
                    "answer": getattr(res, "output_text", ""),
                    "searched": searched,
                    "citations": citations,
                    "duration_ms": duration_ms,
                }).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Web search '{query[:40]}' -> {len(citations)} citations ({duration_ms}ms)")
            except Exception as e:
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                err_msg = str(e)
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({
                    "status": "error",
                    "error": err_msg,
                    "duration_ms": duration_ms,
                }).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Web search error ({duration_ms}ms): {err_msg}")

        elif self.path == "/api/web/download":
            start_time = time.perf_counter()
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length)
                data = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}

                url = data.get("url", "").strip()
                if not url or not (url.startswith("http://") or url.startswith("https://")):
                    raise ValueError("A valid HTTP/HTTPS URL is required.")

                parsed = urllib.parse.urlparse(url)
                suggested_name = data.get("filename", "").strip()
                if not suggested_name:
                    path_name = os.path.basename(urllib.parse.unquote(parsed.path))
                    suggested_name = path_name if path_name and "." in path_name else f"download_{int(time.time())}.bin"

                clean_name = re.sub(r'[^\w\.\-\_]', '_', suggested_name)
                final_name = f"web_{int(time.time())}_{clean_name}"
                dest_path = os.path.join(DOCS_STORAGE_DIR, final_name)

                req = urllib.request.Request(url, headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                })

                with urllib.request.urlopen(req, timeout=30) as resp:
                    with open(dest_path, "wb") as out_f:
                        shutil.copyfileobj(resp, out_f)

                mime, _ = mimetypes.guess_type(dest_path)
                size_bytes = os.path.getsize(dest_path)
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

                self._set_cors_headers(200)
                self.wfile.write(json.dumps({
                    "status": "success",
                    "filename": clean_name,
                    "stored_filename": final_name,
                    "local_path": dest_path,
                    "url": f"http://{HOST}:{PORT}/storage/documents/{final_name}",
                    "mime_type": mime or "application/octet-stream",
                    "size_bytes": size_bytes,
                    "duration_ms": duration_ms,
                }).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Downloaded web file '{clean_name}' ({size_bytes} bytes, {duration_ms}ms)")
            except Exception as e:
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                err_msg = str(e)
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({
                    "status": "error",
                    "error": err_msg,
                    "duration_ms": duration_ms,
                }).encode("utf-8"))
                print(f"[{time.strftime('%X')}] Web download error ({duration_ms}ms): {err_msg}")
        else:
            self._set_cors_headers(404)
            self.wfile.write(json.dumps({"error": "Unknown POST route"}).encode("utf-8"))

    def log_message(self, format, *args):
        pass


def run_server():
    server_address = (HOST, PORT)
    httpd = ThreadingHTTPServer(server_address, EngineRequestHandler)
    print(f"Trex Engine Server running on http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.server_close()


if __name__ == "__main__":
    run_server()
