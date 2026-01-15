# Build & Development Guide

This project uses [Task](https://taskfile.dev/) (go-task) for build automation. This replaces the old `Makefile` system to ensure cross-platform compatibility (Windows, Linux, macOS).

## Prerequisites

1.  **Go**: [Install Go](https://go.dev/dl/) (1.21+)
2.  **Node.js**: [Install Node.js](https://nodejs.org/) (20+)
3.  **Task**: Install `go-task`:
    ```bash
    go install github.com/go-task/task/v3/cmd/task@latest
    ```
4.  **Wails**: Install the Wails CLI:
    ```bash
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    ```

## Quick Start

- **Start Dev Server**: `task dev`
- **Build Release**: `task dist` (builds for your current OS)

## Command Reference

### Development

| Command | Description |
| :--- | :--- |
| `task dev` | Runs the full desktop application in development mode with HMR. Automatically builds all necessary backend payloads first. |
| `task deps` | Downloads Go and NPM dependencies for all subprojects (`backend`, `frontend`, `desktop/wails`). |
| `task icons` | Regenerates frontend components from SVG icons in `icons/raw`. Run this if you add new icons. |

### Building & Distribution

| Command | Description |
| :--- | :--- |
| `task dist` | Builds the production binary for your **current operating system**. Artifacts are placed in `dist/`. |
| `task dist:package` | Helper task that copies the built binaries from the Wails build folder to the root `dist/` folder. |
| `task release` | **Full Release Pipeline**. Builds: <br> 1. Windows Installer (`.exe`) <br> 2. Linux Binary (via Docker) <br> 3. Windows Binary |
| `task installer` | (Windows Only) Builds the NSIS installer. Requires NSIS to be installed. |

### Cross-Platform Payloads
These tasks compile the helper binaries (`dev-server`, `md5-util`) that are embedded into the desktop app so it can deploy them to remote servers.

| Command | Description |
| :--- | :--- |
| `task payload:all` | Builds backend payloads for **Linux**, **Windows**, and **macOS** (AMD64 & ARM64). |
| `task payload:linux` | Builds Linux amd64 backend binaries. |
| `task payload:windows` | Builds Windows amd64 backend binaries. |
| `task payload:mac:amd64` | Builds macOS Intel backend binaries. |
| `task payload:mac:arm64` | Builds macOS Apple Silicon backend binaries. |

### Docker

| Command | Description |
| :--- | :--- |
| `task linux:bin` | Uses Docker to build the Linux desktop binary. Useful if you are on Windows but want to build for Linux. |

### Cleanup

| Command | Description |
| :--- | :--- |
| `task clean` | Removes all build artifacts (`bin/`, `dist/`, `frontend/dist`, etc.). |

## Release Workflow

To create a full release (e.g., v1.2.1):

1.  **Update Version**: Update version numbers in `wails.json`.
2.  **Update Docs**: Add release notes to `docs/USER_GUIDE_*.md`.
3.  **Run Tag**: `git tag v1.2.1`
4.  **Build Release**:
    ```bash
    task release
    ```
5.  **Check Output**: Artifacts will be in `dist/`.
