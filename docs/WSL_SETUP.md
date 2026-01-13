# WSL 2 Runner Setup for MLCRemote

This guide explains how to use Windows Subsystem for Linux (WSL 2) strictly as a **Runner** to test the Linux binary built via Docker.

**You do NOT need to install Go, Node.js, or Wails inside WSL.**

## 1. Prerequisites

Ensure you are running Windows 10 (Build 19044+) or Windows 11. These versions support **WSLg**, which allows Linux GUI apps to launch natively.

### Install WSL
Open PowerShell as Administrator and run:
```powershell
wsl --install
```
*Restart your computer if prompted.*

This will install Ubuntu by default.

## 2. Build the Linux Binary (on Windows)

Use the existing Docker build command from your Windows terminal (PowerShell):

```powershell
make build-linux
```
This builds the binary and places it in:  
`c:\development\mlcremote\dist\linux\mlcremote`

## 3. Prepare WSL for Running GUI Apps

Open your Ubuntu terminal (WSL) and install the lightweight runtime dependencies (GTK3 & WebKit).

1.  **Update Sources**:
    ```bash
    sudo apt update
    ```

2.  **Install Runtime Libs**:
    You can run this single command to install everything needed:
    ```bash
    cd /mnt/c/development/mlcremote
    sudo ./desktop/wails/scripts/install-linux-deps.sh
    ```
    *(Note: This script installs `libgtk-3-dev` and `libwebkit2gtk-4.0-dev` which includes the runtime libraries required to run the app).*

## 4. Run the App

In your WSL terminal:

1.  **Navigate to the dist folder**:
    ```bash
    cd /mnt/c/development/mlcremote/dist/linux
    ```

2.  **Execute the Binary**:
    ```bash
    ./mlcremote
    ```

The application window should appear directly on your Windows desktop!

---

## Troubleshooting

### "Error: cannot open display: :0"
If the window does not appear, check if you are on WSL 2:
```powershell
wsl -l -v
```
It must say **2**. If it says **1**, run `wsl --set-version Ubuntu 2`.

### Manual Display Export (Only if WSLg fails)
If you are on an older Windows build without WSLg support, you need an X Server like **VcXsrv**.

1. Install and run **VcXsrv** (configured with "Disable access control").
2. Run this in WSL before starting the app:
   ```bash
   export DISPLAY=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):0
   ```
