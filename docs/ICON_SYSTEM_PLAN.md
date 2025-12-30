**Icon System Plan**

Goal: Create a manifest-driven SVG icon system that centralizes vector assets in an `icons/` directory and produces a compact sprite and small React wrapper used by the frontend. This reduces duplication, improves cacheability, and keeps icons editable by designers without touching TypeScript source.

High-level overview:
- Source: `icons/` directory containing individual SVG files.
- Manifest: `icons/icons.yml` describing icons and mappings (mime-type, extensions, logical name, filename, optional metadata).
- Generator: CLI/script that consumes manifest and SVGs, validates inputs, optimizes SVGs (svgo), creates a single sprite `frontend/src/generated/icons-sprite.svg` and a TypeScript wrapper `frontend/src/generated/icons.tsx` exporting a small API to reference icons by name or by file type mapping.
- Integration: Frontend imports the generated wrapper (not the raw sprite) and uses a small `Icon` component that renders <svg><use href="#symbol-id"/></svg>.

Manifest schema (YAML):

```
# icons/icons.yml
version: 1
defaults:
  sprite_prefix: "icon"
icons:
  - id: folder
    name: Folder
    file: folder.svg
    mime: application/x-directory
    extensions: [""]

  - id: pdf
    name: PDF
    file: pdf.svg
    mime: application/pdf
    extensions: ["pdf"]

  - id: markdown
    name: Markdown
    file: markdown.svg
    mime: text/markdown
    extensions: ["md", "markdown"]

  - id: image
    name: Image
    file: image.svg
    mime: image/*
    extensions: ["png", "jpg", "jpeg", "gif", "svg"]

  - id: text
    name: Text
    file: text.svg
    mime: text/plain
    extensions: ["txt"]

  - id: archive
    name: Archive
    file: archive.svg
    mime: application/zip
    extensions: ["zip", "tar", "gz", "bz2"]

  - id: js
    name: JS
    file: javascript.svg
    mime: application/javascript
    extensions: ["js", "mjs"]

  - id: json
    name: JSON
    file: json.svg
    mime: application/json
    extensions: ["json"]

# Optional: per-icon color hints, accessibility labels, keywords
```

File layout suggestion:
- icons/
  - icons.yml
  - raw/
    - folder.svg
    - pdf.svg
    - markdown.svg
    - image.svg
    - text.svg
    - archive.svg
    - javascript.svg
    - json.svg
    - download.svg
    - upload.svg
    - settings.svg
    - close.svg
    - info.svg
    - warning.svg
    - terminal.svg
    - play.svg
    - stop.svg
    - search.svg
    - refresh.svg
    - chevron-left.svg
    - chevron-right.svg
    - plus.svg
    - minus.svg
    - home.svg
    - up.svg
    - user.svg
    - server.svg
    - screenshot.svg
    - log.svg

Generator responsibilities:
- Validate manifest and that referenced files exist in `icons/raw`.
- Run `svgo` (optional) to normalize and minimize SVGs.
- Assign stable symbol IDs using `defaults.sprite_prefix` + `id` or fallback to filename-derived ids.
- Emit `frontend/src/generated/icons-sprite.svg` (single SVG containing symbol defs).
- Emit `frontend/src/generated/icons.tsx` with:
  - An `Icon` React component that accepts `name`, `className`, `title`, and `size` props.
  - A mapping of file extensions → icon id for quick lookup.
  - A mapping of mime patterns → icon id for fallback matching (e.g., `image/*`).

- Acceptance criteria:
- Generator runs and produces the two generated files.
- Supports both developer-run script and the Go CLI binary.
- Example usages:

  - Build and run the Go generator (recommended):

    ```bash
    go build -o bin/icon-gen ./cmd/icon-gen
    ./bin/icon-gen --manifest icons/icons.yml --raw icons/raw --out frontend/src/generated
    ```

  - Run directly with `go run` (convenience):

    ```bash
    go run ./cmd/icon-gen --manifest icons/icons.yml --raw icons/raw --out frontend/src/generated
    ```

  - Optional: override sprite prefix:

    ```bash
    ./bin/icon-gen --manifest icons/icons.yml --raw icons/raw --out frontend/src/generated --prefix custom
    ```
- Frontend compiles cleanly with the generated imports.
- Existing components can be updated to reference `Icon` and get identical visuals.
- Sprite should be under 10 KB gzipped for the initial set of icons (goal; optimize later).

Next steps (short-term):
1. Add `icons/icons.yml` manifest and a small set of placeholder SVGs in `icons/raw`.
2. Implement a POC generator script that inlines the raw SVG contents into a `<symbol>` sprite and emits a small `icons.tsx` wrapper.
3. Migrate `FileExplorer` and `TabBar` to use the generated `Icon` component for 3 icons and validate UI.
4. Iterate: add svgo optimization, CLI flags, and CI check.
