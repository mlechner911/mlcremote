Recent UI & settings changes

This document summarizes recent frontend UI, settings, and server-info changes made to the project.

Changes:

- "Change root" button
  - Added a "Change root" button to the File Explorer header which delegates selection to the parent `App` component.
  - App attempts to use the browser File System Access API when available; otherwise prompts the user for a server-side path.
  - The chosen path is validated via the `/api/stat` (client helper `statPath`) to ensure it exists and is a directory before applying.
  - The selected root is persisted to `localStorage` under `lastRoot`.

- Settings dialog wording
  - Clarified labels in the settings popup:
    - `Auto open` → `Auto open files`
    - `Show hidden` → `Show hidden files`
    - `Show logs` → `Show server logs`
    - `Hide server name` → `Hide server name in header`
    - `Hide memory usage` → `Hide memory usage gauge`
  - Removed the "Quick docs" textarea from the settings popup to simplify the dialog.

- About / Server Info
  - Consolidated server info (server time, timezone) into the main About modal instead of a separate small info popup.
  - About modal now has a top-right ✖ close button for consistency with Settings popup.

- Explorer download UI
  - Replaced the textual "Download" link with the glyph ⭳ and added `title` and `aria-label` attributes for accessibility.

- Visual / CSS fixes
  - Icon-like header buttons no longer show underlines on hover (`.link.icon-btn`), while keeping an accessible focus outline.
  - Ensured the About modal close button is visible in both dark and light themes by using `color: var(--text)` and hover/focus styles.

Build & verification

- Frontend build was run after changes to verify there are no TypeScript or build errors.

Notes / next steps

- The File System Access API cannot map browser handles to server filesystem paths; the prompt fallback is used to ask for server-side paths when needed. Consider adding a server-side directory browser API for a better UX.
- The `lastRoot` key in `localStorage` is a convenience; if server-side persistence is desired, consider adding an API for storing per-user workspace preferences.

