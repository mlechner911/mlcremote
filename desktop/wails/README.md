Wails prototype for MLCRemote

This folder contains a minimal scaffold for a Wails-based desktop prototype.

It is intentionally small and meant as a starting point:

- `main.go` — Wails app bootstrap and an `App` binding with `HealthCheck`.
- `frontend/` — minimal React app (Vite) with a Connect dialog and Settings dialog.

To develop locally you should install the Wails toolchain and follow Wails docs:
https://wails.io

Notes:
- This scaffold does not include a full Wails build pipeline. Use `wails init` in this folder
  or copy these files into a Wails project to complete integration.
