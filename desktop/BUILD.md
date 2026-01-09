Windows build notes for the Wails desktop prototype
===============================================

This document shows how to build the Wails-based desktop app on Windows
and describes a small project configuration fix required when the
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
