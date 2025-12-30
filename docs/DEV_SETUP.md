# Development setup

This document describes the tools used in the project and step-by-step instructions to set up a local development environment for the frontend and backend.

## Tools used

- Go 1.21+ for the backend
- Node.js 18+ for the frontend (use nvm to manage Node versions)
- npm (bundled with Node) for frontend package management
- Vite for frontend dev server and build
- React 18 + TypeScript for frontend code
- xterm.js for terminal UI, Prism for syntax highlighting
- gorilla/websocket and creack/pty for backend PTY and websocket handling

## Local setup

1. Clone the repository and change to project root:

```bash
git clone <repo-url>
cd mlcremote
```

2. Backend

- Build:
```bash
cd backend
go build -o ../bin/dev-server ./cmd/dev-server
```
- Run (binds to localhost):
```bash
./bin/dev-server
```

3. Frontend

- Install dependencies:
```bash
cd frontend
npm install
```
- Run development server:
```bash
npm run dev
```
- Build production bundle:
```bash
npm run build
```

4. Running end-to-end locally

- Start the backend binary (see above) and then start the frontend dev server. Open `http://localhost:5173` (or the port Vite reports).
- The backend listens on localhost; this makes SSH tunneling optional for local development. For remote hosts, use an SSH tunnel:

```bash
ssh -L 8443:localhost:8443 user@remote
# then open https://localhost:8443
```

## Notes
- The frontend uses the Clipboard API which requires a secure context for reads/writes in some browsers. `localhost` is usually permitted.
- Terminal sessions are backed by server-side PTYs. Tabs keep their terminal components mounted to preserve buffers. To reduce server resource usage consider implementing a session-suspend/reattach flow.

## Useful commands

- Build both projects:
```bash
make backend && cd frontend && npm run build
```
