# Deployment & Release Guide

## Prerequisites

- Go 1.21+
- Node.js 18+
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

## Build Process

### 1. Generate Icons
The app requires a set of file icons generated from the Tango icon set.
```powershell
# Windows
./scripts/generate-icons.ps1
```
```bash
# Linux/Mac
./scripts/generate-icons.sh
```

### 2. Build Desktop App
#### Windows
```powershell
cd desktop/wails
wails build
```
This produces `desktop/wails/build/bin/MLCRemote.exe`.

#### Linux
Install dependencies, then build:
```bash
sudo desktop/wails/scripts/install-linux-deps.sh
cd desktop/wails
wails build -tags webkit2_41 || wails build -tags webkit2 || wails build
```
Convenience targets:
```bash
make desktop-deps
make desktop-build
make desktop-dist
```

### 3. Build Remote Backend (Linux)
The desktop app bundles the remote backend installer, but you can build it manually:
```bash
GOOS=linux GOARCH=amd64 go build -o bin/dev-server ./backend/cmd/dev-server
```

## Release Checklist

- [ ] Version bumped in `desktop/wails/wails.json`
- [ ] `CHANGELOG.md` updated
- [ ] Icons generated and verified
- [ ] Tested clean install on fresh VM
- [ ] Verified SSH tunnel robustness with `KillPort`

## Troubleshooting
### Linux GUI dependencies missing
If you see pkg-config errors for `gtk+-3.0` or `webkit2gtk`, install Linux desktop dependencies:
```bash
sudo desktop/wails/scripts/install-linux-deps.sh
# or
make desktop-deps
```
For headless servers, use Xvfb:
```bash
sudo apt-get install -y xvfb
xvfb-run ./dist/linux/MLCRemote
```

### Remote desktop testing
If you need to run the Linux desktop app on a remote host and view it from Windows:
```bash
# On remote
xpra start :100 --start=./dist/desktop-linux-$(uname -m)/MLCRemote --bind-tcp=127.0.0.1:10000 --exit-with-children
# On Windows
ssh -L 10000:127.0.0.1:10000 user@remote-host
xpra.exe attach tcp:localhost:10000
# Or use the helper target:
make remote-xpra REMOTE=user@remote-host REMOTE_DIR=/full/path/to/mlcremote
```

### "Tunnel Error" / Port In Use
The app now automatically attempts to kill processes on port 8443 (or configured port) before connecting. If this fails, ensure no high-privilege service is blocking the port.

### Terminal Issues
If `htop` or `vim` fail with "Error opening terminal: unknown", ensure the backend version is up to date. We now inject `TERM=xterm-256color` into the PTY session.
