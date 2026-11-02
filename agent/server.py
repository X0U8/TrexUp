#!/usr/bin/env python3
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
