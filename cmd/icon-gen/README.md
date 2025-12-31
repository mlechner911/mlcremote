Icon generator for mlcremote

Usage
-----

- Build:

```
go build -o bin/icon-gen ./cmd/icon-gen
```

- Run:

```
./bin/icon-gen --manifest icons/icons.yml --raw icons/raw --out frontend/src/generated
```

Behavior
--------
- The generator reads `icons/icons.yml` and inlines files from `icons/raw/` into a single SVG sprite and emits a TypeScript wrapper `icons.tsx`.
- Generated files include a header comment block with a timestamp and a clear "DO NOT EDIT — generated file" marker and a short description of the mlcremote project.
- The emitted TypeScript helper `iconForMimeOrFilename(mime, filename)` maps mime types and extensions to the sprite symbol ids.

Integration
-----------
- After generation, import the generated `icons.tsx` from `frontend/src/generated` and use the `Icon` component or `iconForMimeOrFilename` helper.
