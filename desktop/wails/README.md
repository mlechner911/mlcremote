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

Tunnel usage (prototype):

- `StartTunnel(profile)` — starts an SSH tunnel using the provided profile string. The prototype
  expects a short command-like profile, for example: `-L8443:localhost:8443 user@remotehost`.
- `StopTunnel()` — requests the running tunnel process to stop.
- `TunnelStatus()` — returns a short string: `starting`, `started`, `stopping`, or `stopped`.

The frontend Connect dialog demonstrates starting a tunnel and re-checking the backend health.
This is a prototype: for production, validate inputs, use key files or SSH agents securely,
and implement robust process supervision and platform-specific behavior.
