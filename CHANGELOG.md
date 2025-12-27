# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2025-12-27

### Added
- Backend: REST file APIs (`/api/tree`, `/api/file`, `/api/stat`, `/api/filetype`).
- Terminal: WebSocket PTY bridge with persistent session creation (`/api/terminal/new`) and session attach (`/ws/terminal?session=<id>`).
- Server: Path sanitization and safe-delete to `.trash`.
- Graceful shutdown support and `ShutdownAllSessions()` to close PTYs and websockets.
- Frontend: React + Vite UI with Prism overlay editor and optional lazy CodeMirror integration.
- Terminal UI: xterm.js integration with Fit addon and per-tab sessions.
- Desktop scaffold: Wails prototype with Connect and Settings dialogs and `HealthCheck` binding.
- Docs: `docs/PLAN.md` updated, `docs/DESKTOP.md`, `docs/DEV_SETUP.md` and `README.md` restyled.

### Changed
- Many backend Go files annotated with license header and short comments.

### Fixed
- Build fixes for Wails scaffold (updated to use `options.App` for wails v2 API).

