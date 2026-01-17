package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ConnectionProfile represents a saved remote connection
type ConnectionProfile struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Color         string    `json:"color"`
	User          string    `json:"user"`
	Host          string    `json:"host"`
	Port          int       `json:"port"`
	LocalPort     int       `json:"localPort"`
	IdentityFile  string    `json:"identityFile"`
	IsWindows     bool      `json:"isWindows"`
	LastUsed      int64     `json:"lastUsed"`
	ExtraArgs     []string  `json:"extraArgs"`
	RemoteOS      string    `json:"remoteOS"`      // e.g. Linux, Darwin, Windows
	RemoteArch    string    `json:"remoteArch"`    // e.g. amd64, arm64
	RemoteVersion string    `json:"remoteVersion"` // e.g. 1.0.0
	Mode          string    `json:"mode"`          // "default" or "parallel"
	RootPath      string    `json:"rootPath"`      // Optional root directory override
	Tasks         []TaskDef `json:"tasks"`
}

type TaskDef struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Command      string `json:"command"`
	Color        string `json:"color"`
	Icon         string `json:"icon"`
	ShowOnLaunch bool   `json:"showOnLaunch"`
}

const profilesFileName = "profiles.json"

type Manager struct {
	mu sync.Mutex
}

func NewManager() *Manager {
	return &Manager{}
}

func (m *Manager) getProfilesPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(configDir, "MLCRemote")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return "", err
	}
	return filepath.Join(appDir, profilesFileName), nil
}

// ListProfiles returns all saved profiles
func (m *Manager) ListProfiles() ([]ConnectionProfile, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	path, err := m.getProfilesPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return []ConnectionProfile{}, nil
	}
	if err != nil {
		return nil, err
	}

	var profiles []ConnectionProfile
	if err := json.Unmarshal(data, &profiles); err != nil {
		return nil, fmt.Errorf("failed to parse profiles: %w", err)
	}
	return profiles, nil
}

// SaveProfile saves or updates a profile
func (m *Manager) SaveProfile(p ConnectionProfile) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	path, err := m.getProfilesPath()
	if err != nil {
		return "", err
	}

	// Load existing
	var profiles []ConnectionProfile
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &profiles)
	}

	if p.ID == "" {
		// Check for existing profile with same User, Host, Port
		for _, existing := range profiles {
			if existing.User == p.User && existing.Host == p.Host && existing.Port == p.Port {
				p.ID = existing.ID
				break
			}
		}
		if p.ID == "" {
			p.ID = uuid.NewString()
		}
	}
	p.LastUsed = time.Now().Unix()

	// data normalization
	if p.Port == 0 {
		p.Port = 22
	}
	if p.LocalPort == 0 {
		p.LocalPort = 8443
	}

	// Update or Append
	found := false
	for i, existing := range profiles {
		if existing.ID == p.ID {
			// Merge: keep some fields from existing if they are more complete
			if p.Name == "" {
				p.Name = existing.Name
			}
			if p.Color == "" {
				p.Color = existing.Color
			}
			profiles[i] = p
			found = true
			break
		}
	}
	if !found {
		profiles = append(profiles, p)
	}

	data, err := json.MarshalIndent(profiles, "", "  ")
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return "", err
	}
	return p.ID, nil
}

// DeleteProfile removes a profile by ID
func (m *Manager) DeleteProfile(id string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	path, err := m.getProfilesPath()
	if err != nil {
		return false, err
	}

	if data, err := os.ReadFile(path); err == nil {
		var profiles []ConnectionProfile
		if err := json.Unmarshal(data, &profiles); err == nil {
			newProfiles := []ConnectionProfile{}
			found := false
			for _, p := range profiles {
				if p.ID == id {
					found = true
					continue
				}
				newProfiles = append(newProfiles, p)
			}

			if found {
				data, _ := json.MarshalIndent(newProfiles, "", "  ")
				_ = os.WriteFile(path, data, 0644)
				return true, nil
			}
		}
	}
	return false, nil
}

// GetProfile retrieves a single profile
func (m *Manager) GetProfile(id string) (*ConnectionProfile, error) {
	list, err := m.ListProfiles()
	if err != nil {
		return nil, err
	}
	for _, p := range list {
		if p.ID == id {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("profile not found")
}

// DeduplicateProfiles removes entries with identical User, Host, Port
func (m *Manager) DeduplicateProfiles() (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	path, err := m.getProfilesPath()
	if err != nil {
		return 0, err
	}

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}

	var profiles []ConnectionProfile
	if err := json.Unmarshal(data, &profiles); err != nil {
		return 0, err
	}

	unique := []ConnectionProfile{}
	seen := make(map[string]bool)
	removed := 0

	// Keep the most recently used one for each User@Host:Port
	// Sort by LastUsed descending first
	for i := 0; i < len(profiles); i++ {
		for j := i + 1; j < len(profiles); j++ {
			if profiles[i].LastUsed < profiles[j].LastUsed {
				profiles[i], profiles[j] = profiles[j], profiles[i]
			}
		}
	}

	for _, p := range profiles {
		key := fmt.Sprintf("%s@%s:%d", p.User, p.Host, p.Port)
		if seen[key] {
			removed++
			continue
		}
		seen[key] = true
		unique = append(unique, p)
	}

	if removed > 0 {
		data, _ := json.MarshalIndent(unique, "", "  ")
		_ = os.WriteFile(path, data, 0644)
	}

	return removed, nil
}
