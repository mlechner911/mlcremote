package ssh

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"golang.org/x/crypto/ssh"
)

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
