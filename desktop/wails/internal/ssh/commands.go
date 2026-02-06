package ssh

import (
	"fmt"
	"net"
	"os"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

// RunCommand executes a command on the remote server via SSH.
// It uses the native Go SSH client (golang.org/x/crypto/ssh).
func (m *Manager) RunCommand(host string, user string, port int, password string, identityFile string, passphrase string, command string) (string, error) {
	fmt.Printf("[DEBUG] RunCommand: host=%s user=%s cmd=%q\n", host, user, command)

	config := &ssh.ClientConfig{
		User:            user,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	authMethods := []ssh.AuthMethod{}
	var keyErr error

	// 1. Try Key
	if identityFile != "" {
		keyAuth, err := m.getSignerForIdentity(identityFile, passphrase)
		if err == nil {
			authMethods = append(authMethods, ssh.PublicKeys(keyAuth))
		} else {
			keyErr = err
			fmt.Printf("[DEBUG] RunCommand: failed to load key: %v\n", err)
		}
	} else {
		// Try default identity
		defID := m.FindDefaultIdentity()
		if defID != "" {
			// Try without passphrase first for defaults
			keyAuth, err := m.getSignerForIdentity(defID, passphrase)
			if err == nil {
				authMethods = append(authMethods, ssh.PublicKeys(keyAuth))
			} else {
				// Don't error hard on default key missing/locked unless it's the only option?
				// But we should probably track it.
				// For default keys, we usually expect them to work or be ignored.
			}
		}
	}

	// 2. Password (fallback or primary)
	if password != "" {
		authMethods = append(authMethods, ssh.Password(password))
	}

	// 3. SSH Agent
	if sock := os.Getenv("SSH_AUTH_SOCK"); sock != "" {
		if conn, err := net.Dial("unix", sock); err == nil {
			agentClient := agent.NewClient(conn)
			authMethods = append(authMethods, ssh.PublicKeysCallback(agentClient.Signers))
		}
	}

	if len(authMethods) == 0 {
		if keyErr != nil {
			return "", keyErr
		}
		return "", fmt.Errorf("no authentication methods available (no valid key or password)")
	}

	config.Auth = authMethods

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return "", fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	// Capture output
	output, err := session.CombinedOutput(command)
	if err != nil {
		// It might be a command error (exit code != 0), return output anyway as it might have details
		return string(output), fmt.Errorf("command failed: %w. Output: %s", err, string(output))
	}

	return string(output), nil
}

// UploadFile uploads a local file to the remote server using 'cat'.
// This avoids SCP binary dependency and works with in-memory keys.
func (m *Manager) UploadFile(host string, user string, port int, password string, identityFile string, passphrase string, localPath string, remotePath string, mode string) error {
	// Read local file
	data, err := os.ReadFile(localPath)
	if err != nil {
		return fmt.Errorf("failed to read local file: %w", err)
	}

	config := &ssh.ClientConfig{
		User:            user,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         15 * time.Second,
	}

	auths := []ssh.AuthMethod{}
	if identityFile != "" {
		if keyAuth, err := m.getSignerForIdentity(identityFile, passphrase); err == nil {
			auths = append(auths, ssh.PublicKeys(keyAuth))
		}
	} else {
		if defID := m.FindDefaultIdentity(); defID != "" {
			if keyAuth, err := m.getSignerForIdentity(defID, passphrase); err == nil {
				auths = append(auths, ssh.PublicKeys(keyAuth))
			}
		}
	}
	if password != "" {
		auths = append(auths, ssh.Password(password))
	}
	if len(auths) == 0 {
		return fmt.Errorf("no auth methods")
	}
	config.Auth = auths

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return fmt.Errorf("dial failed: %w", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	stdin, err := session.StdinPipe()
	if err != nil {
		return err
	}

	// Start remote cat
	// We handle directory creation if needed? Or caller does?
	// Caller usually does Mkdir.
	// But let's be safe: 'mkdir -p $(dirname REMOTE) && cat > REMOTE'
	// But path.Dir uses OS separator? No, "path" is url style (forward slash). "filepath" is OS.
	// If remote is Windows, this might fail unless using PowerShell or Git Bash.
	// Detected OS logic handles fallback commands, but here we execute raw.
	// For now assume standard unix-like (or Windows with Git Bash / sshd internal emulation).
	// If Windows CMD: 'type' reads from stdin? 'more'?
	// Safest is to just 'cat > remotePath' assuming standard SSH environment.
	// If native Windows OpenSSH, it spawns cmd.exe by default which doesn't have cat.
	// But we saw 'DetectRemoteOS' logic handling fallbacks.

	// We should just run the command provided by caller? No, UploadFile abstraction.

	// Construct command based on simplistic assumption or we need OS parameter.
	// For prototype, assume Linux/Mac or Windows with tools.
	// Using 'cat' works on many Windows SSH setups (Git Bash).
	// If not, we might fail.

	cmd := fmt.Sprintf("cat > \"%s\"", remotePath)

	// Start
	if err := session.Start(cmd); err != nil {
		return fmt.Errorf("failed to start upload command: %w", err)
	}

	// Write
	if _, err := stdin.Write(data); err != nil {
		return err
	}
	stdin.Close() // Send EOF

	// Wait
	if err := session.Wait(); err != nil {
		return fmt.Errorf("upload failed: %w", err)
	}

	// Chmod if needed
	if mode != "" && mode != "0644" {
		// New session for chmod
		s2, err := client.NewSession()
		if err == nil {
			defer s2.Close()
			_ = s2.Run(fmt.Sprintf("chmod %s \"%s\"", mode, remotePath))
		}
	}

	return nil
}
