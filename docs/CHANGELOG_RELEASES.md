# Release notes

## 0.2.0 - 2025-12-28

### Added
- Health endpoint now returns `host` (hostname) and additional runtime metrics.

### Changed
- WebSocket terminal connections now create tracked server-side sessions so `ShutdownAllSessions()` can terminate shells on server shutdown.
- Frontend: About dialog shows friendly health metrics (PID, host, memory, CPU) and memory tooltip displays human-readable MB/GB values.

### Fixed
- Ctrl-C / server shutdown now terminates PTY-backed shells started from the Web UI.

### UI / UX
- Frontend: TabBar menu added with `Close`, `Close Others`, and `Close Left` actions; per-tab dropdown is keyboard accessible and themed for light/dark modes.
- Frontend: FileExplorer `autoOpen` mode added; when disabled, a `View` (eye) button will focus or open files without changing navigation.
- Frontend: Editor now renders image previews inline and suppresses the binary notice when showing images.
- Frontend: Editor status messages (e.g., "Reloaded") clear automatically after 2 seconds.
- Frontend: Large images and editor content scroll inside main content area to avoid creating a page-level scrollbar.

