package ssh

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/crypto/ssh"
)

// ProbePublicKey attempts to connect via SSH using the specified identity file.
// Returns "ok", "auth-failed", or a detailed error description.
func (m *Manager) ProbePublicKey(host string, user string, port int, identityFile string) (string, error) {
	if identityFile == "" {
		home, _ := os.UserHomeDir()
		identityFile = filepath.Join(home, ".ssh", "id_rsa")
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
		if containsAuthError(errStr) {
			return "auth-failed", nil
		}
		return "unreachable", err
	}
	defer client.Close()

	return "ok", nil
}

func containsAuthError(err string) bool {
	// Common SSH auth error messages
	return err == "ssh: handshake failed: ssh: unable to authenticate, attempted methods [publickey], no supported methods remain" ||
		err == "ssh: handshake failed: ssh: unable to authenticate, attempted methods [none publickey], no supported methods remain"
}

// DeployPublicKey connects via password and adds the local public key to authorized_keys
func (m *Manager) DeployPublicKey(host string, user string, port int, password string, identityFile string) error {
	if identityFile == "" {
		// Default to ~/.ssh/id_rsa
		home, _ := os.UserHomeDir()
		identityFile = filepath.Join(home, ".ssh", "id_rsa")
	}

	pubKeyPath := identityFile + ".pub"
	pubKeyData, err := ioutil.ReadFile(pubKeyPath)
	if err != nil {
		return fmt.Errorf("failed to read public key %s: %w", pubKeyPath, err)
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
		return fmt.Errorf("failed to connect via password: %w", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	// Ensure ~/.ssh exists and add the key
	cmd := fmt.Sprintf("mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '%s' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys", string(pubKeyData))
	if err := session.Run(cmd); err != nil {
		return fmt.Errorf("failed to install public key: %w", err)
	}

	return nil
}
