MLCremote — BETA

Lightweight remote development environment for small servers.

Status: BETA now — rapid iteration expected; the project is not production-ready. See status.

What it provides
- **Backend:** Go HTTP server exposing file and terminal APIs (PTY + WebSocket).
- **Frontend:** React + Vite single-page app for file browsing and editing.
- **Desktop:** Wails wrapper planned (future work).

Motivation

I run small virtual servers with very limited RAM and want an easy, low-overhead
web UI for quick file inspection and light editing when SSH + terminal is inconvenient.
This project is intentionally small and minimal so it can run on low-resource VMs.


Status

The server component is fully functional and I currently dont see any need for
additional endpoints. All endpoints are now documented and we can generate swagger
documentation from the source code.

The client for remote edit/view etc  works for my needs - but there are a lot of possible improvemenets.

The planned native app for remote managemenent caused more work than expected. For now
I added some bash scripts to ease the installation of the server on a remote host (using ssh).
Next steps will include a nice gui for all this - but for me it does not have high prioritry now.



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

Recent changes
----------------
- Authentication: the frontend supports token-based auth and password login. When a token is invalid or a request returns 401 the UI now prompts for re-authentication (either password or access key).
- Trash view: files deleted via the UI are moved to a server-side trash and a global "Trash" view is available in the top toolbar.
- Image preview: images render responsively with a max height (80vh) so they fit the viewport; the editor shows the natural image dimensions after the image loads.
- Swagger/OpenAPI: a Makefile target `swagger-gen` is included to generate OpenAPI docs from Go sources; generated files appear under `docs/`.

Notes for operators
-------------------
- To re-generate frontend assets after local changes:
	```bash
	cd frontend
	npm install
	npm run build
	```
- To generate/update the OpenAPI docs (requires Go tools):
	```bash
	make swagger-gen
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
	- Editor details: see `docs/EDITOR.md` for editor behavior, highlighting, and metadata handling.

License
- MIT — Michael Lechner


