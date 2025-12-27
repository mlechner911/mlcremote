Desktop EXE (Wails) — Design and usage

This document describes the Wails prototype included in `desktop/wails` and the recommended behavior for the desktop EXE.

Goals
- Provide an easy-to-install desktop wrapper that manages SSH tunnels and connects to a remote MLCRemote server.
- Offer a per-profile Connect dialog and Settings dialog to manage connection profiles.
- Ensure the desktop app checks for a running backend before creating an SSH tunnel.

Prototype notes
- Location: `desktop/wails`
- The Go binding exposes `HealthCheck(url, timeoutSeconds)` which the frontend uses to validate the presence of the backend's `/health` endpoint.
- The frontend includes a simple Connect dialog and a Settings dialog storing profiles in `localStorage` (prototype only).

Connect flow (recommended)
1. User clicks Connect for a profile.
2. Desktop app attempts direct health check on `http://127.0.0.1:<localPort>/health`.
   - If successful: open the UI connected to that port.
   - If not successful and profile has `useTunnel=true`: prompt the user to start an SSH tunnel to `host:remotePort`. If confirmed:
     - Spawn `ssh -L <localPort>:localhost:<remotePort> user@host` as a child process and monitor it.
     - Wait briefly and re-run the health check on the local forwarded port.
     - If now healthy: proceed, otherwise show an error and allow retry.
3. The desktop app must manage the lifecycle of the spawned SSH process: stop it when the user disconnects or the app exits.

Security & UX considerations
- Never store private keys inside profile files. Allow a path to a key or rely on SSH agent.
- Use ephemeral local ports for tunnel endpoints to avoid port collisions.
- Show clear status and error messages when a tunnel fails.

Next steps to productionize
- Replace `localStorage` with OS-backed secure storage (Keychain / libsecret / Credential Manager).
- Add auto-updates and installers for target platforms.
- Add preference for running tunnels via an external terminal vs. managed background process.

