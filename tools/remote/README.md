MLCRemote remote tooling
=======================

This folder contains helper scripts to build, install and manage `mlcremote` on a remote Linux machine under a normal user's home directory (default: `~/.mlcremote`). The tools are conservative by default and try not to overwrite user files without an explicit `--overwrite` flag.

Scripts
-------

- `probe-remote.sh` — Probe a remote host to detect OS, architecture, init system (systemd), and presence of common tools. Use this before attempting an install to confirm the remote supports the required features.
- `install-remote.sh` — Install `mlcremote` under the target user's `~/.mlcremote`. Copies a server binary into `~/.mlcremote/bin`, places the frontend under `~/.mlcremote/frontend` (or uses an already-present frontend), writes a `run-server.sh` wrapper, and optionally installs a `systemd --user` service `mlcremote.service` that references the wrapper.
- `push-and-install.sh` — Local helper that rsyncs the packaged `build/dist` into the remote `~/.mlcremote`, ensures `install-remote.sh` is present on the remote, and runs it. Supports `--overwrite` to stop an active service before installing.
- `status-remote.sh` — Reports the `systemd --user` service status, recent `journalctl` lines for `mlcremote`, prints the service file and `run-server.sh`, shows socket listeners on the configured port and lists `dev-server` processes. Useful for diagnosing why a service fails to start.
- `connect-remote.sh` — SSH local-port-forward helper to connect a local client to the remote server via an SSH tunnel.

Design principles
-----------------

- Install under the user's home directory in `~/.mlcremote` to avoid requiring root privileges.
- Be conservative: `push-and-install.sh` only rsyncs `bin/` and `frontend/` to avoid clobbering helper files like `run-server.sh` or service files. Use `--overwrite` when you explicitly want to stop a running service and replace binaries.
- Provide a `status-remote.sh` that aggregates the common diagnostics for quick troubleshooting.
- Avoid automatic destructive behavior. Killing processes that belong to other users or wiping directories should always be done with explicit confirmation or via an `--kill-old` flag that intentionally enables the destructive path.

Usage
-----

1) Build a distributable locally

On your development machine run the top-level `make dist` which builds the backend, icon generator and the frontend and writes a package into `build/dist`:

```bash
make dist
```

You should end up with:
- `build/dist/bin/dev-server` — the server binary
- `build/dist/bin/icon-gen` — icon generator
- `build/dist/frontend/` — the built frontend assets

2) Probe the remote host (recommended)

Run the probe to confirm the remote environment supports the install (systemd, rsync, tar, etc):

```bash
bash tools/remote/probe-remote.sh user@remote.example.com --json --debug
```

If `ssh` prompts about unknown host keys run an interactive `ssh user@remote` once to accept the host key.

3) Push and install

The simplest safe path is:

```bash
bash tools/remote/push-and-install.sh user@remote.example.com --service --port 8443
```

- `--service` tells the installer to register and enable a `systemd --user` unit for the user.
- If the remote has the service already running you will be asked to provide `--overwrite` to stop it before reinstalling:

```bash
bash tools/remote/push-and-install.sh user@remote.example.com --service --port 8443 --overwrite
```

What this does:
- Rsyncs `build/dist/bin/` → `~/.mlcremote/bin/`
- Rsyncs `build/dist/frontend/` → `~/.mlcremote/frontend/`
- Copies `tools/remote/install-remote.sh` to `~/.mlcremote/install-remote.sh` (if not present)
- Runs `~/.mlcremote/install-remote.sh --service --port <PORT> --bin ~/.mlcremote/bin/dev-server`

4) Check service status

Use the status helper to view `systemctl --user` status, recent journal lines and processes:

```bash
bash tools/remote/status-remote.sh --lines 200 --port 8443 user@remote.example.com
```

This prints:
- `systemctl --user status mlcremote.service` output
- `journalctl --user -u mlcremote.service -n <lines>`
- the content of `~/.config/systemd/user/mlcremote.service` (if present)
- the content of `~/.mlcremote/run-server.sh`
- `ss -tnlp` filtered for the configured port
- `ps aux | grep dev-server` output

If the service fails to start with "bind: address already in use" inspect `ps aux` to find the process holding the port. Some systems or accounts may have old dev-server processes that need to be stopped.

5) Connect from local machine

Use `connect-remote.sh` (simple helper) or a manual ssh tunnel to forward a local port to the remote server's loopback:

