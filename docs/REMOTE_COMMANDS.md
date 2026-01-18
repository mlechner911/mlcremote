# Remote Commands Reference

This document lists the commands that can be sent from the remote server (via `dev-server cmd`) to the frontend.

## Usage

```bash
~/.mlcremote/bin/dev-server cmd <command_name> [key=value] [...]
```

Or using JSON:

```bash
~/.mlcremote/bin/dev-server cmd <command_name> '{"key": "value"}'
```

## Available Commands

### `show_message`
Displays a notification or message box to the user.

*   **Arguments**:
    *   `message` (string): The text to display.
    *   `level` (string, optional): One of `info`, `warning`, `error`, `success`. Defaults to `info`.

**Examples**:

**Success:**
```bash
~/.mlcremote/bin/dev-server cmd show_message "Deployment Completed Successfully" level=success
```

**Error:**
```bash
~/.mlcremote/bin/dev-server cmd show_message "Build Failed: check logs" level=error
```

**Warning:**
```bash
~/.mlcremote/bin/dev-server cmd show_message "Disk space low" level=warning
```

**Info:**
```bash
~/.mlcremote/bin/dev-server cmd show_message "Process started" level=info
```

### `set_cwd`
Updates the frontend's current working directory (File Explorer and Terminal Tab).

*   **Arguments**:
    *   `path` (string): The new directory path.

**Example**:
```bash
~/.mlcremote/bin/dev-server cmd set_cwd /var/log
```

### `open_file`
Opens a file in the editor or viewer.

*   **Arguments**:
    *   `path` (string): The full path to the file.
    *   `mode` (string, optional): `edit` (default), `preview`, or `view`.

**Example**:
```bash
~/.mlcremote/bin/dev-server cmd open_file /home/user/config.yaml
```

## Script Examples

### Database Backup Notification

This script performs a database backup and notifies the user of the result using the `success` or `error` message box.

```bash
#!/bin/bash

# Configuration
DB_USER="root"
DB_PASS="password"
DB_NAME="production_db"
BACKUP_FILE="/tmp/backup_$(date +%Y%m%d).sql"
DEV_SERVER="$HOME/.mlcremote/bin/dev-server"

# Run Backup
if mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE"; then
    # Success Notification
    "$DEV_SERVER" cmd show_message "Database Backup Successful: $BACKUP_FILE" level=success
else
    # Error Notification
    "$DEV_SERVER" cmd show_message "Database Backup FAILED!" level=error
fi
```

### Automatic CWD Sync (Shell Hook)

You can automatically sync the File Explorer with your terminal's current directory by overriding the `cd` command in your shell configuration (e.g., `.bashrc` or `.zshrc`).

```bash
# Add this to your ~/.bashrc or ~/.zshrc

function cd() {
    builtin cd "$@" || return
    # Send set_cwd command to MLCRemote (backgrounded to avoid lag)
    "$HOME/.mlcremote/bin/dev-server" cmd set_cwd "$(pwd)" >/dev/null 2>&1 &
}
```

