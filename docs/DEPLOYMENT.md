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

### 2. Build Desktop App (Windows)
```powershell
cd desktop/wails
wails build
```
This produces `desktop/wails/build/bin/MLCRemote.exe`.

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

### "Tunnel Error" / Port In Use
The app now automatically attempts to kill processes on port 8443 (or configured port) before connecting. If this fails, ensure no high-privilege service is blocking the port.

### Terminal Issues
If `htop` or `vim` fail with "Error opening terminal: unknown", ensure the backend version is up to date. We now inject `TERM=xterm-256color` into the PTY session.
