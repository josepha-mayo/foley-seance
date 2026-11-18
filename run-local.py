#!/usr/bin/env python3
"""Serve only Foley's static assets on this computer. No audio upload API."""
import argparse
import hashlib
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit
import webbrowser

ASSETS = ("engine/wav-additive.mjs", "index.html", "style.css", "app.mjs", "engine/foley-engine.mjs", "engine/audition-core.mjs", "engine/audition-controller.mjs", "engine/audition-worker.mjs", "engine/waveform-view.mjs", "engine/project-file.mjs", "engine/monitor-player.mjs", "engine/custom-motion.mjs", "engine/motion-stroke.mjs", "engine/door-envelope.mjs")
TYPES = {".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".mjs":"text/javascript; charset=utf-8"}

def verify_bundle(root):
    root = Path(root).resolve()
    for name in ASSETS:
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError("Missing or invalid app asset: " + name)
    manifest = root.parent / "bundle-manifest.json"
    if manifest.exists():
        expected = json.loads(manifest.read_text(encoding="utf-8"))
        if not isinstance(expected, dict) or set(expected) != set(ASSETS):
            raise ValueError("Bundle manifest does not match app assets")
        for name in ASSETS:
            if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected[name]:
                raise ValueError("Bundle file differs from manifest: " + name)
    return root

def handler_for(root):
    root = Path(root).resolve()
    class StaticOnly(BaseHTTPRequestHandler):
        def do_GET(self): self.serve(False)
        def do_HEAD(self): self.serve(True)
        def log_message(self, *args): pass
        def serve(self, head):
            try:
                path = unquote(urlsplit(self.path).path)
                name = "index.html" if path == "/" else path.removeprefix("/")
                if name not in ASSETS: self.send_error(404); return
                file = (root / name).resolve()
                if not file.is_relative_to(root) or not file.is_file(): self.send_error(404); return
                data = file.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", TYPES[file.suffix])
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                if not head: self.wfile.write(data)
            except (ValueError, OSError):
                self.send_error(404)
    return StaticOnly

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-browser", action="store_true", help="Print the local URL without opening a browser")
    parser.add_argument("--check", action="store_true", help="Verify packaged assets without starting a server")
    args = parser.parse_args()
    if sys.version_info < (3, 9):
        parser.exit(2, "Python 3.9 or newer is required. No installation is attempted.\n")
    try: root = verify_bundle(Path(__file__).resolve().parent / "dist")
    except (ValueError, OSError, json.JSONDecodeError) as error: parser.exit(2, str(error) + "\n")
    if args.check:
        print("Foley static bundle verified. No server started.")
        return
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(root))
    server.daemon_threads = True
    url = "http://127.0.0.1:%d/" % server.server_port
    print("Foley Seance: " + url, flush=True)
    print("Local computer only. Keep this window open; press Ctrl+C to stop. Audio stays in your browser.", flush=True)
    if not args.no_browser:
        try: webbrowser.open(url)
        except webbrowser.Error: print("Open the printed URL in your browser.", flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == "__main__": main()
