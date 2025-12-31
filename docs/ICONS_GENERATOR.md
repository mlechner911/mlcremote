# Icon Generator

This document describes the Go-based icon generator used to produce SVG sprite and TypeScript helpers for the frontend.

## What it does

- Reads `icons/icons.yml` (manifest) and `icons/raw/*.svg` (raw SVG icons).
- Produces these outputs in `frontend/src/generated/`:
  - `icons-sprite.svg` — an SVG sprite containing `<symbol>` entries for each icon.
  - `icons-types.ts` — TypeScript union types `IconExtKey` and `IconMimeKey` for available keys.
  - `icons.tsx` — a small React wrapper that exports `Icon` component and maps `extensionToIcon` and `mimeToIcon`.

## How to run

You can build and run the generator directly from the `cmd/icon-gen` module, or use the provided Makefile target.

Build and run generator directly:

```bash
cd cmd/icon-gen
go build -o ../../bin/icon-gen .
./bin/icon-gen --manifest icons/icons.yml --raw icons/raw --out frontend/src/generated
```

Or use the Makefile rule (recommended during normal development):

```bash
make icons-gen
```

The `frontend` Makefile target already depends on `icons`, so running `make frontend` will ensure icons are generated before building the frontend.

## Developer notes

- The generator emits `icons-types.ts` now; `icons.tsx` imports the types. This avoids duplicate declarations in the repo.
- Generated maps are typed as `Record<IconExtKey, string>` and `Record<IconMimeKey, string>`; dynamic lookups cast to `Record<string,string>` to preserve runtime flexibility.
- If you change `icons/icons.yml` or any `icons/raw/*.svg`, re-run `make icons-gen`.

## Future improvements

- Emit exhaustive maps to remove the `as unknown as` casting (stronger static types).
- Add a `SemanticIconKey` union for common semantic names if desired.
