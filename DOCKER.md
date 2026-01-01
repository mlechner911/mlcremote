# Docker Support for MLCRemote

MLCRemote can be fully run and developed within Docker. This ensures a consistent environment and isolates dependencies.

## Prerequisites

- Docker
- Make (optional, but recommended for easy commands)

## Running the Application

To build and run the production-ready Docker image:

```bash
make docker-run
```

This will:
1. Build the frontend.
2. Build the backend.
3. specific a minimal Alpine image.
4. Expose the server on port `8443` (default).
5. Mount your local home directory to `/data` (Wait, in `docker-run` we still use `HOME`).

> **Note**: On Windows, `make docker-run` attempts to mount `$(HOME)`. If you experience issues with "access to non-existent file", consider using the dev mode or overriding the volume.

## Development Mode

For development, use the `docker-dev` target. This enables **Hot Reload** for the backend and mounts your local source code.

```bash
make docker-dev
```

**Features of `docker-dev`:**
- **Hot Reload**: Backend automatically recompiles when you save a `.go` file (using `air`).
- **Frontend Mount**: Mounts `frontend/dist` so you can iterate on UI changes (requires `npm run build` or `npm run watch` locally, or just `make docker-dev` which builds frontend first).
- **Isolated Environment**: Mounts `./tmp/data` instead of your home directory. This prevents cluttering your real home dir and avoids Windows junction point path errors.
- **Symlink Support**: Correctly handles and identifies symbolic links.

## Accessing the App

Once running, access the web interface at:
[http://localhost:8443](http://localhost:8443)

## Troubleshooting

- **Windows path errors**: If you see errors about "non-existent files" during `docker-run`, switch to `docker-dev` which uses an isolated volume.
- **Ports**: Default port is 8443. Override with `PORT=9000 make docker-run`.
