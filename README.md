MLCRemote — Desktop
===================

Lightweight remote development environment for small servers, wrapped in a native desktop application.

**Status:** Production Ready (v1.0.1)

## Features

-   **Native Desktop App:** Windows, macOS, and Linux support via Wails.
-   **Zero-Setup Remote:** Automatically deploys a standalone Golang binary to the remote server.
-   **SSH Tunneling:** Securely connects via SSH tunnels; no open ports required on the remote.
-   **Rich File Manager:**
    -   Drag & Drop Upload
    -   Context Menu (Download, Delete, Copy Path)
    -   Trash Support (Safety first!)
    -   Smart Symlinks with visual validation
-   **Integrated Terminal:** Full PTY support with resize handling and correct encoding.
-   **Profile Manager:**
    -   Save connection details with color-coding
    -   Duplicate profile detection
    -   Metadata tracking (OS/Arch/Version, Last Seen)
-   **Workspace Persistence:** Remembers open files and layout per server profile.
-   **Split View:** Multi-pane editor support.
-   **Smart Launch UI:** Futuristic "Blueprint" design with connection locking and state feedback.
-   **Graceful Shutdown:** Safely closes tunnels and connections on exit.

## Screenshots

<p align="center">
  <img src="screenshots/startup.png" width="45%" alt="Connection Screen">
  <img src="screenshots/remote_terminal.png" width="45%" alt="Remote Terminal">
</p>
<p align="center">
  <img src="screenshots/example.png" width="45%" alt="File Editor">
  <img src="screenshots/image_preview.png" width="45%" alt="Image Preview">
</p>

## Quick Start (Desktop) - **Recommended**

> [!IMPORTANT]
> **Windows Users:** Please use the pre-built installer (`MLCRemote-amd64-installer.exe`) available in the [Releases](https://github.com/mlechner911/mlcremote/releases) section or the `dist/` folder.
> Building from source is **not required** and is intended for contributors only.

1.  **Download** the latest installer for your OS (Windows).
2.  **Run** the installer and launch the application.
3.  **Connect** to your server:
    -   Enter `User` (e.g., `root` or `ubuntu`) and `Host` (IP or domain).
    -   **Authentication:**
        -   **Managed Identity:** (Recommended) Let the app manage a secure key for you.
        -   **System Agent:** Use your local SSH agent or default keys (`~/.ssh/id_rsa`).
        -   **Custom Key:** Select a specific `.pem` or key file.
    -   Click **Connect**. The app will automatically check for the backend and install/update it if needed.

## Development

**Prerequisites:**
 
 -   Go 1.24+ (required for backend/desktop modules)
 -   Node.js 20+
 -   Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
 -   Make (Windows: via Chocolatey, Scoop, or use provided `scripts/make-help.ps1`)
 -   Docker (Required for `make build-linux` target)
 -   NSIS (Windows: For installer build, standard install path supported)
 
 **Local Build & Run:**
 
 ```bash
 # See available targets
 make help
 
 # Full Desktop Build (Dev Mode with Hot Reload)
 make debug
 
 # Create Production Bundle (Windows)
 make installer
 
 # Cross-compile for Linux (Requires Docker)
 make build-linux
 ```

**Docker Development:**

For a fully isolated environment (recommended for testing backend changes):

```bash
make docker-dev
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

## Security

### Managed SSH Keys
When using "Managed Identity", the application generates a **passwordless** Ed25519 SSH key pair stored securely in your OS user's configuration directory (`~/.config/MLCRemote/keys/` or `%APPDATA%\MLCRemote\keys\`).

**Why no passphrase?**
This key is designed for automated, seamless background connection to your remote server. Requiring a passphrase would interrupt the connection flow every time you launch the app or reconnect. Since the key is generated with strict file permissions (0600) and stored in your user profile, it effectively inherits the security of your OS login.

For higher security environments, we recommend configuring **SSH Key Restrictions** to limit what this key can do (see [SSH Security Setup](docs/SSH_SECURITY_SETUP.md)).

## License

MIT — Michael Lechner


