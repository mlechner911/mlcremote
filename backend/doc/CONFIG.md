# Configuration

MLCRemote can be configured via a configuration file, environment variables (for some defaults), or command-line flags.

## Configuration File

The server looks for a configuration file in the following locations (in order of priority):
1. `~/.mlcremote/config.ini` (User home directory)
2. `/etc/mlcremote/config.ini` (System-wide)

The file format is a simple `key = value` structure (INI-style).

### Example `config.ini`

```ini
# The port to listen on
port = 9090

# The root directory for the file explorer
# Tilde (~) expansion is supported
root = ~/Projects

# Optional: Password for obtaining an access token via /api/login
# If not set, login via API is disabled (you must use the token printed at startup)
password = mysecretpassword

# Optional: Path to static frontend files (for dev/hosting)
static_dir = /var/www/mlcremote

# Optional: Disable authentication (NOT RECOMMENDED)
# no_auth = true

# Optional: Enable file deletion (moves to .trash)
# allow_delete = true

# Optional: Custom trash directory (default: ~/.trash)
# trash_dir = /mnt/data/.trash
```

## Configuration Options

| Key | CLI Flag | Default | Description |
| :--- | :--- | :--- | :--- |
| `port` | `-port` | `8443` | TCP port to listen on. |
| `root` | `-root` | `$HOME` | The root directory exposed by the file explorer. |
| `password` | N/A | `""` | Password for the `/api/login` endpoint. |
| `allow_delete` | N/A | `false` | Enables the `DELETE /api/file` endpoint. |
| `trash_dir` | N/A | `~/.trash` | Directory where deleted files are moved. |
| `static_dir` | `-static-dir` | `""` | Directory containing static frontend assets. |
| `no_auth` | `-no-auth` | `false` | Disables all authentication checks. |
| `openapi` | `-openapi` | `""` | Path to `openapi.yaml` for Swagger UI. |

## Precedence

1.  **Command Line Flags**: Values passed via CLI args override everything else.
2.  **Configuration File**: Values in `config.ini` are used if no flag is provided.
3.  **Defaults**: Hardcoded defaults are used if neither config nor flag is present.

---

**Note**: The `/health` endpoint is always public and ignores authentication settings for monitoring purposes.
