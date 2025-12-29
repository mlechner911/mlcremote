LocalStore utility

Location

- `frontend/src/utils/storage.ts`

Purpose

- Centralize typed access to `localStorage`.
- Provide safe `get`/`set` helpers with simple serializers and defaults.

API

- `LocalStore(prefix?: string)` — constructor. Use `new LocalStore('myapp:')` to namespace keys.
- `get<T>(key, serializer, fallback?)` — read value; returns `fallback` if missing or parse fails.
- `getOrDefault<T>(key, serializer, defaultValue)` — read or return `defaultValue` when missing.
- `set<T>(key, value, serializer)` — write value.
- `remove(key)` — remove key.

Serializers

- `strSerializer` — simple string passthrough.
- `boolSerializer` — stores booleans as `1`/`0`.
- `jsonSerializer<T>()` — JSON serialize/deserialize.

Usage examples

1) Read a boolean with a default

```ts
import { defaultStore, boolSerializer } from './utils/storage'

const showHidden = defaultStore.getOrDefault('showHidden', boolSerializer, false)
```

2) Write a string prefixed key

```ts
import { defaultStore, strSerializer } from './utils/storage'

defaultStore.set('theme', 'dark', strSerializer)
```

3) Store and read a complex object

```ts
const userPrefs = { editorFontSize: 14 }
const jsonS = jsonSerializer<typeof userPrefs>()
defaultStore.set('prefs', userPrefs, jsonS)
const read = defaultStore.get('prefs', jsonS, null)
```

Notes

- The `defaultStore` instance is created with prefix `mlc:`.
- The utility catches storage exceptions (e.g., private mode) and will silently fall back to defaults.

Commit

This document will be committed to `docs/LOCALSTORE.md`.
