# mlcremote — ALPHA

ALPHA release: quickly iterate but expect breaking changes.

This repository contains a lightweight remote development environment:
- Backend: Go server exposing file and terminal APIs
- Frontend: React + Vite browser UI
- Desktop: Wails wrapper (planned)

Quick start

1. Build backend: `make backend`
2. Build frontend: `cd frontend && npm install && npm run build`
3. Run server: `./bin/dev-server --port 8443 --root $HOME --static-dir $(pwd)/frontend/dist`

License: MIT — Michael Lechner
