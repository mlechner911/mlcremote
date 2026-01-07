package ssh

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// ProbePublicKey attempts to connect via SSH using the specified identity file.
// Returns "ok", "auth-failed", "no-key", or a detailed error description.
func (m *Manager) ProbePublicKey(host string, user string, port int, identityFile string) (string, error) {
	fmt.Printf("[DEBUG] ProbePublicKey: host=%s user=%s identity=%s\n", host, user, identityFile)
	if identityFile == "" {
		identityFile = m.FindDefaultIdentity()
		fmt.Printf("[DEBUG] ProbePublicKey: Found default identity: %s\n", identityFile)
	}

	if identityFile == "" {
		fmt.Println("[DEBUG] ProbePublicKey: No identity found")
		return "no-key", nil
	}

	keyData, err := os.ReadFile(identityFile)
	if err != nil {
		if os.IsNotExist(err) {
			return "key-not-found", nil
		}
		return "key-error", fmt.Errorf("failed to read key: %w", err)
	}

	signer, err := ssh.ParsePrivateKey(keyData)
	if err != nil {
		return "key-invalid", fmt.Errorf("failed to parse private key: %w", err)
	}

	config := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeys(signer),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		// Differentiate between network error and auth error
		// This is tricky with Go's SSH lib, as it returns a generic error string for auth failures
		errStr := err.Error()
		fmt.Printf("[DEBUG] ProbePublicKey: Dial failed (err=%s). Auth error? %v\n", errStr, containsAuthError(errStr))
		if containsAuthError(errStr) {
			return "auth-failed", nil
		}
		return "unreachable", err
	}
	defer client.Close()
	fmt.Println("[DEBUG] ProbePublicKey: Success")

	return "ok", nil
}

func containsAuthError(err string) bool {
	// Common SSH auth error messages
	return strings.Contains(err, "unable to authenticate")
}

// FindDefaultIdentity looks for common SSH keys (RSA, Ed25519) in the user's .ssh directory.
// It returns the path to the first valid key found, or an empty string if none exist.
func (m *Manager) FindDefaultIdentity() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}

	// Check rsa
	rsa := filepath.Join(home, ".ssh", "id_rsa")
	if _, err := os.Stat(rsa); err == nil {
		return rsa
	}

	// Check ed25519
	ed := filepath.Join(home, ".ssh", "id_ed25519")
	if _, err := os.Stat(ed); err == nil {
		return ed
	}

	return ""
}

// VerifyPassword checks if the password is valid for the given host
func (m *Manager) VerifyPassword(host string, user string, port int, password string) (string, error) {
	config := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return "auth-failed", err
	}
	defer client.Close()

	return "ok", nil
}

// DeployPublicKey connects via password and adds the local public key to authorized_keys
func (m *Manager) DeployPublicKey(host string, user string, port int, password string, identityFile string) error {
	fmt.Printf("[DEBUG] DeployPublicKey: host=%s user=%s identity=%s\n", host, user, identityFile)
	if identityFile == "" {
		identityFile = m.FindDefaultIdentity()
		fmt.Printf("[DEBUG] DeployPublicKey: Found default identity: %s\n", identityFile)
	}
	if identityFile == "" {
		// Fallback to id_rsa if nothing found, though this shouldn't happen in this flow usually
		home, _ := os.UserHomeDir()
		identityFile = filepath.Join(home, ".ssh", "id_rsa")
		fmt.Printf("[DEBUG] DeployPublicKey: No default found, falling back to: %s\n", identityFile)
	}

	pubKeyPath := identityFile + ".pub"
	pubKeyData, err := ioutil.ReadFile(pubKeyPath)
	if err != nil {
		fmt.Printf("[DEBUG] DeployPublicKey: Failed to read pubkey: %v\n", err)
		return fmt.Errorf("failed to read public key %s: %w", pubKeyPath, err)
	}

	// Trim whitespace to avoid issues
	pubKeyStr := strings.TrimSpace(string(pubKeyData))
	if pubKeyStr == "" {
		return fmt.Errorf("public key file is empty")
	}

	config := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		fmt.Printf("[DEBUG] DeployPublicKey: SSH Dial failed: %v\n", err)
		return fmt.Errorf("failed to connect via password: %w", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	// Ensure ~/.ssh exists, fix permissions, and safely append the key ensuring a newline separator
	// We use single quotes to wrap the key, which protects against most shell expansions ($...)
	// We must escape existing single quotes in the key (rare but possible in comments)
	safeKey := strings.ReplaceAll(pubKeyStr, "'", "'\\''")

	// Simplified command: check dir -> append key -> fix perms
	// Linux/Mac implementation
	linuxCmd := fmt.Sprintf("mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '%s' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys", safeKey)

	fmt.Printf("[DEBUG] DeployPublicKey: Running command on remote...\n")
	output, err := session.CombinedOutput(linuxCmd)
	if err != nil {
		fmt.Printf("[DEBUG] DeployPublicKey: Linux command failed: %v. Output: %s\n", err, strings.TrimSpace(string(output)))
		fmt.Println("[DEBUG] DeployPublicKey: Attempting Windows fallback...")

		// Re-open session? Yes, CombinedOutput closes the session.
		// We need a NEW session for the fallback.
		session2, err2 := client.NewSession()
		if err2 != nil {
			return fmt.Errorf("failed to create fallback session: %w", err2)
		}
		defer session2.Close()

		// Windows/PowerShell implementation
		// We use the raw key and escape single quotes for PowerShell (which is '')
		psKey := strings.ReplaceAll(pubKeyStr, "'", "''")

		// Note: We don't try to fix permissions deeply here as it requires complex ACL script.
		// We rely on the user having followed the setup guide for ACLs or the default being "okay" enough for now.
		// Using backticks for escaping double quotes inside the command string if needed, or just strict sequence.
		winCmd := fmt.Sprintf("powershell -Command \"New-Item -Force -ItemType Directory -Path \\\"$env:USERPROFILE\\.ssh\\\"; Add-Content -Force -Path \\\"$env:USERPROFILE\\.ssh\\authorized_keys\\\" -Value '%s'\"", psKey)

		output2, err2 := session2.CombinedOutput(winCmd)
		if err2 != nil {
			return fmt.Errorf("failed to install public key (tried Linux and Windows): %v (LinOut: %s) (WinOut: %s)", err2, strings.TrimSpace(string(output)), strings.TrimSpace(string(output2)))
		}
		fmt.Printf("[DEBUG] DeployPublicKey: Windows fallback success. Output: %s\n", string(output2))
		return nil
	}

	fmt.Printf("[DEBUG] DeployPublicKey: Success. Output: %s\n", string(output))
	return nil
}
