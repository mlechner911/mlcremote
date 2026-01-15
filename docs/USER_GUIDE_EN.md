# MLCRemote User Guide

Welcome to the **MLCRemote** User Guide. This document provides everything you need to know to install, configure, and use MLCRemote for your remote development workflows.

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Getting Started](#getting-started)
   - [Connecting to a Server](#connecting-to-a-server)
   - [Authentication Methods](#authentication-methods)
4. [Features](#features)
   - [File Explorer](#file-explorer)
   - [Integrated Terminal](#integrated-terminal)
   - [Profile Management](#profile-management)
   - [Split View](#split-view)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)

---

## Introduction

**MLCRemote** is a lightweight, native desktop application designed for **System Administrators** and **DevOps Engineers**. It simplifies remote server management by wrapping a fast editor in a native window, perfect for quick configuration changes, log analysis, and system updates.

**Key Benefits:**
- **Zero-Setup**: No manual installation required on the server.
- **Secure**: All traffic is encrypted via SSH tunnels.
- **Native Experience**: Fast, responsive desktop UI with OS integration.
- **Admin Focused**: Ideal for editing `/etc/` config files, checking `systemd` logs, or running maintenance scripts.

## Release Notes (v1.2.1)
- **Fixed**: Resolved issue where remote processes (e.g., `btop`) would remain running as zombies after the session was closed. The system now correctly terminates the entire process group.
- **Fixed**: Restored drag-and-drop file upload functionality in the sidebar.
- **Fixed**: Replaced "Copy/Paste" text buttons in terminal with proper icons.

## Installation

### Windows
1. Download the latest `MLCRemote-Windows-x64.zip` from the Releases page.
2. Extract the contents to a folder of your choice (e.g., `C:\Apps\MLCRemote`).
3. Double-click `MLCRemote.exe` to launch the application.
   > **Note**: You may see a SmartScreen warning safely ignore it by clicking "More Info" -> "Run Anyway" (as the binary is not signed).

### macOS / Linux
Currently, MLCRemote must be built from source for these platforms.
1. Ensure you have Go 1.21+ and Node.js 18+ installed.
2. Clone the repository and run:
   ```bash
   make debug
   ```
   ```
   *Official binaries for macOS and Linux are coming soon.*

   **Important for Linux/WSL Users**:
   If you experience rendering issues (e.g., text showing as boxes "tofu" or missing cursors), please ensure you have the standard font sets installed:
   ```bash
   sudo apt install fonts-noto fonts-liberation fontconfig
   ```

---

## Getting Started

### Connecting to a Server

When you first launch MLCRemote, you will see the **Launch Screen**.

1. Click the **New Connection** (+) button in the sidebar.
2. The **Profile Editor** will open with three tabs:
   - **General**:
     - **Name**: A friendly name for this server.
     - **Color**: Identify this profile easily.
     - **User**: The SSH username (e.g., `root`).
     - **Host**: IP address or domain.
     - **Port**: SSH port (Default: `22`).
     - **Auth Method**: Choose between Agent, Custom Key, or Managed Identity.
   - **Extended**:
     - **Default Shell**: Specify a preferred shell (e.g., `bash`, `zsh`) or leave empty for auto-detection.
   - **Quick Jobs**:
     - Define custom tasks to run on this server (see [Quick Tasks](#configuring-quick-tasks)).
3. Click **Save Connection**.
   > **Note**: If a profile with the same User, Host, and Port already exists, you will be asked if you want to update the existing one or create a new duplicate.
5. Select the profile from the list and click **Connect**.

The application will:
1. Establish a secure SSH connection.
2. Check if the MLCRemote backend is installed on the server.
3. Automatically deploy/update the backend if needed.
4. Open the remote environment.

### Session Management

If MLCRemote detects an existing backend session on the server, you will be presented with the following options:

*   **Join Session**: Connect to the running session. Useful if you accidentally closed the app.
*   **Restart Session**: Terminates the existing backend and starts a fresh one. Use this if the backend is unresponsive.
*   **Start New Instance**: Starts a *parallel* backend instance on a different port. Use this to run multiple independent sessions on the same server simultaneously.

**Token Sharing**:
Once connected, you can click the **Share Session** button (Key icon) in the top header to copy the secure session token. You can share this with colleagues who have SSH access to the server so they can connect to your session.

### Authentication Methods

MLCRemote supports three primary authentication methods:

1.  **Managed Identity (Premium)**:
    *   The most secure and convenient option. MLCRemote generates and manages a dedicated Ed25519 SSH key for you.
    *   **Setup**: Enter your password once, and the app will automatically configure the server for password-less access.
    *   **Indicator**: A blue "Managed" badge appears on the launch screen for these connections.

2.  **System Agent / Default**:
    *   Uses your system's SSH agent or default key locations (e.g., `~/.ssh/id_rsa`, `~/.ssh/id_ed25519`).
    *   Recommended if you already have SSH keys configured.

3.  **Custom Key File**:
    *   Select a specific private key file (`.pem`, `id_rsa`, etc.) from your computer.

4.  **Password Fallback**:
    *   If key authentication fails or is not configured, you will be prompted for the SSH password.
    *   **Feature**: You can easily upgrade to a Managed Identity or deploy your local key directly from the password prompt.

---

## Features

### File Explorer
The **File Explorer** (left pane) allows you to manage remote files.
- **Navigation**: Click folders to navigate. use the Breadcrumbs at the top to jump back.
- **Editing**: Click a file to open it in the Editor.
- **Context Menu**: Right-click any item to:
  - **Download**: Save the file to your local machine.
  - **Copy Path**: Copy the full remote path.
  - **Delete**: Remove the file/folder (moved to Trash).
- **Upload**: Drag and drop files from your computer into the Explorer area to upload them.

### Integrated Terminal
Access the server's command line directly.
- **Tabs**: Open multiple terminal tabs for different tasks.
- **Resize**: The terminal automatically resizes to fit the window.
- **Copy/Paste**: Standard shortcuts (`Ctrl+Shift+C/V` or `Cmd+C/V`) and UI buttons are supported.

### Profile Management
- **Metadata**: The app automatically detects and saves the remote OS (e.g., "Ubuntu 22.04") and the last connection time.
- **Sort**: Profiles are automatically sorted by "Last Used".
- **Edit/Delete**: Use the icons in the sidebar to manage your saved profiles.

### Tabs and Split View
Increase productivity by viewing files and terminals side-by-side.

- **Tabs**: Open multiple files simultaneously. Drag tabs to reorder them using the handle.
- **Split View**: Right-click a tab and select **Split Right** or **Split Down** to create a new pane.
- **Resizing**: Drag the dividers between panes to adjust their size.
- **Context Menu**: Right-click tabs to Close Others, Close to Right, etc.

### Activity Bar
The narrow bar on the far left provides quick access to key features:

- **File Explorer**: Default view for your remote files.
- **Quick Tasks**: Launch frequently used commands with a single click.
- **New Terminal**: Instantly opens a new SSH terminal.
- **Trash**: Access deleted remote files.
- **Settings**: Configure app settings and profiles.

#### Configuring Quick Tasks
You can define Quick Tasks directly in the **Profile Editor** under the **Quick Jobs** tab.
-   Click **Add Task**.
-   **Name**: Display name for the button.
-   **Command**: The shell command to execute on the server.
-   **Icon/Color**: Customize the appearance.
-   **Show on Launch**: Check this to make the task available on the Launch Screen for instant execution before connecting fully.

Alternatively, you can edit `tasks.json` manually if preferred. Here are some examples:

```json
[
  {
    "name": "Session Manager",
    "command": "tmux attach || tmux new",
    "icon": "server",
    "color": "#00ff00"
  },
  {
    "name": "SQL Backup",
    "command": "mysqldump -u root -p my_db > backup.sql && echo 'Backup done!'",
    "icon": "database",
    "color": "#ff0000"
  },
  {
    "name": "System Status",
    "command": "htop",
    "icon": "chart-bar",
    "color": "#0099ff"
  }
]
```

---

## Troubleshooting

### "Connection Refused"
- Ensure the server is online.
- Verify the SSH port is correct (default 22).
- Check your local firewall settings.

### "Agent Deployment Failed"
- Ensure the user has permission to write to their home directory (`~/`).
- If the server has limited disk space, free up some space.
- Windows Servers: Ensure PowerShell is available.

### "WebSocket Error"
- Make sure you are using the latest version of the desktop app.
- This often indicates a version mismatch between the local app and the remote backend. The app should auto-update the backend, but you can force it by deleting `~/.mlcremote` on the server.

---

## FAQ

**Q: Is my master password sent to the server?**
A: **No.** The App Lock (Master Password) is purely local to encrypt your connection profiles on your computer.

**Q: Where are my profiles stored?**
A: Only on your local machine in the application data directory.

**Q: Can multiple users connect to the same server?**
A: **Yes.** MLCRemote now supports multi-user sessions with secure token authentication.

**Q: Can I run multiple instances of MLCRemote?**
A: **Yes.** You can open multiple windows (by launching the app multiple times) to connect to different servers or the same server simultaneously. Each instance uses its own secure, conflict-free tunnel.

**Q: Why does it ask for my password?**
A: MLCRemote asks for your SSH password **only once** for each new server to securely install your public key or Managed Identity. Subsequent connections are password-less. We do not store your SSH password.

### Language Support
-   **Localization**: The app is available in **English**, **German**, **Spanish**, and **French**.
-   **Auto-Sync**: When you connect to a remote session, the remote IDE will automatically match your desktop language setting! 🌍
