package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const securityFileName = "security.json"

type SecurityConfig struct {
	PasswordHash string `json:"passwordHash"`
	UpdatedAt    int64  `json:"updatedAt"`
}

var securityMu sync.Mutex

func (a *App) getSecurityPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(configDir, "MLCRemote")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return "", err
	}
	return filepath.Join(appDir, securityFileName), nil
}

// HasMasterPassword checks if a master password is set
func (a *App) HasMasterPassword() bool {
	securityMu.Lock()
	defer securityMu.Unlock()

	path, err := a.getSecurityPath()
	if err != nil {
		return false
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}

	var config SecurityConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return false
	}

	return config.PasswordHash != ""
}

// VerifyMasterPassword checks the provided password against the stored hash
func (a *App) VerifyMasterPassword(password string) bool {
	securityMu.Lock()
	defer securityMu.Unlock()

	path, err := a.getSecurityPath()
	if err != nil {
		return false
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}

	var config SecurityConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return false
	}

	err = bcrypt.CompareHashAndPassword([]byte(config.PasswordHash), []byte(password))
	return err == nil
}

// SetMasterPassword sets a new master password. Empty string removes it.
func (a *App) SetMasterPassword(password string) error {
	securityMu.Lock()
	defer securityMu.Unlock()

	path, err := a.getSecurityPath()
	if err != nil {
		return err
	}

	if password == "" {
		// Remove password
		os.Remove(path)
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	config := SecurityConfig{
		PasswordHash: string(hash),
		UpdatedAt:    time.Now().Unix(),
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0600) // Restricted permissions
}
