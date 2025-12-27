# Contributing

This document describes how to set up a local development environment for the Lightweight Remote Dev Environment project, run tests, and perform basic packaging. It also includes optional Docker instructions for local server testing and an example CI workflow that you can adapt later.

## Prerequisites

- Linux development host for server work (recommended)
- Go 1.21+
- Node.js 18+ and npm or yarn
- Optional (for desktop packaging): Go toolchain + Wails (see Wails docs)
- Optional (for Windows testing): a Windows machine/VM where you can run the desktop wrapper

## Repo layout

Work from the repository root. Key folders:

- `backend/` — Go server
- `frontend/` — React + TypeScript UI (Vite)
- `desktop/` — Desktop wrapper (Wails) (optional)
- `scripts/` — install/connect/dev service scripts

## Backend - setup & run (Linux)

Install dependencies and build:

```bash
# From repo root
cd backend
# Ensure Go 1.21+ is installed
go mod download
# Build dev-server binary
go build -o ../bin/dev-server ./...
```

Run server in dev mode (serve static from `--static-dir`):

```bash
# From repo root
mkdir -p bin
# Start server binding to localhost:8443, serving frontend from frontend/dist in dev
./bin/dev-server --port 8443 --root "$HOME" --static-dir "$(pwd)/frontend/dist"
```

Healthcheck:

```bash
curl http://127.0.0.1:8443/health
```

## Frontend - setup & run

```bash
# From repo root
cd frontend
npm install
# For local dev
npm run dev
# For production build
npm run build
# Dist output -> frontend/dist
```

### Browser-first testing workflow

1. Build the frontend (`npm run build`) or run it via `npm run dev` (Vite).
2. Start the backend and serve the built frontend with `--static-dir`:

```bash
./bin/dev-server --port 8443 --root "$HOME" --static-dir "$(pwd)/frontend/dist"
```

3. Open the browser to `http://127.0.0.1:8443` and validate features (file tree, editor, terminal).
4. Iterate in the browser until features are stable; only then proceed to desktop packaging with Wails.

## Desktop (Wails) - build (optional)

Follow Wails getting started docs for your platform. Minimal steps:

```bash
# From repo root
cd desktop
# Ensure Wails is installed and configured
# Build the frontend first
cd ../frontend && npm run build
cd ../desktop
wails build
```

For local desktop testing during development (hot reload):

```bash
# After frontend is built
wails dev
```

Ensure the desktop wrapper points to the same endpoints as the browser client (localhost via SSH tunnel in normal use).

Note: packaging requires platform-specific toolchains (e.g., for Windows builds on Linux you will need cross-compilation tooling or a Windows runner).

## Docker (optional) - lightweight server testing

You can run the backend inside Docker for local integration testing. This is useful if you want a reproducible Linux environment to validate SystemD behavior, PTY support, and server runtime characteristics.

Example Dockerfile (suggested path: `backend/Dockerfile`):

```Dockerfile
FROM golang:1.21-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
COPY backend/ ./
RUN go build -ldflags='-s -w' -o /bin/dev-server ./backend

FROM alpine:3.18
RUN apk add --no-cache ca-certificates
COPY --from=build /bin/dev-server /usr/local/bin/dev-server
EXPOSE 8443
ENTRYPOINT ["/usr/local/bin/dev-server", "--port", "8443", "--root", "/root"]
```

Build and run:

```bash
# From repo root
docker build -t lightdev-server -f backend/Dockerfile .
docker run --rm -p 8443:8443 -v "$HOME":/root -it lightdev-server
```

Notes:
- PTY behavior in containers may differ; test terminal functionality carefully.
- The container example mounts your home directory into the container for realistic testing; adjust as needed.

## Tests & Quality

### Go

Run unit tests and linters:

```bash
# From repo root
cd backend
# Run tests
go test ./... -v
# Run linters (requires golangci-lint installed)
golangci-lint run
```

### Frontend

```bash
cd frontend
npm run test
npm run lint
npm run build
```

### Pre-commit hooks

Install `pre-commit` hooks (recommended) to run formatters/lints locally.

## Example CI (local file, not enabled)

Below is a minimal GitHub Actions-style YAML you can adapt later. For now it's a reference showing the checks to run in CI.

```yaml
name: CI

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - name: Build and test
        run: |
          cd backend
          go test ./... -v
          golangci-lint run || true

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install and test
        run: |
          cd frontend
          npm ci
          npm run lint || true
          npm run build

  windows-desktop-smoke:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Frontend build (windows test)
        run: |
          cd frontend
          npm ci
          npm run build
```

## PR / Merge policy

- Run formatters and linters locally before opening PRs.
- CI must pass for the branch (once integrated).
- Include a brief description of what changed and how to test the change.

---

If you'd like, I can:
- Add the `backend/Dockerfile` file shown above to the repo.
- Add `pre-commit` configuration and example hooks.
- Create a minimal `github-actions` workflow file under `.github/workflows/ci.yml` (won't be enabled until you push to GitHub).

Tell me which of these you'd like next.
