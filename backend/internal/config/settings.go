package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// UserSettings represents the user-configurable settings persisted to disk.
type UserSettings struct {
	Theme           string `json:"theme"`
	AutoOpen        bool   `json:"autoOpen"`
	ShowHidden      bool   `json:"showHidden"`
	ShowLogs        bool   `json:"showLogs"`
	HideMemoryUsage bool   `json:"hideMemoryUsage"`
	MaxEditorSize   int64  `json:"maxEditorSize"`
	Language        string `json:"language"`
	Mode            string `json:"mode"`
}

// DefaultSettings returns the default user settings.
func DefaultSettings() *UserSettings {
	return &UserSettings{
		Theme:           "dark",
		AutoOpen:        true,
		ShowHidden:      false,
		ShowLogs:        false,
		HideMemoryUsage: false,
		MaxEditorSize:   1024 * 1024, // 1MB
		Language:        "en",
		Mode:            "standard",
	}
}

var settingsMu sync.Mutex

// LoadSettings loads settings from the given path.
// If the file does not exist, it returns default settings.
func LoadSettings(path string) (*UserSettings, error) {
	settingsMu.Lock()
	defer settingsMu.Unlock()

	defaults := DefaultSettings()

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return defaults, nil
	}
	if err != nil {
		return defaults, err
	}

	var s UserSettings
	if err := json.Unmarshal(data, &s); err != nil {
		return defaults, err
	}

	// Merge with defaults (in case of missing fields)
	if s.Theme == "" {
		s.Theme = defaults.Theme
	}
	if s.MaxEditorSize == 0 {
		s.MaxEditorSize = defaults.MaxEditorSize
	}
	if s.Language == "" {
		s.Language = defaults.Language
	}
	if s.Mode == "" {
		s.Mode = defaults.Mode
	}

	return &s, nil
}

// SaveSettings saves settings to the given path.
func SaveSettings(path string, s *UserSettings) error {
	settingsMu.Lock()
	defer settingsMu.Unlock()

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}
