#!/usr/bin/env python3
"""
Native macOS Host for Addereums Pomodoro.
Serves the web application locally on an ephemeral loopback port
and launches the standalone app window.
"""

import sys
import os
import subprocess
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# Paths
MACOS_DIR = Path(__file__).resolve().parent
RESOURCES_DIR = MACOS_DIR.parent / "Resources"
WEB_DIR = RESOURCES_DIR / "app" / "web"

if not WEB_DIR.exists():
    # Fallback to local dev layout
    WEB_DIR = Path(__file__).resolve().parents[2] / "app" / "web"


def start_server():
    class QuietHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(WEB_DIR), **kwargs)

        def log_message(self, format, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), QuietHandler)
    port = server.server_port
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server, port


def main():
    server, port = start_server()
    url = f"http://127.0.0.1:{port}/index.html"

    # 1. Prefer Chromium-based browsers in dedicated standalone app-window mode
    browsers = [
        "Microsoft Edge",
        "Google Chrome",
        "Brave Browser",
        "Chromium",
        "Vivaldi"
    ]

    for b in browsers:
        app_path = f"/Applications/{b}.app"
        if os.path.exists(app_path):
            try:
                proc = subprocess.Popen([
                    "open", "-na", b, "--args",
                    f"--app={url}",
                    "--window-size=680,820"
                ])
                # Keep server alive while user interacts
                server.serve_forever()
                return
            except Exception:
                pass

    # 2. Fallback to default browser or Safari
    subprocess.Popen(["open", url])
    server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
