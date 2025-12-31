# MLCRemote API Documentation

## Authentication

MLCRemote uses a simple token-based authentication mechanism to secure access to the API and WebSocket endpoints.

### 1. Obtaining the Token
*   **Startup Output:** When the server starts, it generates a secure random token and prints it to the console.
*   **Password Login:** If a `password` is configured in `~/.mlcremote/config.ini`, you can exchange it for a token via the API.

**Example Output:**
```text
Security: Authentication ENABLED
Access URL: http://127.0.0.1:8443/?token=7f8a9b1c2d3e4f...
Token: 7f8a9b1c2d3e4f...
```

### 2. Passing the Token
You can provide the token in two ways:

*   **Header (Preferred):** `X-Auth-Token: <your-token>`
*   **Query Parameter:** `?token=<your-token>` (Useful for WebSocket connections or browser testing)

---

## API Endpoints

All endpoints are relative to the server root URL (e.g., `http://127.0.0.1:8443`).

### Swagger Documentation

Interactive API documentation is available at:
`http://127.0.0.1:8443/docs/index.html`

### System & Health

#### `POST /api/login`
Exchanges a configured password for an access token.

*   **Body (JSON):**
    ```json
    {
      "password": "my-secret-password"
    }
    ```

**Response:**
```json
{
  "token": "7f8a9b1c2d3e4f..."
}
```

#### `GET /api/auth/check`
Verifies if the provided authentication token is valid.

*   **Headers:** `X-Auth-Token: <token>` (or `?token=<token>`)

**Response:**
*   `200 OK`: Token is valid.
*   `401 Unauthorized`: Token is missing or invalid.

#### `GET /health`
Returns the status of the server and basic system metrics. **This endpoint is public and never requires authentication.**

**Response:**
```json
{
  "status": "ok",
  "version": "0.2.1",
  "pid": 12345,
  "cpu_percent": 1.2,
  "sys_mem_free_bytes": 8589934592,
  "password_auth": true,
  "auth_required": true
}
```

#### `GET /api/version`
Returns version compatibility information.

**Response:**
```json
{
  "backend": "0.2.1",
  "frontendCompatible": "^0.2"
}
```

#### `GET /api/settings`
Returns runtime configuration for the frontend.

**Response:**
```json
{
  "allowDelete": false,
  "defaultShell": "bash"
}
```

### File Management

#### `GET /api/tree`
Lists files and directories under a specific path.

*   **Query Params:**
    *   `path`: Relative path from the server root (default: `.`).
    *   `showHidden`: `true` to include hidden files (default: `false`).

**Response:**
```json
[
  {
    "name": "main.go",
    "path": "/main.go",
    "isDir": false,
    "size": 1024,
    "modTime": "2025-12-31T10:00:00Z"
  }
]
```

#### `GET /api/file`
Downloads the content of a file.

*   **Query Params:**
    *   `path`: Relative path to the file.

**Response:** Raw file content (MIME type auto-detected).

#### `GET /api/file/section`
Reads a specific chunk of a file (useful for large files).

*   **Query Params:**
    *   `path`: Relative path to the file.
    *   `offset`: Byte offset to start reading from (default: `0`).
    *   `length`: Number of bytes to read (max: 16MB).

#### `GET /api/stat`
Returns metadata for a file or directory.

*   **Query Params:**
    *   `path`: Relative path.

**Response:**
```json
{
  "isDir": false,
  "size": 2048,
  "mode": "-rw-r--r--",
  "modTime": "...",
  "mime": "text/plain; charset=utf-8"
}
```

#### `POST /api/file`
Creates or overwrites a text file.

*   **Body (JSON):**
    ```json
    {
      "path": "path/to/file.txt",
      "content": "Hello World"
    }
    ```

#### `POST /api/upload`
Uploads one or more files via `multipart/form-data`.

*   **Query Params:**
    *   `path`: Destination directory.
*   **Form Field:** `file` (can be multiple).

#### `DELETE /api/file`
Moves a file or directory to a `.trash` folder within the root.

*   **Query Params:**
    *   `path`: Relative path to delete.

#### `GET /api/trash/recent`
Returns a list of files deleted during the current server session (last 100 entries).

**Response:**
```json
[
  {
    "originalPath": "main.go",
    "trashPath": "/home/user/.trash/20251231-120000/main.go",
    "deletedAt": "2025-12-31T12:00:00Z"
  }
]
```

#### `POST /api/trash/restore`
Restores a file from the trash history to its original location. Fails if the destination exists.

*   **Body (JSON):**
    ```json
    {
      "trashPath": "/home/user/.trash/..."
    }
    ```

#### `DELETE /api/trash`
Permanently deletes all files in the trash directory and clears the session history. **Requires `allow_delete = true`.**

### Terminal

#### `POST /api/terminal/new`
Creates a new terminal session.

*   **Query Params:**
    *   `shell`: (Optional) Shell to start (e.g., `bash`, `zsh`).
    *   `cwd`: (Optional) Working directory.

**Response:**
```json
{
  "id": "s1234567890abcdef"
}
```

#### `WS /ws/terminal`
Connects to an existing terminal session via WebSocket.

*   **Query Params:**
    *   `id`: The session ID returned by `/api/terminal/new`.
    *   `token`: Your auth token.

**Protocol:**
*   **Client -> Server:**
    *   Prefix `0`: Input data (e.g., `0ls -la\n`).
    *   Prefix `1`: Resize (JSON: `1{"cols":80,"rows":24}`).
*   **Server -> Client:**
    *   Binary data: Raw PTY output.

```