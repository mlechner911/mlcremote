# MLCRemote Release Notes

## [1.3.4] - 2026-01-17
### New Features
- **Smart Clipboard (Premium)**: 
    - **Remote to Local**: Seamlessly copy files from the remote server to your local Windows clipboard (`Ctrl+V` in persistent temp folder).
    - **Local to Remote**: Paste files from your local machine directly to the active remote directory.

### Bug Fixes
- **Clipboard Fixes**: Fixed a critical issue with Windows `DROPFILES` struct preventing pastes in Explorer.

## [1.3.3] - 2026-01-17
### Fixed
- **SSH Improvements**: Added automatic reconnect mechanism when the SSH tunnel drops (e.g., due to network interruptions), including a new "Connection Lost" dialog.
- **Tour Persistence**: Fixed an issue where changing the root directory caused the onboarding tour to reappear. 
- **Invalid Root**: Added graceful fallback to the home directory if the configured root path does not exist, with a user warning.

## [1.3.2] - 2026-01-17
### Fixed
- **Persistence**: Fixed an issue where the "Root Directory" setting was not being saved.
- **Translations**: Added missing translations for Root Directory settings.

## [1.3.1] - 2026-01-16
### Fixed
- Fixed SVG file handling: now correctly served as `image/svg+xml` to prevent broken previews and text-only downloads.
- Added proper SVG preview and syntax highlighting in the editor.
- Updated documentation and screenshots.

## [1.3.0] - 2026-01-15
### New Features
- **Enhanced Windows Support**: Improved detection for Windows 10 and Windows 11, including specific OS icons in the connection UI.
- **UI Improvements**: Added better contrast for "PRO" badges and task buttons in Light Mode.
- **Improved Settings Persistence**: Fixed an issue where changing one setting (like completing the Tour) could reset others.

### Bug Fixes
- **Tour Persistence**: The onboarding tour now correctly remembers if it has been completed and will not show on subsequent launches.
- **OS Detection**: Fixed visual glitches in OS architecture display (e.g., "linux/amd64" is now "linux amd64").

## Backend Updates
- **Agent Version**: Bumped to 0.3.5.
