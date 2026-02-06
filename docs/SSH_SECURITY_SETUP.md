# Restricted SSH Key Setup

For enhanced security, you can restrict the SSH key used by MLCRemote to only perform the specific actions required by the application. This prevents the key from being used for unrestricted shell access if it were to be compromised.

## 1. Understanding Required Commands

MLCRemote performs the following operations over SSH:
1.  **Check Backend Status:** Checks if the remote server is running or installed.
2.  **Upload Binary:** Uses SFTP/SCP to upload the `mlcremote-server` binary if missing.
3.  **Start Backend:** Executes the binary, typically binding to a local port or listening for the tunnel.
4.  **Port Forwarding:** Establishes an SSH tunnel (Local Port Forwarding).

## 2. Setting Up `authorized_keys` Restrictions

Open your `~/.ssh/authorized_keys` file on the remote server and find the line corresponding to your MLCRemote key. You can prepend options to restrict its capabilities.

### Example Configuration

```ssh
restrict,port-forwarding,command="/usr/local/bin/mlcremote-wrapper" ssh-ed25519 AAAAC3NzaC...
```

-   `restrict`: Disables all features (pty, port forwarding, agent forwarding, X11, etc.) by default.
-   `port-forwarding`: Re-enables port forwarding (REQUIRED for the tunnel).
-   `command="..."`: Forces the execution of a specific script effectively ignoring the command sent by the client. The original command is stored in the `SSH_ORIGINAL_COMMAND` environment variable.

## 3. The Wrapper Script

Create a script at `/usr/local/bin/mlcremote-wrapper` (make it executable: `chmod +x`) that inspects `SSH_ORIGINAL_COMMAND` and allows only valid MLCRemote operations.

```bash
#!/bin/bash

# Log commands for debugging (optional)
# echo "$(date) - $SSH_ORIGINAL_COMMAND" >> /tmp/mlcremote-debug.log

case "$SSH_ORIGINAL_COMMAND" in
    # 1. Check if backend is installed/running
    "pgrep -f mlcremote-server"*)
        $SSH_ORIGINAL_COMMAND
        ;;
    
    # 2. Start the backend
    *"/mlcremote-server"*)
        $SSH_ORIGINAL_COMMAND
        ;;

    # 3. SFTP Server (used for file transfer if configured)
    "/usr/lib/openssh/sftp-server"|"internal-sftp")
        $SSH_ORIGINAL_COMMAND
        ;;

    # Default: Deny
    *)
        echo "Access Denied: Command not allowed by MLCRemote policy."
        exit 1
        ;;
esac
```

*> **Note:** The exact validation logic depends on the specific commands MLCRemote sends. You may need to inspect the debug logs or `SSH_ORIGINAL_COMMAND` to refine the allowlist.*

## 4. Passphrase Protection (Encrypted Keys)

As of version **v1.5.0**, MLCRemote supports SSH keys protected by a passphrase.

### Why use a passphrase?
Adding a passphrase encrypts your private key file on disk. This adds a critical layer of security:
-   **Theft Protection:** If your laptop is stolen or your `~/.ssh` folder is compromised, the attacker cannot use your key without the passphrase.
-   **Compliance:** Many enterprise security policies require all private keys to be encrypted at rest.

### How it works in MLCRemote
When you connect using a protected key:
1.  MLCRemote detects that the key is encrypted.
2.  You are prompted to enter the passphrase.
3.  The application uses its **Native SSH Client** to decrypt the key **in memory**.
4.  The unencrypted key is **never written to disk** (unlike some other tools that create temporary key files).
5.  Supported Key Types: `ed25519` (recommended), `rsa`, `ecdsa`.
