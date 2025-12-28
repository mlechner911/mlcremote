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

If `wails build` fails with a JSON unmarshal error like:

  ERROR   json: cannot unmarshal string into Go struct field Project.Author of type project.Author

The project `wails.json` contains an `author` field which the Wails CLI
expects to be a structured object, not a plain string. See the fix below.

Fixing `wails.json`
-------------------
Open `desktop/wails.json` and locate the `author` field. If it is a
string (for example, `"author": ""`), replace it with a small object
structure. Example:

```json
  "author": {
    "name": "",
    "email": ""
  },
```

This gives the Wails CLI the expected shape and prevents the unmarshal
error. You can fill `name` and `email` if you prefer, or leave them
empty.

Why this happens
-----------------
Wails reads `wails.json` into a strongly-typed Go struct. The `author`
property is defined as a nested object (with `name`, `email`, etc.), so
providing a plain string causes a JSON type mismatch and the CLI fails
with the error shown above.

Other troubleshooting
---------------------
- If `wails` is not on PATH, ensure `%USERPROFILE%\go\bin` is added to
  the Windows PATH and restart your shell.
- If `wails build` fails with Go module errors, run `go mod tidy` in
  `desktop/` and rerun the build.
- If you see WebView2 errors at runtime, install the WebView2 runtime
  from Microsoft: https://developer.microsoft.com/microsoft-edge/webview2/

If you'd like, I can apply the `wails.json` fix for you (set `author` to
an object with empty `name`/`email`) so `wails build` works immediately.
