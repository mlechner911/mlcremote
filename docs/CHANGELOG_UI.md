# UI changes — Status indicator, tooltips, and tab behavior

This document summarizes the front-end changes made to improve the user experience and align behavior with the backend session model.

Key changes

- Header status text and host display:
  - The header now displays the backend `host` value returned from `/health` when available.
  - When the backend health response is not available, the header now shows `backend unavailable` instead of the previous `not connected` text.

- Memory gauge tooltip:
  - The small percent value next to the memory bar now has a native tooltip (via the `title` attribute) showing detailed numbers: `Memory usage: <used> / <total> bytes (<pct>%)`.
  - This provides more context without changing the compact header layout.

- Tab behavior and shell lifecycle:
  - Shell tabs (`shell-*`) are created by the UI using the selected path as the initial `cwd`.
  - Terminal components now signal `onExit()` which the App uses to close the shell's tab and remove its tracked `cwd` on process exit.
  - Directory selections in the file explorer do not create persistent tabs — they only navigate the explorer.

Developer notes

- The health type used by `getHealth()` includes an also a  `host` field; the App uses this to show the remote host.


