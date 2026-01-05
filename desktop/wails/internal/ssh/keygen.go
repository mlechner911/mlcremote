package ssh

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/crypto/ssh"
)

// GenerateEd25519Key checks for an existing key pair of the given name.
// If it exists, it returns the existing paths.
// If not, it generates a new Ed25519 key pair and saves it.
func (m *Manager) GenerateEd25519Key(name string) (string, string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", "", fmt.Errorf("failed to get config dir: %w", err)
	}

	keyDir := filepath.Join(configDir, "MLCRemote", "keys")
	privKeyPath := filepath.Join(keyDir, name)
	pubKeyPath := privKeyPath + ".pub"

	// Check if keys already exist
	if _, err := os.Stat(privKeyPath); err == nil {
		if _, err := os.Stat(pubKeyPath); err == nil {
			// Both exist, read public key and return existing
			pubKeyBytes, err := os.ReadFile(pubKeyPath)
			if err != nil {
				return "", "", fmt.Errorf("failed to read existing public key: %w", err)
			}
			return privKeyPath, string(pubKeyBytes), nil
		}
	}

	// Generate new key
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate key: %w", err)
	}

	// Marshal private key to OpenSSH PEM format
	privPEM, err := ssh.MarshalPrivateKey(priv, "")
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal private key: %w", err)
	}

	// Marshaling public key
	publicParams, err := ssh.NewPublicKey(pub)
	if err != nil {
		return "", "", fmt.Errorf("failed to create public key: %w", err)
	}
	pubKeyStr := string(ssh.MarshalAuthorizedKey(publicParams))

	if err := os.MkdirAll(keyDir, 0700); err != nil {
		return "", "", fmt.Errorf("failed to create key dir: %w", err)
	}

	// Write Private Key (0600)
	if err := os.WriteFile(privKeyPath, pem.EncodeToMemory(privPEM), 0600); err != nil {
		return "", "", fmt.Errorf("failed to write private key: %w", err)
	}

	// Write Public Key (0644)
	if err := os.WriteFile(pubKeyPath, []byte(pubKeyStr), 0644); err != nil {
		// Try cleanup
		_ = os.Remove(privKeyPath)
		return "", "", fmt.Errorf("failed to write public key: %w", err)
	}

	return privKeyPath, pubKeyStr, nil
}
