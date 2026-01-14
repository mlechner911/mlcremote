package ssh

import (
	"fmt"
	"net"
	"os"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

// RunCommand connects to the remote server and executes a single command.
// It supports both identity file and password authentication.
func (m *Manager) RunCommand(host string, user string, port int, password string, identityFile string, command string) (string, error) {
	fmt.Printf("[DEBUG] RunCommand: host=%s user=%s cmd=%s\n", host, user, command)

	var authMethods []ssh.AuthMethod

	// 1. Identity File
	if identityFile != "" {
		keyData, err := os.ReadFile(identityFile)
		if err == nil {
			signer, err := ssh.ParsePrivateKey(keyData)
			if err == nil {
				authMethods = append(authMethods, ssh.PublicKeys(signer))
			} else {
				fmt.Printf("[DEBUG] RunCommand: Failed to parse key %s: %v\n", identityFile, err)
			}
		} else {
			fmt.Printf("[DEBUG] RunCommand: Failed to read key %s: %v\n", identityFile, err)
		}
	} else {
		// Try default identity
		defID := m.FindDefaultIdentity()
		if defID != "" {
			keyData, err := os.ReadFile(defID)
			if err == nil {
				signer, err := ssh.ParsePrivateKey(keyData)
				if err == nil {
					authMethods = append(authMethods, ssh.PublicKeys(signer))
				}
			}
		}
	}

	// 2. SSH Agent
	if sock := os.Getenv("SSH_AUTH_SOCK"); sock != "" {
		if conn, err := net.Dial("unix", sock); err == nil {
			agentClient := agent.NewClient(conn)
			authMethods = append(authMethods, ssh.PublicKeysCallback(agentClient.Signers))
		}
	}

	// 3. Password (fallback or primary)
	if password != "" {
		authMethods = append(authMethods, ssh.Password(password))
	}

	if len(authMethods) == 0 {
		return "", fmt.Errorf("no authentication methods available (no valid key or password)")
	}

	config := &ssh.ClientConfig{
		User:            user,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

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
