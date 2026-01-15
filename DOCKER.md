# Docker Support for MLCRemote

MLCRemote can be fully run and developed within Docker. This ensures a consistent environment and isolates dependencies.

## Prerequisites

- Docker
- Make (optional, but recommended for easy commands)

## Running the Application

To build and run the production-ready Docker image:

```bash
docker build -t mlcremote .
docker run -p 8443:8443 -v /path/to/data:/data mlcremote
```

## Development Mode

For development, use the `docker:dev` task. This enables **Hot Reload** for the backend and mounts your local source code.

```bash
task docker:dev
```

**Features of `docker:dev`:**
- **Hot Reload**: Backend automatically recompiles when you save a `.go` file.
- **Frontend Mount**: Mounts `frontend/dist` so you can iterate on UI changes.
- **Isolated Environment**: Uses `./backend/testdata` volume.
- **Symlink Support**: Correctly handles and identifies symbolic links.

## Accessing the App

Once running, access the web interface at:
[http://localhost:8443](http://localhost:8443)

## Troubleshooting

- **Permissions**: Ensure Docker has permission to mount the directories.
- **Ports**: Default port is 8443.
