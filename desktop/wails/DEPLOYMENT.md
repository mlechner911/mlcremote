# Desktop App to Remote Server Deployment Process

This document describes exactly how the desktop application automates the deployment of the backend server and frontend assets to a remote Linux host.

## Overview

The deployment logic is contained within the `InstallBackend` function in `desktop/wails/internal/app/backend.go`. It performs the following steps over an SSH connection:

1.  **Cross-Compilation**: Build the Go backend for the target architecture.
2.  **Environment Setup**: Create necessary remote directories.
3.  **Service Stoppage**: Ensure the file system is unlocked.
4.  **File Transfer**: Upload binaries, scripts, and frontend assets via SCP.
5.  **Service Registration**: Configure and start a `systemd` user service.

## 1. Directory Structure

The deployment uses a centralized directory in the user's home folder. Consts are defined in `internal/app/constants.go`.

| Local Constant | Value | Description |
| :--- | :--- | :--- |
| `RemoteBaseDir` | `~/.mlcremote` | Root configuration directory |
| `RemoteBinDir` | `~/.mlcremote/bin` | Executables and scripts |
| `RemoteFrontendDir` | `~/.mlcremote/frontend` | Static assets (HTML/JS/CSS) |
| `SystemdUserDir` | `~/.config/systemd/user` | Systemd unit file location |

## 2. Compilation (Local)

Before connecting, the desktop app builds the backend binary locally:

-   **Source**: `backend/cmd/dev-server`
-   **Output**: `bin/dev-server`
-   **Environment**: `GOOS=linux`, `GOARCH=amd64` (Cross-compiled for Linux servers)
-   **Flags**: `-ldflags "-s -w"` (Strip symbols for smaller size)

## 3. Remote Setup & Upload

The app executes the following sequence:

### A. Prepare Directories
Runs `mkdir -p` to ensure all remote paths exist:
```bash
mkdir -p ~/.mlcremote/bin ~/.mlcremote/frontend ~/.config/systemd/user
```

### B. Stop Existing Service
To prevent "Text file busy" errors when overwriting the binary, it attempts to stop the service:
```bash
systemctl --user stop mlcremote.service
```
*(Ignores errors if the service doesn't exist yet)*

### C. Upload Files (SCP)
1.  **Backend Binary**: `dev-server` &rarr; `~/.mlcremote/bin/dev-server`
2.  **Frontend Assets**: Recursive copy of the local **IDE Frontend build** (`../../frontend/dist`) &rarr; `~/.mlcremote/frontend`.
    *   *Note: This is the main IDE interface, not the desktop dashboard.*
3.  **Startup Script**: A generated `run-server.sh` wrapper is uploaded to `~/.mlcremote/run-server.sh`.

### D. Startup Script Logic (`run-server.sh`)
This script serves as the entry point for the service:
```bash
#!/usr/bin/env bash
cd "$HOME"
exec "$HOME/.mlcremote/bin/dev-server" \
  --port 8443 \
  --root "$HOME" \
  --static-dir "$HOME/.mlcremote/frontend" \
  --no-auth
```
-   **`--static-dir`**: Serves the uploaded frontend assets.
-   **`--no-auth`**: Disables backend authentication (security is handled by the SSH tunnel).

## 4. Service Configuration (Systemd)

A `mlcremote.service` unit file is generated and uploaded to `~/.config/systemd/user/mlcremote.service`.

```ini
[Unit]
Description=mlcremote user service
After=network.target

[Service]
Type=simple
ExecStart=%h/.mlcremote/run-server.sh
Restart=on-failure

[Install]
WantedBy=default.target
```
*Note: `%h` is systemd syntax for the user's home directory.*

## 5. Activation

Finally, the service is enabled and force-restarted to apply changes:

```bash
systemctl --user daemon-reload
systemctl --user enable mlcremote.service
systemctl --user restart mlcremote.service
```

## Summary of Remote Footprint

After a successful deployment, the remote server will contain:

-   `~/.mlcremote/bin/dev-server`: The binary.
-   `~/.mlcremote/run-server.sh`: The startup script.
-   `~/.mlcremote/frontend/*`: The web interface assets.
-   `~/.config/systemd/user/mlcremote.service`: The service definition.
-   **Process**: A user-level process `dev-server` listening on port `8443` (localhost only).
