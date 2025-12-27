mlcremote — ALPHA

Lightweight remote development environment for small servers.

Status: ALPHA — rapid iteration expected; the project is not production-ready.

What it provides
- **Backend:** Go HTTP server exposing file and terminal APIs (PTY + WebSocket).
- **Frontend:** React + Vite single-page app for file browsing and editing.
- **Desktop:** Wails wrapper planned (future work).

Motivation

I run small virtual servers with very limited RAM and want an easy, low-overhead
web UI for quick file inspection and light editing when SSH + terminal is inconvenient.
This project is intentionally small and minimal so it can run on low-resource VMs.

Quick start (development)

Prerequisites:
- Go 1.20+ for the backend
- Node.js 18+ and npm for the frontend

Build and run locally:

```bash
# build backend
make backend

# build frontend (from repo root)
cd frontend && npm install && npm run build

# run the dev server (from repo root)
./bin/dev-server --port 8443 --root "$HOME" --static-dir "$(pwd)/frontend/dist"
```

Notes on running
- The server listens on localhost by default (`127.0.0.1:<port>`).
- Use the UI served from `--static-dir` for the frontend experience.
- Press Ctrl-C (SIGINT) or send SIGTERM to the process to trigger a graceful
	shutdown. The server will attempt to terminate any running shells and close
	active websocket connections before exiting.

Security & caveats
- This project is an ALPHA developer tool — do not expose it to untrusted networks.
- No authentication is provided by default; run it only in trusted environments.

Contributing
- Issues and PRs are welcome. See the `docs/` folder for developer notes.

License
- MIT — Michael Lechner


