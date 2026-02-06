# Changelog

## [1.5.1] - 2026-02-06
- **Fix**: Resolved "Permission denied" error on remote stats polling. The agent deployment now ensures the binary is executable (`chmod +x`) even if the file hash indicates it is already up to date. This fixes issues caused by interrupted deployments.

## [1.5.0] - 2026-02-06
- **UI**: Implemented **Premium Dialog UI** with glassmorphism, smooth animations, and type-specific vibrant icon boxes.
- **Safety**: Added **Disconnect Warnings** to prevent data loss by alerting the user to active terminal processes or unsaved file changes before closing a session.
- **Improved**: Added a dedicated **Close (X)** button to all premium dialogs for enhanced usability.
- **Localization**: Added full translations for disconnect warnings and premium UI elements in EN, DE, ES, and FR.

## [1.4.8] - 2026-02-06
- **System**: Implemented frontend-backend version checking with mismatch warnings.
- **Improved**: Terminal busy detection now supports both Windows (via child process tracking) and Unix (hybrid IOCTL + child process detection).
- **UI**: Fixed untranslated strings for status and version info.
- **UI**: Corrected Markdown edit toggle icon from "shell" to "pencil".

## [1.4.7] - 2026-02-06
- **UI**: Enabled switching from **Preview** to **Edit** mode for Markdown and SVG files.
- **Improved**: Tab management now supports view type transitions (e.g. Preview -> Source) for already open tabs.

## [1.4.6] - 2026-02-02
- **UI**: Fixed version display in About dialog.
- **Maintenance**: Minor version bump to align backend and desktop flavors.

## [1.4.5] - 2026-02-02
**Server Monitoring & Audio Support**
- **Real-time Stats**: View CPU, RAM, and Disk usage for connected servers.
- **Visual Health Checks**: Sidebar status icons and color-coded badges for critical usage.
- **Audio Preview**: Integrated player for `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`.
- **Localization**: Full translation for Monitoring and Audio features (EN, DE, FR, ES).
- **Documentation**: New `FEATURES.md` listing all 15+ supported syntax highlighting languages.
- **One-Shot Collection**: Robust stats gathering via SSH command.
- **Persistence**: Usage history is saved to `stats.jsonl` for historical trends.

## [1.4.4] - 2026-01-24
- **Bug Fixes**: Fixed "Properties" context menu action to correctly open Metadata view instead of Preview.
- **Maintenance**: Removed unused NPM dependencies (`fix`, `pipe`, `audit`) from frontend.

## [1.4.3] - 2026-01-24
- **Bug Fixes**: Resolved issue where file properties (metadata) failed to load for valid files due to path ambiguity.
- **Improvements**: File Explorer now defaults to the user's home directory on startup.
- **Build**: Implemented automated installer build before push to ensure binary freshness.

## [1.4.2] - 2026-01-24
- **Refactoring**: Split `files.go` into modular components (`files_read`, `files_write`, `trash`) for better maintainability.
- **Documentation**: Added comprehensive GoDoc comments to `App` struct and file handlers.
- **Cleanup**: Deprecated `KillRemoteSession` in favor of `StopRemoteServer`.

## [1.4.0] - 2026-01-20
**Unified View & Details Update**
- **Unified Smart Preview**: Consolidated Metadata/Binary views into a single intelligent view with previews for Images, Markdown, and Archives.
- **Tab Management**: Added **Close (X)** button to tabs (VS Code style). Implemented Singleton tabs for unified navigation (Details, Directory, Logs).
- **Refinement**: Added file type icons to Metadata properties.
- **Layout**: Improved responsiveness for smaller screens (Header/Footer).
- **Fixes**: Fixed "Show Hidden Files" setting mismatch and Server Logs visibility.
- **Internal**: Refactored special tab identifiers and improved error handling.

## [1.2.3] - 2026-01-15
- **Configuration**: Enabled file deletion by default in server config.
- **UI**: Added **Rename** and **Delete** actions to the File Explorer context menu (Delete now uses a styled confirmation dialog).
- **Bug Fixes**: Improved error handling for file deletion to correctly report permission errors instead of generic failure messages.

## [1.2.2] - 2026-01-15
**The Polish Update**
- **Tabs Everywhere**: Connection profiles are now organized with tabs (General, Extended, Quick Tasks).
- **Log Viewer**: Structured, colored logs with pause controls.
- **File Renaming**: Added renaming for files and directories via context menu.
- **Bug Fixes**: Resolved critical issues with PDF/ZIP previews, XML highlighting, and file selection.

## [1.1.0] - 2026-01-09
**Authentication & Localization**
- **Auth Overlay**: New dedicated UI for authentication prompts.
- **Languages**: Added full translations for English, German, French, and Spanish.

## [1.0.0] - 2026-01-08
**The 1.0 Release**
- **Desktop Experience**: Production-ready Wails app with managed SSH keys.
- **File Explorer**: Drag & Drop upload, Trash support, and detailed file views.
- **Terminal**: Integrated SSH terminal with multiple tabs and PTY support.
- **Profiles**: Rich profile management with duplication detection and metadata.

## [0.2 - 0.4] - Beta Phase
- **Docker Support**: Full dev workflow with hot reload.
- **Symlink Support**: Visual indicators and validation.
- **Web UI**: React + Vite frontend with Prism editor.
