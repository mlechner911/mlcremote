Desktop build notes (Windows & Linux)
====================================

This document shows how to build the Wails-based desktop app on Windows and Linux.
For Windows, it also describes a small project configuration fix required when the
Wails CLI reports a JSON unmarshal error for the `author` field.

Quick steps
-----------
- Install prerequisites: Go (1.20+), Node.js (18+), and the WebView2 runtime.
- Install the Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest` and ensure `$HOME/go/bin` (or GOBIN) is in PATH.
- In PowerShell run:

```powershell
cd E:\mlcremote\desktop\wails\frontend
npm install
npm run build

cd ..\
wails build
```

Other troubleshooting
---------------------
- If `wails` is not on PATH, ensure `%USERPROFILE%\go\bin` is added to
  the Windows PATH and restart your shell.
- If `wails build` fails with Go module errors, run `go mod tidy` in
  `desktop/` and rerun the build.
- If you see WebView2 errors at runtime, install the WebView2 runtime
  from Microsoft: https://developer.microsoft.com/microsoft-edge/webview2/


Cross-Platform Payloads
-----------------------
The build system now automatically cross-compiles the backend for Linux, Windows,
and macOS and embeds them into the desktop application. This happens automatically
when running `make desktop-build`.

To manually verify these payloads:
```powershell
make prepare-payload
# Use the cross-platform tool to list contents
bin\build-util ls-r desktop\wails\assets\payload
```

The unified executable will be larger (~90MB) as it contains binaries for all
platforms.


Linux build (GTK + WebKitGTK)
-----------------------------
Prerequisites:
- Go (1.21+), Node.js (18+)
- GTK3 and WebKitGTK development packages, `pkg-config`, and build tools

Quick install:
```bash
sudo desktop/wails/scripts/install-linux-deps.sh
```
Or via Make:
```bash
make desktop-deps
```

Build commands:
```bash
cd desktop/wails/frontend && npm install && npm run build
cd ..
# Auto-detects WebKitGTK version via tags fallback
wails build -tags webkit2_41 || wails build -tags webkit2 || wails build
```

Convenience targets:
```bash
make desktop-build       # builds payloads + desktop app
make desktop-dist        # builds and packages to dist/desktop-<os>-<arch>
make debug               # Wails dev + Vite dev server (browser accessible)
```

Headless environments:
- Use `xvfb-run` to launch the built app without a display server.

Docker build route:
```bash
make build-linux
ls dist/linux/MLCRemote
```

Remote Testing
--------------
If you're developing on a remote machine:

- Browser Dev Mode (no GUI needed):
  1. On the remote: `make debug` (starts Wails backend dev server and Vite frontend dev server)
  2. From your local machine, forward ports and open your browser:
```bash
# Forward Vite (5174) and Wails backend dev server (e.g., 34115)
ssh -L 5174:localhost:5174 -L 34115:localhost:34115 user@remote
# Then browse to:
http://localhost:5174/          # Frontend
http://localhost:34115          # Wails backend dev UI
```

- X11 Forwarding (render desktop app locally):
```bash
# On your local Linux/macOS, ensure X server is running
ssh -Y user@remote   # or -X
cd mlcremote/dist/desktop-linux-$(uname -m)
./MLCRemote
```

- Xvfb + xpra (headless remote with viewable session):
```bash
# On remote
sudo apt-get install -y xpra xvfb
xpra start :100 --start=./dist/desktop-linux-$(uname -m)/MLCRemote --bind-tcp=0.0.0.0:10000
# From local, attach over SSH
xpra attach ssh:user@remote:100
# Or via TCP if secured appropriately
xpra attach tcp:remote:10000
```

Convenience Make target:
```bash
# Start xpra on remote and print tunnel instructions
make remote-xpra REMOTE=user@remote REMOTE_DIR=/full/path/to/mlcremote
# If your remote workspace path matches your local current directory,
# you can omit REMOTE_DIR (it defaults to your local $(PWD)).

# Bind to all interfaces (no SSH tunnel):
make remote-xpra REMOTE=user@remote REMOTE_DIR=/full/path/to/mlcremote REMOTE_BIND=0.0.0.0:10000
# Then attach from Windows:
# xpra.exe attach tcp:<remote-host>:10000
# Security note: prefer SSH tunnels or restrict access via firewall when using direct TCP.
```

xpra installation (Linux)
-------------------------
On some Debian/Ubuntu systems, `xpra` is not in the default repositories. Add the official xpra repo:
```bash
sudo apt-get update
sudo apt-get install -y curl gnupg lsb-release

# Import xpra signing key
curl -fsSL https://xpra.org/gpg.asc | sudo tee /usr/share/keyrings/xpra.asc >/dev/null

# Detect your codename (e.g., jammy, focal, bookworm)
CODENAME=$(lsb_release -sc 2>/dev/null || . /etc/os-release && echo "$VERSION_CODENAME")

# Add xpra repo (deb822 format)
sudo bash -c "cat > /etc/apt/sources.list.d/xpra.sources <<EOF
Types: deb
URIs: https://xpra.org/
Suites: ${CODENAME}
Components: main
Signed-By: /usr/share/keyrings/xpra.asc
EOF"

sudo apt-get update
sudo apt-get install -y xpra xvfb

# If needed, set Suites explicitly:
# sudo sed -i 's/Suites: .*/Suites: jammy/' /etc/apt/sources.list.d/xpra.sources && sudo apt-get update
```

Fedora:
```bash
sudo dnf install -y xpra xorg-x11-server-Xvfb
```

Arch:
```bash
sudo pacman -Sy --noconfirm xpra xorg-server-xvfb
```

- Xvfb + x11vnc (VNC viewer):
```bash
# On remote
sudo apt-get install -y x11vnc xvfb
Xvfb :99 &
export DISPLAY=:99
./dist/desktop-linux-$(uname -m)/MLCRemote &
x11vnc -display :99 -forever -nopw -listen 127.0.0.1 -rfbport 5900 &
# From local
ssh -L 5900:localhost:5900 user@remote
# Connect with a VNC client to localhost:5900
```
