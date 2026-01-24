# Changelog

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
