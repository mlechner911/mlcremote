# Remote UNIX Server Plan (Windows GUI -> Unix server)

Goal: provide a workflow where the Windows desktop GUI can upload and run the `mlcremote` server on a remote UNIX machine (Linux/macOS). This is the first priority: Windows client -> remote UNIX server via SSH/SCP. Later we will add other client-host combinations (Unix -> Unix, macOS -> Unix).

This document outlines the plan, user flow, and implementation phases for a remote UNIX-first deployment model.

## Summary
- Target: remote UNIX host (Linux x86_64 initially). Client: Windows desktop GUI (Wails/Electron) as first supported client.
- Deliverables:
  - `mlcremote` server binary for Linux (ELF) and macOS (later)
  - Windows desktop GUI that can upload, install, start, and health-check the server on a remote UNIX host via SSH/SCP
  - Per-user install location on remote host: `~/.mlcremote`
  - CI workflow that builds Linux artifacts and packages for distribution

## How it should work (User flow)
1. User opens the Windows GUI and specifies a remote host (hostname/IP), port, and SSH credentials (key or password).
2. GUI checks connectivity (SSH) to remote host. If connection fails, show actionable error/help.
3. GUI checks for an installed server (`~/.mlcremote/mlcremote`) and whether the server process is running (optionally check `/health`).
4. If not installed, GUI offers "Upload & Install":
   - Upload the correct binary build (Linux x86_64 or detected remote OS/arch) to `~/.mlcremote/mlcremote` using SCP.
   - Set executable permissions (`chmod +x`) and optionally write a small `run.sh` wrapper.
5. GUI will attempt to start the server remotely (e.g., `nohup ~/.mlcremote/mlcremote &` or use `systemd --user` / `screen` / `tmux` depending on remote capabilities).
6. GUI polls the server's `/health` endpoint until it reports healthy and provides `host` and `status`.
7. Once healthy, GUI shows the main interface and connects to the server's APIs and websockets.

## Security considerations
- Transport: use SSH/SCP as the primary transport for upload and remote command execution (secure channel). Optionally support WinRM or other transports in future.
- Authentication: support SSH key and password. Prefer key-based authentication for automation.
- Permissions: upload into the user's home directory (`~/.mlcremote`) to avoid requiring root. Document optional service installation steps requiring sudo.

## Implementation plan

Phase 1 — PoC (2-3 days)
- Add cross-build scripts to build the `mlcremote` server for Linux x86_64 (and macOS later).
- Add a GUI button to upload a selected binary to a remote host via SCP and run `chmod +x`.
- Start the remote process with `nohup`/`setsid`/`systemd --user` fallback and poll `/health` for readiness.

Phase 2 — Robust remote install/start (3-6 days)
- Detect remote OS/arch via a small remote probe (e.g., `uname -s -m`) and pick the correct binary.
- Improve remote start methods: support `systemd --user`, `nohup`, `tmux`, and `screen` as fallbacks.
- Add logging capture (redirect stdout/stderr to `~/.mlcremote/logs`), and fetch logs on failure for diagnostics.

Phase 3 — CI & Packaging (4-6 days)
- Add GitHub Actions to build Linux artifacts and attach them for download.
- Add packaging scripts to produce release zips for the server (per-arch tarballs).

Phase 4 — Automation & UX polish (3-5 days)
- Add retry/backoff logic and clearer error messages for remote failures.
- Improve GUI UX for onboarding and show progress for upload/start/health steps.

Phase 5 — Expand clients/hosts (optional)
- Add support for macOS server binaries, and allow Unix clients to manage other Unix hosts.

## Remote transport & commands
- Primary: SSH/SCP (upload binary, run remote commands). Use `scp` or an SSH library in the GUI.
- Remote probe: run `uname -s -m` to detect OS and architecture.
- Start remote: try `systemd --user` if available, otherwise `nohup ~/.mlcremote/mlcremote > ~/.mlcremote/logs/out.log 2>&1 &` or `setsid`.

## Health-check protocol
- Use existing `/health` endpoint. GUI should poll until healthy (with timeout, e.g., 60s).
- On failure, fetch remote logs (last 100 lines) and surface them to the user.

## Install layout on remote
- Directory: `~/.mlcremote/`
- Files:
  - `~/.mlcremote/mlcremote` (binary)
  - `~/.mlcremote/run.sh` (optional wrapper)
  - `~/.mlcremote/logs/` (stdout/stderr)

## Next actionable steps I can take now
1. Run a repo audit to enumerate current cross-build capability and scripts (Makefile, scripts/, wails/). I can do this immediately.
2. Implement Phase 1 PoC: add Linux cross-build, GUI upload/start buttons that use SSH/SCP, and health-check loop.

Please confirm: I will assume SSH/SCP with key-based auth as the primary remote transport for the PoC. Should I proceed with the repo audit now?

## Remote Build Option (optional)
In some environments it may be preferable to build the `mlcremote` server directly on the remote UNIX host instead of uploading a pre-built binary. This can simplify compatibility (matching libc, glibc/ld, kernel ABI) but requires toolchain availability on the remote machine. Below are recommended approaches and implementation notes.

Approach A — Build on remote with Go installed
- Precondition: remote host has a compatible Go toolchain installed (recommended Go >= 1.20).
- Steps the GUI can perform (over SSH):
  1. Upload the source tarball or pull the repo directly (e.g., `git clone --depth 1 https://github.com/<owner>/mlcremote.git /tmp/mlcremote-build`).
  2. Run `cd /tmp/mlcremote-build && make build` or `GOOS=linux GOARCH=amd64 go build -o ~/.mlcremote/mlcremote ./backend` (adjust path to build target).
  3. Move the resulting binary to `~/.mlcremote/mlcremote`, set `chmod +x`, and start as usual.

Approach B — Bootstrap Go on remote (if not present)
- If Go is not installed and installing it is acceptable, the GUI can upload a minimal bootstrap script or invoke commands to download the official Go binary tarball and extract it into `~/.local/go` (no root required):
  - Example commands:
    - `mkdir -p $HOME/.local && curl -fsSL https://go.dev/dl/go1.xx.linux-amd64.tar.gz | tar -xz -C $HOME/.local`
    - `export GOROOT=$HOME/.local/go; export PATH=$GOROOT/bin:$PATH`
    - then run the build command
- Security note: downloading and running toolchain installers remotely should be allowed only for trusted hosts/users and users must consent.

Approach C — Build in Docker on remote
- If Docker is available on remote, use a deterministic builder container to compile the binary (no need to install Go on host):
  - Example: `docker run --rm -v $PWD:/src -w /src golang:1.20 bash -c 'go build -o /src/bin/mlcremote ./backend'`
- This isolates the build and avoids polluting the user's environment; GUI can detect Docker and choose this path.

Approach D — Cross-compile locally and upload (already planned)
- Continue to support cross-compilation locally (CI or developer machine) and upload artifacts. This remains the simplest for controlled releases.

Implementation considerations
- Choose order of preference: Docker (if available) -> native Go -> bootstrap Go -> local cross-compile upload.
- Add detection steps in the GUI: probe `which docker`, `which go`, and `uname -s -m` to decide the best path.
- Add verbose logging and an option to fetch build logs from the remote `/tmp/mlcremote-build` directory to help debugging.

Security and operational notes
- Building on remote requires running shell commands over SSH; ensure the GUI only connects to trusted hosts and presents clear consent prompts.
- If bootstrapping Go from the internet, prefer checksums/expected versions and present the commands for audit.

