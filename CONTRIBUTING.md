# Contributing to MLCRemote

Thank you for your interest in contributing! Below is the technical documentation needed to build and develop the project.

## Development Setup

**Prerequisites:**

 -   Go 1.24+ (required for backend/desktop modules)
 -   Node.js 20+
 -   Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
 -   **Task** (Build System): `go install github.com/go-task/task/v3/cmd/task@latest`
 -   Docker (Required for Linux cross-compilation)
 -   NSIS (Windows: For installer build)

 **Local Build & Run:**

 ```bash
 # See available targets
 task help

 # Full Desktop Build (Dev Mode with Hot Reload)
 task dev

 # Create Production Bundle (Windows)
 task dist

 # Create Full Release (Installer + Linux binary)
 task release
 ```

 *For detailed build documentation, see [BUILD.md](docs/BUILD.md).*

**Docker Development:**

For a fully isolated environment (recommended for testing backend changes):

```bash
task docker:dev
```
*See [DOCKER.md](DOCKER.md) for details.*

**Manual Build Components:**

-   **Backend (Linux):**
    ```bash
    GOOS=linux GOARCH=amd64 go build -o bin/dev-server ./backend/cmd/dev-server
    ```
-   **Frontend:**
    ```bash
    cd frontend && npm install && npm run build
    ```

**Architecture:**

-   **Backend (Remote):** A single static Go binary (`dev-server`) providing API + PTY.
-   **Frontend (UI):** React + Vite SPA, served locally by the desktop app.
-   **Desktop (Local):** Wails (Go) application handling SSH tunnels, window management, and native integration.
