# Development setup

This document describes the tools used in the project and step-by-step instructions to set up a local development environment for the frontend and backend.

## Tools used

- Go 1.21+ for the backend
- Node.js 18+ for the frontend (use nvm to manage Node versions)
- npm (bundled with Node) for frontend package management
- Vite for frontend dev server and build
- React 18 + TypeScript for frontend code
- xterm.js for terminal UI, Prism for syntax highlighting
- Gorilla/websocket and creack/pty for backend PTY and websocket handling
- Task (go-task) for build automation and cross-platform scripts

## Setup

1. **Install Go and Node.js** as per "Tools used".
2. **Install Task**:
   ```bash
   go install github.com/go-task/task/v3/cmd/task@latest
   ```
   (Or see [installation guide](https://taskfile.dev/installation/) for other methods)


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

- **Start Development Mode (Backend + Frontend + Wails):**
  ```bash
  task dev
  ```

- **Build everything (Production):**
  ```bash
  task dist
  ```

- **Build Installer (Windows):**
  ```bash
  task installer
  ```

- **Build Backend Manual:**
  ```bash
  cd backend && go build ...
  ```

## Desktop (Wails) on Linux

To build and run the desktop app on Linux, install native GUI dev packages first:

- Quick install via helper:
```bash
sudo desktop/wails/scripts/install-linux-deps.sh
```
- Or use Make:
```bash
make desktop-deps
```

Then build:
```bash
# Build desktop (auto-detects WebKitGTK version and tags)
make desktop-build

# Development mode (runs Wails dev + Vite dev server)
make debug
```

If you prefer Docker for a Linux binary without local GUI deps:
```bash
make build-linux
ls dist/linux
```

### Headless Environments (e.g., SSH / Remote Dev)

If you are developing on a headless Linux server (via SSH or VS Code Remote) and want to test the full desktop app:

1.  **Install Xvfb** (Virtual Framebuffer):
    ```bash
    sudo apt-get install xvfb
    ```
2.  **Run with Xvfb**:
    ```bash
    xvfb-run task dev
    ```
3.  **Connect via Browser**:
    - The output will show a local URL, usually `http://localhost:34115`.
    - **Forward this port** (34115) to your local machine (VS Code usually does this automatically).
    - Open `http://localhost:34115` in your local Chrome/Edge.
    - Wails will bridge the WebSocket connection, allowing functionality like "Save Profile" to work even in the browser.

> **Note**: Do *not* open the Vite URL (port 5173/5174) directly for testing app logic. It lacks the Wails runtime bridge. Always use the Wails asset server port (34115).

Remote desktop testing (Windows → Linux)
- Start xpra on the remote and attach from Windows:
```bash
# On remote Linux (bind to localhost; use SSH tunnel)
xpra start :100 --start=./dist/desktop-linux-$(uname -m)/MLCRemote --bind-tcp=127.0.0.1:10000 --exit-with-children
```
```powershell
# On Windows (SSH tunnel + attach)
ssh -L 10000:127.0.0.1:10000 user@remote-host
xpra.exe attach tcp:localhost:10000
```
- Convenience target:
```bash
make remote-xpra REMOTE=user@remote-host REMOTE_DIR=/full/path/to/mlcremote
# Bind to all interfaces (no tunnel; ensure firewall):
make remote-xpra REMOTE=user@remote-host REMOTE_DIR=/full/path/to/mlcremote REMOTE_BIND=0.0.0.0:10000
```
