# Lightweight Remote Dev Environment - Project Plan

## Overview
Build a minimal memory-footprint remote development environment replacing VSCode for basic file editing and terminal access.

## Architecture

### Deployment Model: SSH Tunnel + User Service
**Connection Flow:**
```
Laptop Browser (localhost:8443)
    ↓
SSH Port Forward (-L 8443:localhost:8443)
    ↓
Remote Server Go Binary (127.0.0.1:8443 only)
    ↓
Shell spawned as SSH user
```

**Key Design Decisions:**
- Backend binds to `localhost` only (never exposed to internet)
- No TLS needed (SSH tunnel provides encryption)
- No authentication layer (SSH auth is sufficient)
- Shell runs as the SSH user automatically
- Deployed as SystemD user service

### Backend (Go)
**Goals:** Single binary, <50MB memory, minimal dependencies, localhost-only

**Components:**
1. **HTTP/WebSocket Server**
   - Framework: `net/http` (stdlib)
   - WebSocket: `gorilla/websocket`
   - Static file serving for frontend
   - **Binds to 127.0.0.1 only**

2. **Terminal Handler**
   - Library: `github.com/creack/pty`
   - One goroutine per terminal session
   - WebSocket bidirectional pipe
   - Spawns shell as current user (no privilege escalation needed)

3. **File System API**
   - REST endpoints for CRUD operations
   - File watcher: `github.com/fsnotify/fsnotify`
   - Stream large files (chunked reading)
   - Operates with user's filesystem permissions

4. **Security**
   - Listen on localhost only
   - Optional: session token for browser refresh
   - Path traversal protection
   - No TLS (handled by SSH tunnel)

### Frontend Options

**Option A: Browser-based (Recommended for MVP)**
- Pure web app, no installation needed
- Access via `https://your-server:8443`

**Option B: Desktop Wrapper**
- **Tauri** (Rust + web) - ~3MB binary, very lightweight
- **Neutralino** (C++ + web) - ~2MB binary, even lighter
- **Wails** (Go + web) - ~10MB, Go-native
- Avoid Electron (too heavy)

