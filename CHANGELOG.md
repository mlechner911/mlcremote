# Changelog

## [Unreleased]
- **Bug Fix**: Fixed Server Logs view not displaying in desktop app due to type mismatch.
- **Code Quality**: Refactored special tab identifiers to use constants with `__special__` prefix, preventing conflicts with real file paths.
- **UI/UX**: Added visual error indicators for unknown tab types instead of silent failures.

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
