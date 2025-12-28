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

- The health type used by `getHealth()` includes an optional `host` field; the App uses this to show the remote host.
- The tooltip is implemented using the `title` attribute for simplicity; if you prefer a richer tooltip component, replace it with a library or custom component.

How to verify

1. Start the backend and frontend.
2. Observe the header: if the backend is up, the host should appear; otherwise the header will show `backend unavailable`.
3. When the memory gauge is visible, hover the percent value to see the tooltip with detailed usage numbers.
4. Open a shell tab and then exit the shell — the tab should be removed automatically.
