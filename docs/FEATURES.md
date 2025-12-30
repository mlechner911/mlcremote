**MLCRemote — Features (Non-developer Highlights)**

- **Tiny server binary:** The server is implemented in Go and produces a single small executable. It has a tiny disk and memory footprint compared with full IDE/server stacks — easy to download and run on modest machines.

- **Low memory usage:** The core server is optimized to be lightweight (low resident set size). It focuses on serving files, a few API endpoints, and safe remote terminal sessions without heavy background services.

- **Browser-first UI:** A compact React-based frontend provides a clean file explorer, editor, and preview panes that run entirely in the browser. You can run the UI locally or bundle it into a desktop app.

- **Rich previews:** Built-in previews for common file types make browsing fast and pleasant:
  - Text files: fast syntax-highlighted preview and lightweight in-browser editing.
  - Images: inline image preview with download option.
  - PDF: in-browser preview using a local PDF worker (no external CDN).
  - Directories: quick listing view with entry counts and download links.

- **Lightweight terminal:** The app includes an integrated terminal tab (powered by xterm) for running a shell on the host server. The terminal component is loaded on demand so it doesn't slow down the initial UI load.

- **Small client bundles & lazy loading:** Heavy libraries (editor languages, terminal, PDF viewer) are split into lazy-loaded chunks. This keeps the initial download small and the interface responsive.

- **Single-file downloads and safety:** Files can be downloaded directly from the UI. Delete operations are gated by confirmation and server settings.

- **Desktop packaging ready:** The frontend can be bundled for desktop (Wails) so the same web UI runs as a native-looking app if you prefer an installable client.

Quick start (developer or end-user):

1. Run the backend server (single executable):

```bash
# build or download the server executable and run it
./mlcremote-server
# default listens on localhost:8443
```

2. Run the frontend for local development or serve the built UI:

```bash
cd frontend
npm install
npm run dev      # start dev server (for development)
npm run build    # produce production assets for static hosting or desktop bundling
```

3. Open the UI in your browser (the dev server reports the URL) or point the desktop app to the server endpoint.

Notes for non-developers:

- The server is intentionally minimal — there are no heavy background daemons. It serves files, previews, and a terminal interface.
- For sensitive deployments, run the server behind a reverse proxy and secure it with TLS. The default local setup is intended for convenience and local development.
- The UI avoids external CDNs by bundling necessary workers locally (e.g., PDF worker), improving privacy and offline reliability.

If you'd like this expanded into a one-page product summary or a short README for end-users, tell me the target audience (administrators, end-users, or sysadmins) and I will tailor it.
