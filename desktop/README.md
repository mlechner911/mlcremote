# Light Dev Desktop (Wails)

This is the Wails desktop wrapper for the Lightweight Remote Dev Environment.
It loads the same React frontend used for the browser client and wraps it in a native window.

## Prerequisites
- Go 1.21+
- Node.js 18+
- Wails CLI installed:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## Browser-first workflow
1. In `frontend/`, build the UI:
   ```bash
   npm install
   npm run build
   ```
2. Run the backend serving `frontend/dist`:
   ```bash
   ./bin/dev-server --port 8443 --root "$HOME" --static-dir "$(pwd)/frontend/dist"
   ```
3. Open the browser to `http://127.0.0.1:8443` and validate features.
4. Once stable, test the desktop wrapper.

## Desktop dev (hot reload)
From `desktop/`:
```bash
wails dev
```
- This uses the dev server at `http://localhost:5173`.
- In another terminal, run `npm run dev` in `frontend/`.

## Build desktop app
From `desktop/`:
```bash
# Ensure frontend is built first
(cd ../frontend && npm run build)
wails build
```

Artifacts will be placed in `build/bin/`.

## Notes
- The wrapper stores profiles and connects to the backend via the SSH tunnel (`localhost:8443`).
- Ensure parity with the browser client before shipping desktop builds.
