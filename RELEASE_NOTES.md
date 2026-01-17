# MLCRemote 1.3.0 Release Notes

## New Features
- **Enhanced Windows Support**: Improved detection for Windows 10 and Windows 11, including specific OS icons in the connection UI.
- **UI Improvements**: Added better contrast for "PRO" badges and task buttons in Light Mode.
- **Improved Settings Persistence**: Fixed an issue where changing one setting (like completing the Tour) could reset others.

## Bug Fixes
- **Tour Persistence**: The onboarding tour now correctly remembers if it has been completed and will not show on subsequent launches.
- **OS Detection**: Fixed visual glitches in OS architecture display (e.g., "linux/amd64" is now "linux amd64").

## Backend Updates
- **Agent Version**: Bumped to 0.3.5.
