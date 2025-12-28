# Release notes

## 0.2.0 - 2025-12-28

### Added
- Health endpoint now returns `host` (hostname) and additional runtime metrics.

### Changed
- WebSocket terminal connections now create tracked server-side sessions so `ShutdownAllSessions()` can terminate shells on server shutdown.
- Frontend: About dialog shows friendly health metrics (PID, host, memory, CPU) and memory tooltip displays human-readable MB/GB values.

### Fixed
- Ctrl-C / server shutdown now terminates PTY-backed shells started from the Web UI.