```bash
# example: forward local 8443 to remote 127.0.0.1:8443
bash tools/remote/connect-remote.sh user@remote.example.com --local-port 8443 --remote-port 8443
# then open http://localhost:8443 in your browser
```

Cleanup and process handling
----------------------------

If `status-remote.sh` shows another process is listening on the port (or many stray `dev-server` instances from another user), you have options:

- Manual: SSH into the remote, stop the service and inspect processes, then selectively kill them:

```bash
ssh user@remote
systemctl --user stop mlcremote.service || true
ss -tnlp | grep 8443
ps aux | grep dev-server
# carefully kill the unwanted processes (check owner and command first)
pkill -f "dev-server --port 8443"  # use with caution (prompts not implemented)
systemctl --user start mlcremote.service
journalctl --user -u mlcremote.service -n 200
```

- Automated (planned): `push-and-install.sh` may be extended with a `--kill-old` flag that, when combined with `--overwrite`, will prompt to kill processes holding the port before restarting the service. This is intentionally opt-in to avoid accidentally stopping unrelated services or processes owned by other users.

Troubleshooting
---------------

- If `probe-remote.sh` prints no output, the most common reason is SSH host-key verification or authentication failure. Run `ssh user@host` interactively to inspect the prompt. The probe script will fall back to open an interactive ssh for initial host-key acceptance when run with `--debug`.
- If the systemd user service fails with repeated restarts and `bind: address already in use`, check `ps aux` for other `dev-server` processes and kill the ones that should no longer run.
- If the frontend doesn't load or you see 404s, ensure the `--static-dir` supplied to the server points at the directory that contains `index.html` and asset files. The installer writes `--static-dir $HOME/.mlcremote/frontend` by default when installing from packaged `build/dist`.

Development notes for contributors
--------------------------------

- `install-remote.sh` now generates a `run-server.sh` wrapper that `cd`s into `$HOME` before exec'ing the binary. The systemd unit file created sets `WorkingDirectory=$HOME` as well to ensure consistent behavior for relative paths.
- `push-and-install.sh` intentionally rsyncs only `bin/` and `frontend/` to avoid accidental deletion of helper files. Use `--overwrite` to stop an active service before installing.

If you'd like, I can implement the `--kill-old` option or add an interactive `clean-remote.sh` helper. Tell me which and I'll add it.
# mlcremote remote install & connect helpers

This folder contains simple helper scripts to install a packaged `mlcremote` server
into a user's home directory on a remote machine and to create an SSH tunnel from
local machine to the remote server so local clients can connect.

Files:

- `install-remote.sh` - copy binaries and frontend to `~/.mlcremote` and optionally
  install a `systemd --user` service to start it.

- `connect-remote.sh` - create an SSH tunnel (local port -> remote port) using
  the host's installed `ssh` command. Supports backgrounding.

- `mlcremote.service` - A template systemd user service that runs `~/.mlcremote/run-server.sh`.

Usage example
-------------

On the remote machine (or via scp/rsync):

1. Copy the `build/dist` contents to the remote host, for example:

```bash
# from your workstation
scp -r build/dist/frontend user@remote:~/
scp build/dist/bin/dev-server user@remote:~/.mlcremote/bin/
scp build/dist/bin/icon-gen user@remote:~/.mlcremote/bin/
```

2. SSH into the remote host and run the installer (will only copy if missing):

```bash
ssh user@remote
# on remote
cd ~
git clone <repo> # or copy files via scp
# make sure binary and frontend are in place (see scp step)
./tools/remote/install-remote.sh --service --port 8443 --bin ~/.mlcremote/bin/dev-server
```

This will copy files into `~/.mlcremote`, create `~/.mlcremote/run-server.sh`, and
install a `systemd --user` service `mlcremote.service` and start it.

From your local machine, create a tunnel:

```bash
./tools/remote/connect-remote.sh user@remote --remote-port 8443 --local-port 8443 --bg
# then open http://127.0.0.1:8443/ in your browser (or client)
```

Notes & future work
-------------------
- Currently the scripts use `systemd --user` to install a persistent service. For
  systems without systemd we fall back to printing how to run the server in background.
- We use the system `ssh` binary; later we might add support for alternative transport
  or non-standard SSH ports.
- We might later add OS-specific variants and multiple binary targets (linux/amd64,
  linux/arm64, macos, etc.) and extend the `install-remote.sh` to pick the right binary.
