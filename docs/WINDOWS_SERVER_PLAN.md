# Windows Server + GUI Integration Plan

Goal: ship a Windows-native version of MLCRemote that provides both a GUI (desktop) and a small server component. The GUI should be able to upload the server binary to a remote Windows machine (or install locally), start it if needed, verify health, and then display the GUI connected to the running server.

This document outlines the project plan, high-level design, and implementation steps for Windows as the top priority.

## Summary
- Target: Windows x64 (initially). Later: Windows x64 + arm64.
- Deliverables:
  - `mlcremote.exe` Windows server binary (CLI + REST API)
  - Desktop GUI (Wails or Electron) that can manage remote/local server lifecycle
  - Installer (MSI or ZIP+helper) and a simple install location: `%USERPROFILE%\\.mlcremote` for per-user installs
  - CI workflow that builds, packages, and publishes artifacts

## How it should work (User flow)
1. GUI starts on user's machine. It shows a connection dialog with either `localhost` (local server) or a remote host (IP/hostname).
2. If the target host does not have the server installed, GUI offers an "Upload & Install" button.
   - GUI uploads `mlcremote.exe` to the target (via SCP/WinRM/SMB or a remote agent — details below).
   - Installer location: the GUI places the server in `%USERPROFILE%\\.mlcremote\\mlcremote.exe` and writes a small `run.bat` wrapper if needed.
   - Optionally the GUI can create a Windows scheduled task to run the server at login or a background service (advanced, optional).
3. GUI will attempt to start the server on the remote host if it's not running:
   - Start method: remote command execution (WinRM/SSH or SMB+scheduled task), or request remote user to start. For local installs the GUI can spawn the process directly.
4. GUI polls the server's `/health` endpoint until it reports healthy (with `host` and `status`).
5. Once healthy, GUI opens the main interface and connects WebSocket terminals and API calls to the server.

## Security considerations
- Transport: use SSH/WinRM over TLS (for remote command execution). If uploading a binary to remote, ensure connection is authenticated.
- Permissions: per-user install avoids needing admin rights. If requiring a service/auto-start, document the admin steps and use signed installers.
- Signing: code-sign `mlcremote.exe` before public releases to avoid Windows Defender warnings.

## Implementation plan

Phase 1 — PoC (2-4 days)
- Add Windows cross-build support for the Go server (GOOS=windows GOARCH=amd64) and produce `mlcremote.exe`.
- Add a GUI button that uploads the binary to a local path (for local testing use localhost) and starts the process locally.
- Health-check loop in GUI: call `/health` until healthy.

Phase 2 — Remote upload & start (4-7 days)
- Implement an upload mechanism in the GUI supporting at least one remote transport:
  - Preferred: SSH/SCP if remote Windows machine runs OpenSSH (now available on Windows) — simplest to implement for early testing.
  - Alternative: WinRM (PowerShell Remoting) using a library or wrapper.
- Implement remote execution to start the uploaded `mlcremote.exe` in `%USERPROFILE%\\.mlcremote`.
- Add retries and error reporting for permission failures and path issues.

Phase 3 — Packaging & CI (4-6 days)
- Add GitHub Actions workflow to cross-compile Windows binaries and attach artifacts.
- Add packaging (ZIP and optionally NSIS or MSI for installer creation).
- Add a small script to install/uninstall under `%USERPROFILE%\\.mlcremote`.

Phase 4 — Signing & Release (3-5 days)
- Integrate code signing into CI (upload cert to CI secrets) or provide manual signing steps.
- Draft a release workflow (tag -> build -> sign -> publish).

Phase 5 — Polish (1-2 weeks)
- Create a Windows service installer option (optional, requires admin).
- Improve remote discovery, auto-start, and trust model.
- Add documentation and UX polish.

## Desktop GUI responsibilities
- Provide connection dialog (host, port, auth method) and show server status.
- Provide Upload & Install flow.
- Start / Stop / Restart server on remote host when requested.
- Verify health before showing main UI.

## File layout and conventions
- Install path: `%USERPROFILE%\\.mlcremote` for per-user installs.
- Server binary: `%USERPROFILE%\\.mlcremote\\mlcremote.exe`.
- Wrapper: optional `run.bat` that sets necessary env vars and starts the server in the background (e.g., using `start /b` or scheduled task).

## Remote transport choices
- SSH/SCP (if windows has OpenSSH enabled): simple, widely supported.
- WinRM / PowerShell Remoting: native Windows remote command support — requires more setup but native.
- SMB + remote scheduled task: copy binary to share, then create a scheduled task to run it under current user.

## Health-check protocol
- Use existing `/health` endpoint. GUI should poll until `status` is `ok` and `host` matches expected hostname.
- Timeout and retry policy: try for up to 60 seconds with exponential backoff, then report error and logs.

## Next actionable steps I can take
1. Add a `docs/WINDOWS_SERVER_PLAN.md` (done).
2. Run an audit of the repo for current Windows build readiness and report gaps (I can run this now).
3. Implement Phase 1 PoC: add Go cross-build command and a local-install-and-run flow in the GUI for Windows.

Please confirm if you want me to start the repo audit now and whether SSH/SCP is an acceptable primary remote transport for your environments.
