MLCRemote — Desktop

Lightweight remote development environment for small servers, wrapped in a native desktop application.

**Status:** Production Ready (v1.0.0)

## Features
- **Native Desktop App:** Windows, macOS, and Linux support via Wails.
- **Zero-Setup Remote:** Automatically deploys a standalone Golang binary to the remote server.
- **SSH Tunneling:** Securely connects via SSH tunnels; no open ports required on the remote.
- **Rich File Manager:**
    - Drag & Drop Upload
    - Context Menu (Download, Delete, Copy Path)
    - Trash Support (Safety first!)
- **Integrated Terminal:** Full PTY support with resize handling and correct encoding.
- **Profile Manager:** Save connection details with color-coding and metadata (OS/Arch/Version, Last Seen).
- **Workspace Persistence:** Remember open files and layout per server profile.
- **Split View:** Multi-pane editor support.
- **Smart Launch UI:** Futuristic "Blueprint" design with connection locking and state feedback.
- **Graceful Shutdown:** Safely closes tunnels and connections on exit.
- **Smart Symlinks:** Visual indicators for symlinks, broken links, and external targets.

## Screenshots

<p align="center">
  <img src="screenshots/startup.png" width="45%" alt="Connection Screen">
  <img src="screenshots/remote_terminal.png" width="45%" alt="Remote Terminal">
</p>
<p align="center">
  <img src="screenshots/example.png" width="45%" alt="File Editor">
  <img src="screenshots/image_preview.png" width="45%" alt="Image Preview">
</p>

## Quick Start (Desktop)

1. **Download** the latest release for your OS.
2. **Run** the application.
3. **Connect** to your server:
    - Enter `User` (e.g., `root` or `ubuntu`) and `Host` (IP or domain).
    - Provide an SSH key path (optional) or use password auth.
    - Click **Connect**. The app will automatically check for the backend and install/update it if needed.

## Development

**Prerequisites:**
- Go 1.20+
- Node.js 18+
- Wails (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- Make (Windows: via Chocolatey or Scoop, or Git Bash)

**Build & Run:**

```bash
# Full Desktop Build (Dev Mode)
make debug

# Create Production Bundle (Windows)
make desktop-dist-zip
```

**Architecture:**

- **Backend (Remote):** A single static Go binary (`dev-server`) providing API + PTY.
- **Frontend (UI):** React + Vite SPA, served locally by the desktop app.
- **Desktop (Local):** Wails (Go) application handling SSH tunnels, window management, and native integration.

## License
MIT — Michael Lechner


