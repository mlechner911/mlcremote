package ssh

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/crypto/ssh"
)

// StartNativeTunnel establishes a secure tunnel using Go's crypto/ssh library.
// It supports in-memory keys (with optional passphrase) without writing to disk.
func (m *Manager) StartNativeTunnel(ctx context.Context, profile TunnelProfile) (string, error) {
	// 1. Prepare Auth Methods
	auths := []ssh.AuthMethod{}
	if profile.IdentityFile != "" {
		keyData, err := os.ReadFile(profile.IdentityFile)
		if err != nil {
			return "", fmt.Errorf("failed to read identity file: %w", err)
		}

		var signer ssh.Signer
		if profile.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(keyData, []byte(profile.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(keyData)
		}

		if err != nil {
			if _, ok := err.(*ssh.PassphraseMissingError); ok {
				return "passphrase-required", nil
			}
			return "", fmt.Errorf("failed to parse private key: %w", err)
		}
		auths = append(auths, ssh.PublicKeys(signer))
	} else {
		// Try default keys if no specific identity file is provided
		// Common paths: ~/.ssh/id_ed25519, ~/.ssh/id_rsa
		home, err := os.UserHomeDir()
		if err == nil {
			sshDir := filepath.Join(home, ".ssh")
			candidates := []string{"id_ed25519", "id_rsa", "id_ecdsa"}
			for _, name := range candidates {
				path := filepath.Join(sshDir, name)
				if data, err := os.ReadFile(path); err == nil {
					// We only support unencrypted default keys automatically for now.
					// If they are encrypted, we can't guess the passphrase.
					if signer, err := ssh.ParsePrivateKey(data); err == nil {
						auths = append(auths, ssh.PublicKeys(signer))
					}
				}
			}
		}
	}

	if profile.Password != "" {
		auths = append(auths, ssh.Password(profile.Password))
	}

	config := &ssh.ClientConfig{
		User:            profile.User,
		Auth:            auths,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	// 2. Connect to SSH Server
	sshAddr := profile.Host
	if _, _, err := net.SplitHostPort(sshAddr); err != nil {
		sshAddr = fmt.Sprintf("%s:22", sshAddr)
	}

	client, err := ssh.Dial("tcp", sshAddr, config)
	if err != nil {
		return "", fmt.Errorf("failed to dial ssh: %w", err)
	}

	// 3. Start Local Listener
	localAddr := fmt.Sprintf("127.0.0.1:%d", profile.LocalPort)
	listener, err := net.Listen("tcp", localAddr)
	if err != nil {
		client.Close()
		return "", fmt.Errorf("failed to listen on %s: %w", localAddr, err)
	}

	m.mu.Lock()
	m.activePort = profile.LocalPort
	m.tunnelState = "connected"
	m.mu.Unlock()

	// 4. Handle Connections
	go func() {
		defer client.Close()
		defer listener.Close()

		for {
			// Check context/stopping
			select {
			case <-ctx.Done():
				return
			default:
			}

			localConn, err := listener.Accept()
			if err != nil {
				// Log error?
				break
			}

			go m.handleForward(client, localConn, profile.RemoteHost, profile.RemotePort)
		}

		m.mu.Lock()
		m.tunnelState = "disconnected"
		m.activePort = 0
		m.mu.Unlock()
	}()

	return "started", nil
}

func (m *Manager) handleForward(client *ssh.Client, localConn net.Conn, remoteHost string, remotePort int) {
	defer localConn.Close()

	remoteAddr := fmt.Sprintf("%s:%d", remoteHost, remotePort)
	remoteConn, err := client.Dial("tcp", remoteAddr)
	if err != nil {
		// fmt.Printf("Remote dial failed: %v\n", err)
		return
	}
	defer remoteConn.Close()

	// Pipe
	go func() {
		_, _ = io.Copy(remoteConn, localConn)
		// CloseWrite?
	}()
	_, _ = io.Copy(localConn, remoteConn)
}
