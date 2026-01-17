# MLCRemote Desktop App

## Overview

This Wails application serves as a desktop client for the MLCRemote backend. It manages the connection to a remote server, ensures the backend is installed, orchestrates an SSH tunnel, and displays the remote interface.

## Remote Connection Flow

The application implements a multi-stage connection process:

### 1. Connection Input
- **UI**: Displays a "Connect to Remote" screen.
- **Input**: 
  - Connection string: `user@host` (default port 22).
  - **SSH Key**: Optional file path to private key (e.g., `~/.ssh/id_rsa`).
- **Action**: User clicks "Connect".
- **Storage**: Last connected server and key path are saved.

### 2. SSH Verification & Connection
- The app establishes an SSH connection to the specified host.
- **Authentication**: 
  - If Key provided: Use that key.
  - Else: Try SSH Agent.
  - Else: Try default `~/.ssh/id_rsa`.
- **Status**: "Connecting to {host}..."

### 3. Backend Detection
- Once connected, the app checks for the existence of the backend binary on the remote server.
- **Check Command**: `test -f ~/.mlcremote/bin/dev-server` (executed via SSH shell).
- **Scenario A (Found)**: Proceed to **Step 5 (Tunnel)**.
- **Scenario B (Not Found)**: Proceed to **Step 4 (Installation)**.

### 4. Backend Installation (If missing)
- **UI**: Prompts the user: "Remote backend not found. Install now?"
- **Action**:
  1.  **Build**: Cross-compile the backend locally for Linux (amd64).
      - Source: `../../backend/cmd/dev-server`
      - **Assets**: Includes generated icons using `scripts/generate-icons.ps1`.
  2.  **Upload**: Transfer binary and frontend assets (atomic swap).
      - Uses `scp` to upload to a temp dir then swaps.
  3.  **Setup Service**: Create and start the SystemD user service.
      - Configure `~/.config/systemd/user/mlcremote.service`.
      - Run `systemctl --user daemon-reload`, `enable`, and `start`.
- **Status**: "Building...", "Uploading...", "Starting service..."

### 5. Tunnel Establishment
- Establish an SSH tunnel forwarding a local port to `remote:localhost:8443`.
- **Local Port**: User configurable in settings (default 8443).
- **Conflict Handling**: Uses `KillPort` logic to clear zombie processes on the local port.
- **Remote Port**: 8443 (default).
- **Status**: "Setting up secure tunnel..."

### 6. Health Check & Validation
- Check the health of the remote backend through the tunnel.
- **Request**: `GET http://localhost:{local_port}/health`
- **Retry**: Poll with backoff for up to 30 seconds.

### 7. App Ready
- **UI**: Switch the main view to display the remote web app.
- **URL**: `http://localhost:{local_port}/`
- **Behavior**: The Wails window now acts as a browser for the remote backend.

## Architecture

- **Frontend (Wails/React)**:
  - `Connect` Component: Text input for host.
  - `Status` Component: Visual connection steps (stepper or logs).
  - `App` Component: Logic to switch between "Connect" view and "Remote App" iframe/webview.
- **Backend (Wails/Go)**:
  - `App.Connect(host string)`: Trigger connection.
  - `App.CheckBackend()`: Returns installed status.
  - `App.InstallBackend()`: Triggers build & deploy.
  - `App.StartTunnel()`: Starts the tunnel.
  - `App.GetUrl()`: Returns the local URL.
