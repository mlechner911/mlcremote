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
