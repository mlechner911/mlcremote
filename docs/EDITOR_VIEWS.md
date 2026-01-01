# Editor View Decision & Syntax Mapping

This document describes the new editor/view selection logic and filename-based syntax highlighting added to the frontend.

Files added/changed

- `frontend/src/components/decideEditorToUse.ts`
  - Exports `EditorView` enum and `decideEditorToUse({ path, meta, probe })` which returns the correct view to render for a given file.
- `frontend/src/components/Editor.tsx`
  - Uses `decideEditorToUse` to pick which viewer component to render.
- `frontend/src/languageForFilename.ts`
  - Helper that maps well-known filenames (e.g. `.bashrc`, `Makefile`, `Dockerfile`) to effective language tokens.
- `frontend/src/grammar.ts`
  - Updated to include mappings for `makefile`, `dockerfile`, and filename tokens like `bashrc`.
- `frontend/src/components/TextView.tsx`
  - Imports Prism's `makefile` component to enable Makefile highlighting.

Goals

- Centralize decision logic for which viewer to use (text, image, pdf, shell, directory, binary, etc.).
- Prefer reliable inspector/probe data from the backend where available.
- Allow explicit filename-based mappings so files without conventional extensions (like `Makefile` or `.bashrc`) get the right syntax highlighting.
- Make the system easier to extend with new viewers.

How it works

1. The UI calls `decideEditorToUse({ path, meta, probe })`.
   - `meta` is the stat result from the backend (used to detect directories, size, mode).
   - `probe` is the result of `probeFileType(path)` — contains `mime`, `isText`, and `ext` if available.
2. The decider returns an `EditorView` enum value (e.g. `TEXT`, `IMAGE`, `PDF`, `SHELL`, `DIRECTORY`, `BINARY`, `UNSUPPORTED`).
3. `Editor.tsx` renders the corresponding component for that enum value.

Syntax/highlight selection

- For text views, the editor computes an effective extension token used by the highlighting code.
- The priority is:
  1. Filename mapping from `languageForFilename` (explicit known filenames),
  2. `probe.ext` returned from the backend probe,
  3. `extFromPath(path)` — the normal extension-based fallback.

- `TextView` uses functions from `frontend/src/grammar.ts` (`aliasForExt` and `langForExt`) to map the effective token to Prism language and alias strings.
- To add support for a language:
  1. Ensure you import the Prism component for that language in `TextView.tsx` (so it is bundled only for text views).
  2. Update `grammar.ts` to return the correct Prism `lang` and `alias` for your token.
  3. If the language applies to special filenames (not just extensions), add a mapping in `languageForFilename.ts`.

Examples

- `Makefile` -> `languageForFilename` returns `makefile` -> `grammar.aliasForExt('makefile')` -> `'makefile'` -> Prism highlights correctly.
- `.bashrc` -> `bashrc` token -> `grammar.aliasForExt('bashrc')` -> `'bash'` -> Prism uses bash rules.

Extending with new viewers

1. Add a new member to `EditorView` in `decideEditorToUse.ts`.
2. Update `decideEditorToUse` with logic that returns the new enum value in appropriate situations.
3. Implement the viewer component (or reuse an existing one) and import it in `Editor.tsx`.
4. Add a `case` to the `switch(view)` in `Editor.tsx` to render the new viewer.

Testing

- The frontend can be built locally via:

```bash
cd frontend
npm run build
```

- For quick iteration during development:

```bash
cd frontend
npm run dev
```

Notes

- The decision logic still prefers backend probe (mime/isText) where available — keep the backend probe endpoint accurate for best results.
- The filename mapping is intentionally conservative and can be augmented over time as real files in the repository require special handling.

Contact

If you want more filename mappings added now (e.g. `.gitconfig`, `.vimrc`, `.tmux.conf`), list them and I will add them and run a build.