User preference notes:
- **Target shell:** Remote bash (or user's default shell) is the primary target for terminal sessions.
- **Desktop wrapper profiles:** The desktop wrapper should store connection profiles (host, port, username, UI settings) but explicitly **must not** store SSH private keys.
- **Multi-user option:** Multi-user access to a single machine/session is optional and should be supported as a configurable feature later (ACLs and session sharing policies to be defined if enabled).

Desktop wrapper recommendation:
- Given low Rust experience, prefer **Wails** (Go + web) for the desktop wrapper instead of Tauri. Wails produces compact binaries, integrates well with a Go backend (if desired), and reduces friction because the team already uses Go for the server. Neutralino remains an alternative for very small binaries but has a smaller ecosystem.

### Desktop profile schema (storage & security)
The desktop wrapper will store connection profiles locally to make connecting easier. Below is a recommended minimal schema, storage location, and security guidance.

- **Storage format:** JSON file per-profile or a single `profiles.json` array. Prefer JSON for simplicity and cross-platform compatibility.
- **Storage location:** Use the platform config directory:
   - Linux: `$XDG_CONFIG_HOME/lightdev/` (fallback `~/.config/lightdev/`)
   - macOS: `~/Library/Application Support/lightdev/`
   - Windows: `%APPDATA%\lightdev\`
- **Filename:** `profiles.json` (or `profiles/<name>.json` for per-profile files)

Recommended JSON schema (minimal):

{
   "profiles": [
      {
         "id": "uuid-v4",
         "name": "work-server",
         "host": "example.com",
         "port": 22,
         "username": "alice",
         "useTunnel": true,
         "lastUsed": "2025-12-27T12:34:56Z",
         "ui": {
            "theme": "dark",
            "fontSize": 13
         }
      }
   ]
}

Security & encryption considerations:
- **Do not store private SSH keys** in profiles. Only store host, port, username, and optional UI prefs.
- Consider storing an optional `passphraseHint` (non-sensitive) for the user to remember which key to use.
- For added privacy, support encrypting `profiles.json` at rest using an OS-backed secret store or user-provided passphrase:
   - Linux: `libsecret` / keyring
   - macOS: Keychain
   - Windows: Credential Manager
- Alternatively, allow users to opt into AES-256 encryption of the profiles file with a passphrase; document tradeoffs (lost passphrase means lost profiles).
- Validate and sanitize profile fields before use; avoid shelling out with untrusted values.

UX notes:
- Provide an import/export flow for profiles (JSON) so users can sync them manually.
- Expose a simple profile editor in the desktop UI and a quick-connect menu.


**Frontend Stack:**
- React + TypeScript
- CodeMirror 6 for editor
- xterm.js for terminal
- Tailwind CSS for minimal styling

## Phase 1: MVP Backend (Week 1)

### Deliverables:
1. **Basic Go Server**
   - HTTP server listening on `127.0.0.1:8443`
   - Static file serving
   - Health check endpoint
   - Configuration via flags/env vars

2. **Terminal WebSocket**
   - `/ws/terminal` endpoint
   - PTY session management (spawns user's default shell)
   - Clean disconnect handling
   - Automatic shell environment ($USER, $HOME, etc.)

3. **File API**
   - `GET /api/tree?path=` - directory listing (respects permissions)
   - `GET /api/file?path=` - file content
   - `POST /api/file` - save file
   - `DELETE /api/file?path=` - delete file
   - All operations run with user's permissions

4. **Configuration**
   - Command-line flags: `--port`, `--root` (working directory)
   - Environment variables
   - Default shell detection ($SHELL)

5. **Deployment Scripts**
   - `install.sh` - copies binary, sets up SystemD user service
   - `connect.sh` - SSH tunnel + opens browser

### Success Criteria:
- Runs with <30MB RAM idle
- Single binary deployment via `scp`
- Starts automatically on server boot (SystemD)
- Can spawn shell and proxy I/O
- Works over SSH tunnel

## Phase 2: MVP Frontend (Week 1-2)

### Deliverables:
1. **Layout Components**
   - Resizable split panes
   - File tree sidebar
   - Editor panel
   - Terminal panel

2. **File Tree**
   - Display directory structure
   - Click to open files
   - Basic icons (file/folder)
   - Lazy loading for large directories

3. **Editor Integration**
   - CodeMirror 6 setup
   - Syntax highlighting (top 10 languages)
   - Save on Ctrl+S
   - Show unsaved indicator

4. **Terminal Integration**
   - xterm.js mounting
   - WebSocket connection
   - Copy/paste support
   - Resize handling

### Success Criteria:
- Bundle size <2MB gzipped
- Can edit and save files
- Terminal fully functional
- Works in modern browsers

## Phase 3: Polish (Week 2-3)

### Backend Enhancements:
- [ ] File watcher for live updates
- [ ] Multiple terminal sessions
- [ ] Search in files endpoint
- [ ] Gzip compression for responses
- [ ] Graceful shutdown
- [ ] Logging and metrics
- [ ] Automatic reconnect on SSH tunnel drop

### Frontend Enhancements:
- [ ] Tab system for multiple files
- [ ] File search (Ctrl+P)
- [ ] Settings panel
- [ ] Theme support (light/dark)
- [ ] Keyboard shortcuts
- [ ] Connection status indicator
- [ ] Reconnection logic
- [ ] Display current working directory

### Recent UI fixes (Dec 2025)
- Terminal now uses xterm.js Fit addon to size the terminal to its container and respond to window resizes.
- Terminal sessions are created per-tab (unique session IDs generated server-side) so multiple independent shells can be opened.
- Copy/Paste controls were added to the terminal header; clipboard support uses the Clipboard API when available and falls back to prompt/selection-based shims when not.
- Light-mode contrast fixes: header and log overlay styles were adjusted so controls are readable and clickable in the `.theme-light` UI.

### Security:
- [ ] Path traversal protection (never access outside root)
- [ ] Rate limiting
- [ ] File size limits
- [ ] Optional: simple session token for browser tab isolation

## Phase 4: Desktop Wrapper (Optional, Week 3-4)

### Using Wails (Recommended):
1. **Setup**
   - Initialize Wails project
   - Bundle React frontend
   - Configure localhost connection and profile storage paths
   - Begin with browser-first development and testing; wrap with Wails after MVP is stable

2. **Features**
   - Native window controls
   - System tray icon
   - Save connection profiles (no private keys)
   - Optional auto-update support (platform-specific)

3. **Distribution**
   - Build for Linux/macOS/Windows
   - Create installers
   - ~10MB final binary (typical)
   - Ensure feature parity with the browser-based client before shipping desktop builds

## Technology Stack Summary

### Backend:
```
Language: Go 1.21+
Dependencies:
  - gorilla/websocket
  - creack/pty
  - fsnotify/fsnotify
Binding: localhost:8443 only
```

### Frontend:
```
Framework: React 18 + TypeScript
Libraries:
  - xterm (v5) + xterm-addon-fit
  - @codemirror/basic-setup
  - @codemirror/lang-* (languages)
Build: Vite (fast, small bundles)
```

### Desktop (Optional):
```
Wails 3+ or Neutralino
```

## Performance Targets

### Backend:
- Idle memory: <30MB
- Per terminal: +5-10MB
- CPU idle: <1%
- Binary size: <15MB

### Frontend:
- Initial load: <500ms
- Bundle size: <2MB gzipped
- Time to interactive: <1s

### Desktop App:
- Binary size: ~10MB (Wails) or ~2-5MB (Neutralino)
- Memory overhead: <50MB

## Development Workflow

### Repository Structure:
```
project/
├── backend/
│   ├── main.go
│   ├── handlers/
│   ├── terminal/
│   └── config/
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── desktop/ (optional)
│   └── tauri/
├── scripts/
│   ├── install.sh       # Deploy to remote server
│   ├── connect.sh       # SSH tunnel + open browser
│   └── dev-server.service  # SystemD template
└── README.md
```

### Build Process:
1. Build frontend: `npm run build` → `dist/`
2. Embed frontend in Go binary (embed.FS)
3. Build Go: `go build -ldflags="-s -w"` (strip symbols)
4. Single binary output: `dev-server`

### Deployment:
```bash
# One-time setup (from laptop):
./scripts/install.sh user@remote-server

# Daily usage:
./scripts/connect.sh user@remote-server
# Opens browser to localhost:8443 automatically
```

## Platforms & Testing

- **Client cross-platform support:** The client (browser-based or desktop wrapper) must run on **Windows, macOS, and Linux**. Desktop builds should be validated on all three platforms before releases.
- **Testing note:** Primary manual testing for the desktop client will be performed on **Windows** (user testing environment). Automated CI should include a matrix that runs the frontend build and smoke tests on Windows/macOS/Linux where practical.
- **Development environment:** All active development (server + integration testing) will be done on remote Linux hosts; this simplifies server-side testing (SystemD, PTY behavior). Use the `--static-dir` mode for local frontend iteration and a remote tunnel for end-to-end tests.
- **CI guidance:** In CI, run server unit/integration tests on Linux runners; run frontend build and lints on all OS runners if desktop packaging is part of the pipeline.
 - **Browser-first strategy:** Implement and validate all features in the browser client first (Vite dev server or served via `--static-dir`). Once stable, wrap the same frontend in Wails for desktop releases.

## Code & Quality

- **Backend (Go):**
   - Formatting: `gofmt` / `gofumpt`
   - Linting: `golangci-lint` (run `govet`, `errcheck`, `staticcheck` rules)
   - Tests: unit tests for handlers and terminal manager; small integration tests for PTY/WebSocket using ephemeral ports and `pty` mocks where possible

- **Frontend (React + TypeScript):**
   - Formatting: `prettier`
   - Linting: `eslint` with TypeScript rules
   - Type checks: `tsc --noEmit`
   - Tests: component/unit tests (Jest/Playwright for small E2E)

- **Desktop wrapper (Wails):**
   - Ensure the packaging script validates the frontend build, runs smoke tests, and produces platform-specific artifacts.

- **Pre-commit & hooks:**
   - Use `pre-commit` or Git hooks to run formatters and linters locally (`gofmt`, `prettier`, `eslint`) to keep diffs clean.

- **CI / PR requirements:**
   - CI must run linters, format checks, and tests on pull requests.
   - Require a passing CI and at least one approving review before merge.

- **Small, readable docs:** Keep in-repo `CONTRIBUTING.md` with setup steps for remote dev, test commands, and how to build desktop artifacts on each OS.

- **Documentation conventions:** Provide at least a one-line description for every function/method (Go: `//` comments above declarations; TypeScript: JSDoc `/** ... */`). Keep comments concise and updated.
- **Type discipline & OO:** Use strong typing in React + TypeScript, prefer explicit types over `any`, and apply object-oriented patterns (classes/interfaces) where it improves clarity and reuse.


### install.sh does:
```bash
# Build binary
go build -o dev-server

# Copy to server
scp dev-server user@remote:~/bin/

# Setup SystemD user service
ssh user@remote << 'EOF'
mkdir -p ~/.config/systemd/user/
cat > ~/.config/systemd/user/dev-server.service << 'SERVICE'
[Unit]
Description=Lightweight Dev Server

[Service]
ExecStart=%h/bin/dev-server --port 8443 --root %h
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
SERVICE

systemctl --user daemon-reload
systemctl --user enable dev-server
systemctl --user start dev-server
EOF
```

### connect.sh does:
```bash
#!/bin/bash
SERVER=$1
ssh -L 8443:localhost:8443 -N -f $SERVER
sleep 1
xdg-open http://localhost:8443  # or 'open' on macOS

## Testing & CI:
- [ ] Unit tests for core backend handlers (file API, terminal manager)
- [ ] Integration test that starts server, opens PTY, and exercises WebSocket
- [ ] End-to-end smoke test over SSH tunnel (connect, open file, save, spawn shell)
- [ ] Add lightweight CI pipeline (GitHub Actions) to run linters and tests on push

### Operational / Security Clarifications (recommendations):
- **TLS option:** Although SSH tunnel provides encryption for user setups, add an optional TLS configuration (`--tls-cert`, `--tls-key`) to support non-tunnel deployments or when users prefer direct HTTPS behind a firewall or reverse-proxy.
- **Authentication:** Consider an optional short-lived session token (cookie/localStorage) to isolate multiple browser tabs and help handle automatic reconnects; do not treat this as a replacement for SSH auth.
- **Privilege boundaries:** Document that the server runs as the invoking user and will have the same filesystem access; recommend that users install under their own account, not root.
- **Path root vs home:** Default `--root` to `$HOME` but allow overriding; enforce that all file operations are confined to the configured root (resolve symlinks before access).
- **Rate limiting and quotas:** Add configurable rate limits per-IP (or per-connection when behind tunnel) and an optional per-user file upload size quota.

## Open Questions / Decisions Needed

- Do you want an optional TLS mode for direct HTTPS access (in addition to SSH-only)?
- Should the binary attempt automatic updates or leave that to the package/distribution method?
- What is the minimum supported shell behavior (e.g., login shell vs non-login shell) and do we need to preserve dotfiles like `.bashrc` vs `.profile`?
- Do you want per-user profiles (saved connection endpoints) built into the desktop wrapper or handled externally?
- Is multi-user single-machine use a requirement (multiple users connecting to the same user session)?

## Suggested Immediate Tasks (small and testable)

- Add a small `healthcheck` endpoint that reports version, uptime, and active sessions.
- Implement a `--static-dir` mode to iterate frontend without embedding during development.
- Write one E2E smoke test that uses `ssh -L` to create a tunnel, then performs `GET /api/tree?path=` and `/ws/terminal` handshake (can be a scripted test using `expect` or a Go integration test).

---

If you'd like, I can apply these changes directly as edits (done), or split them into a checklist of tasks in the repo's issue tracker. Tell me which you'd prefer and whether to add a small GitHub Actions workflow for tests.
```

## Success Metrics

### Must Have:
- ✓ Memory usage <50MB total
- ✓ Edit and save files
- ✓ Functional terminal
- ✓ File tree navigation
- ✓ Works over SSH tunnel
- ✓ Survives server reboots (SystemD)
- ✓ Single-command deployment

### Nice to Have:
- Search across files
- Multiple terminals
- Syntax highlighting for 20+ languages
- Git integration
- Desktop app

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CodeMirror too heavy | Medium | Start with basic-setup, add features incrementally |
| WebSocket stability | High | Implement reconnection logic, heartbeat pings |
| Large file handling | Medium | Stream files, add size limits |
| SSH tunnel drops | Medium | Auto-reconnect frontend, SystemD auto-restart backend |
| Port already in use | Low | Allow port configuration, check on startup |

## Next Steps

1. **Immediate:** Set up Go project structure
2. **Day 1:** Implement basic HTTP server + terminal WebSocket
3. **Day 2:** Create file API endpoints + test via SSH tunnel
4. **Day 3-4:** Build React frontend basics
5. **Day 5:** Create deployment scripts (install.sh, connect.sh)
6. **Week 2:** Polish and optimization

## Resources Needed

- Development time: 2-3 weeks
- Testing environment: Remote Linux server with SSH access
- Local development: Go 1.21+, Node.js 18+
- No SSL certificates needed (SSH tunnel provides encryption)
- Optional: Code signing cert for desktop app

## Connection Workflow (Daily Use)

```bash
# Terminal 1: Establish tunnel
ssh -L 8443:localhost:8443 user@remote-server

# Terminal 2 (or automatic):
open http://localhost:8443

# Server is already running (SystemD keeps it alive)
# Browser connects through encrypted SSH tunnel
# All file operations respect your user permissions
```


