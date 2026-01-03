package app

import (
	"github.com/mlechner911/mlcremote/desktop/wails/internal/config"
)

// ListProfiles returns all saved profiles
func (a *App) ListProfiles() ([]config.ConnectionProfile, error) {
	return a.Config.ListProfiles()
}

// SaveProfile saves or updates a profile
func (a *App) SaveProfile(p config.ConnectionProfile) (string, error) {
	return a.Config.SaveProfile(p)
}

// DeleteProfile removes a profile by ID
func (a *App) DeleteProfile(id string) (bool, error) {
	return a.Config.DeleteProfile(id)
}

// GetProfile retrieves a single profile
func (a *App) GetProfile(id string) (*config.ConnectionProfile, error) {
	return a.Config.GetProfile(id)
}
