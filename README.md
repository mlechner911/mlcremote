MLCremote — BETA

Lightweight remote development environment for small servers.

Status: BETA now — rapid iteration expected; the project is not production-ready. See status.

What it provides
- **Backend:** Go HTTP server exposing file and terminal APIs (PTY + WebSocket).
- **Frontend:** React + Vite single-page app for file browsing and editing.
- **Desktop:** Native Wails application (Windows) for seamless remote management.

## Screenshots

<p align="center">
  <img src="screenshots/startup.png" width="45%" alt="Connection Screen">
  <img src="screenshots/remote_terminal.png" width="45%" alt="Remote Terminal">
</p>
<p align="center">
  <img src="screenshots/example.png" width="45%" alt="File Editor">
  <img src="screenshots/image_preview.png" width="45%" alt="Image Preview">
</p>

## Motivation

I run small virtual servers with very limited RAM and want an easy, low-overhead
web UI for quick file inspection and light editing when SSH + terminal is inconvenient.
This project is intentionally small and minimal so it can run on low-resource VMs.


Status

The server component is fully functional and I currently dont see any need for
additional endpoints. All endpoints are now documented and we can generate swagger
documentation from the source code.

The client for remote edit/view etc  works for my needs - but there are a lot of possible improvemenets.

The native desktop app is now fully functional. With help from AI I was finally able to create the Windows executable ;)

Thanks "Gemini" for that.(I am really bad with windows development)



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
- **Remote Launch UI**: A new desktop startup experience allows multiple connection profiles.
- **Auto-Update**: The desktop app now checks the remote backend version on connection and offers to update it automatically.
- **Launch Security**: SSH connections now strictly enforce backend version compatibility (v1.0.0+ required).
- Authentication: the frontend supports token-based auth and password login...
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


