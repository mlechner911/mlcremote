# Changelog

All notable changes to this project will be documented in this file.


## [1.2.1] - 2026-01-15

### Added
- **Tabbed Interface**: Connection profiles now use tabs ("General", "Extended", "Tasks") for better organization.
- **Log Viewer Improvements**: Added pause/resume toggle and structured colored logs.
- **Extended Shell Config**: Moved default shell configuration to an "Extended" tab.

### Fixed
- **XML Highlighting**: Fixed missing syntax highlighting for XML files.
- **ZIP Preview**: Fixed "Access Denied" error when previewing ZIP files on Windows.
- **PDF Preview**: Fixed "Factory Worker" error preventing PDF previews from loading.
- **File Tree**: Fixed text selection annoyance on double-click and restored active file highlighting.
- **Secure Logs**: Filtered `/api/logs` requests from the access log to prevent noise.

## [1.1.0] - 2026-01-09

### Added
- **Authentication Overlay**: Extracted authentication logic into `AuthOverlay` component with full localization support.
- **Internationalization**: Added complete translations for English, German, French, and Spanish.
- **Improved Status Bar**: Status bar now displays "Connected since: [Time] [Timezone]" derived from the remote server start time.

### Changed
- **Frontend Refactor**: Split monolithic `App.tsx` into `useAppSettings`, `AppHeader`, and `useWorkspace` for better maintainability.
- **Backend Version**: Bumped backend and frontend requirement to `0.3.1`.

## [1.0.1] - 2026-01-08

### Added
- **Connection Progress Feedback**: Users now see real-time status updates (Detecting OS, Deploying Agent, etc.) during connection instead of a generic loading state.

## [1.0.0] - 2026-01-08

### Added
- **Custom Error Dialogs**: Replaced native browser alerts with styled, theme-aware dialogs for errors and confirmations.
- **Profile Duplication Check**: Prevents accidental creation of duplicate profiles by prompting to update existing ones.
- **File Details Tab**: New dedicated view for files when "Auto Open" is disabled. Shows metadata (size, permissions, timestamps), full path, and a download button.
- **File Explorer**: Selecting a file with Auto Open disabled now opens/focuses the File Details tab instead of creating empty tabs.
- **Remote OS Info**: Status bar now displays the remote operating system and distro.
- **Improved Visuals**: Enhanced File Explorer selection visibility with theme-aware accent colors.

### Changed
- **Windows Shell**: Improved shell execution on Windows. Now falls back to pipes when PTY creation fails (fixing "unsupported" errors).
- **Frontend Refactor**: Major refactoring of file handling logic using a Strategy Pattern.
- **UI Polish**: Moved Theme/Screenshot controls to the header for better accessibility.

### Fixed
- **Version Display**: Fixed "vunknown" version issue on Windows clients.
- **Stat Failed Error**: Fixed an issue where the "File Details" view would lose context of the selected file.
- **PDF Detection**: Fixed PDF files sometimes not opening correctly.
- **Auto-Login**: Fixed a race condition where the token URL parameter was ignored on startup.
- **Tab Context Menu**: Adjusted "Close Other" and "Close Left" options to only appear when relevant (e.g., multiple tabs open).
- **Split View**: Fixed an issue where split panes would not automatically close when the last tab within them was closed.
- **Windows Build**: Fixed `make run` failing on Windows due to `mkdir -p` syntax.
- **Symlink Dirty State**: Opening a symlink to a directory no longer incorrectly shows the "unsaved changes" indicator.
- **Binary Views**: "Unsupported" files now correctly share the single "Binary" tab instance.

## [0.4.0] - 2026-01-01

### Added
- **Status Bar**: dedicated component at bottom of screen for health, connection status, and memory usage.
- **Context Menu**: Right-click actions in File Explorer (Open, Download, Copy Full/Relative Path, Delete).
- **Editor**: Added Ctrl+S shortcut, conditional Save button (only shows when unsaved), and auto-reload on save.
- **Icons**: New SVG icons for Copy and Link actions.
- **File Explorer**: Added Refresh button to header.

### Changed
- **UI Layout**: Moved status indicators from header to Status Bar for a cleaner look.
- **File Explorer**: Removed inline "Download" button (moved to Context Menu) to reduce clutter.
- **Editor**: "Reloaded" and "Saved" status messages now auto-clear after 1.5s.

## [0.3.0] - 2026-01-01

### Added
- **Docker Support**: Full development workflow with `make docker-dev` including hot reload (Air) and isolated data volume.
- **Symlink Support**: Backend now detects symbolic links, and Frontend displays them with a 🔗 icon. Includes validation for broken (❌) and external (↗️) links.
- **Documentation**: Added `DOCKER.md` with setup and usage instructions.

### Changed
- **Logging**: Access URLs in logs now use `localhost` instead of `0.0.0.0` when running in Docker for better clickability.
- **Makefile**: Improved Windows compatibility by replacing shell scripts with `go run` commands and handling volume mounts robustly.

## [0.2.1] - 2025-12-29

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
- Fixed light mode editor text color to be dark instead of light grey for better readability.


## 0.2.0 - 2025-12-28

### Added
- Health endpoint now returns `host` (hostname) and additional runtime metrics.

### Changed
- WebSocket terminal connections now create tracked server-side sessions so `ShutdownAllSessions()` can terminate shells on server shutdown.
- Frontend: About dialog shows friendly health metrics (PID, host, memory, CPU) and memory tooltip displays human-readable MB/GB values.

### Fixed
- Ctrl-C / server shutdown now terminates PTY-backed shells started from the Web UI.

