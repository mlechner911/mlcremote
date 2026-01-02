package app

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
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Color        string   `json:"color"`
	User         string   `json:"user"`
	Host         string   `json:"host"`
	Port         int      `json:"port"`
	LocalPort    int      `json:"localPort"`
	IdentityFile string   `json:"identityFile"`
	IsWindows    bool     `json:"isWindows"`
	LastUsed     int64    `json:"lastUsed"`
	ExtraArgs    []string `json:"extraArgs"`
}

const profilesFileName = "profiles.json"

var profilesMu sync.Mutex

func (a *App) getProfilesPath() (string, error) {
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
func (a *App) ListProfiles() ([]ConnectionProfile, error) {
	profilesMu.Lock()
	defer profilesMu.Unlock()

	path, err := a.getProfilesPath()
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
		// return empty if corrupt? or error? let's return error to be safe
		return nil, fmt.Errorf("failed to parse profiles: %w", err)
	}
	return profiles, nil
}

// SaveProfile saves or updates a profile
func (a *App) SaveProfile(p ConnectionProfile) (string, error) {
	profilesMu.Lock()
	defer profilesMu.Unlock()

	path, err := a.getProfilesPath()
	if err != nil {
		return "", err
	}

	// Load existing
	var profiles []ConnectionProfile
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &profiles)
	}

	if p.ID == "" {
		p.ID = uuid.NewString()
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
func (a *App) DeleteProfile(id string) (bool, error) {
	profilesMu.Lock()
	defer profilesMu.Unlock()

	path, err := a.getProfilesPath()
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
func (a *App) GetProfile(id string) (*ConnectionProfile, error) {
	list, err := a.ListProfiles()
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
