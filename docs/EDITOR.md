# Editor internals and behavior

This document describes the Editor component behavior and the conventions we use so contributors and maintainers understand how file metadata, highlighting, and save behavior work.

## Key behaviors

- Syntax highlighting
  - The editor uses Prism.js for syntax highlighting. Supported languages are imported in `frontend/src/components/Editor.tsx`.
  - The editor prefers the backend probe (`/api/filetype`) result when available to determine the file grammar (extension and MIME). This is more accurate than deriving the grammar purely from the file extension.
  - The DOM contains `data-grammar` attributes on both the highlighted `<pre>` and the editable `<textarea>` elements. This makes it easy to inspect the current grammar in browser devtools.
  - When `grammar` or `content` changes, the component re-runs `Prism.highlightElement` on the code node to ensure Prism applies the correct language rules.

- Metadata and filesize
  - After opening a file the editor fetches `statPath(path)` and caches metadata in the parent `App` component.
  - After a successful save the editor re-stats the file and calls the parent's `onMeta` callback with updated metadata so the UI (tab headers, metadata line) shows the new file size immediately.
  - The formatted filesize is displayed in the editor header metadata line (not in the tab header).

- Unsaved changes
  - `onUnsavedChange` is called only when the computed unsaved state (content !== origContent) changes. This avoids infinite update loops between the Editor and its parent.

- Attributes on form control
  - The editable `textarea` is assigned a unique `id` (derived from the full path, sanitized) and a `name` attribute to avoid browser console warnings and to make the element referenceable in tests.

## Adding new languages
- To support a new Prism language, import its component in `frontend/src/components/Editor.tsx`. Example:

```ts
import 'prismjs/components/prism-rust'
```

- Then add mapping in `aliasForExt` and `langForExt` so Prism receives the correct language token for highlighting.

## Debugging
- If grammar mismatches occur:
  1. Inspect the `pre` element's `data-grammar` attribute; it should reflect the probe-detected grammar if the server probe ran.
  2. Check the server `/api/filetype` response for the file (browser devtools network tab).
  3. Ensure the Prism language module for that grammar is imported.

## Files
- `frontend/src/components/Editor.tsx` — implementation
- `frontend/src/filetypes.ts` — probe and extension utilities
- `frontend/src/format.ts` — human-friendly formatting utilities (filesize)

If you want this document extended with screenshots or a small sequence diagram, tell me what level of detail you want.

## Recent changes

- Prefer backend `probe` for grammar detection and use `probe.ext` when available.
- Show a friendly filetype label (via `aliasForExt`) next to the MIME in the editor header (e.g. `text/markdown (markdown)`).
- After saving, the editor re-stats the file and calls `onMeta` so filesize updates immediately.
- Added `data-grammar` attributes to the `<pre>` and `<textarea>`, and re-run Prism highlighting when grammar or content changes.
- Added unique `id` and `name` attributes to the editor `textarea`.

These changes are intended to improve accuracy of grammar selection and make the editor behavior more predictable.
