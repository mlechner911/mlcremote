package app

import (
	"github.com/mlechner911/mlcremote/desktop/wails/internal/config"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/monitoring"
)

// ListProfiles returns all saved profiles
func (a *App) ListProfiles() ([]config.ConnectionProfile, error) {
	profiles, err := a.Config.ListProfiles()
	if err == nil {
		a.updateMonitoring(profiles)
	}
	return profiles, err
}

// SaveProfile saves or updates a profile
func (a *App) SaveProfile(p config.ConnectionProfile) (string, error) {
	id, err := a.Config.SaveProfile(p)
	if err == nil {
		// Reload all profiles to sync monitoring
		if list, err := a.Config.ListProfiles(); err == nil {
			a.updateMonitoring(list)
		}
	}
	return id, err
}

// DeleteProfile removes a profile by ID
func (a *App) DeleteProfile(id string) (bool, error) {
	ok, err := a.Config.DeleteProfile(id)
	if err == nil && ok {
		if list, err := a.Config.ListProfiles(); err == nil {
			a.updateMonitoring(list)
		}
	}
	return ok, err
}

// GetProfile retrieves a single profile
func (a *App) GetProfile(id string) (*config.ConnectionProfile, error) {
	return a.Config.GetProfile(id)
}

func (a *App) updateMonitoring(profiles []config.ConnectionProfile) {
	if a.Monitoring == nil {
		return
	}
	var configs []monitoring.MonitoringConfig
	for _, p := range profiles {
		// Default to disabled if not present
		enabled := false
		interval := 10
		if p.Monitoring != nil {
			enabled = p.Monitoring.Enabled
			interval = p.Monitoring.Interval
		}
		configs = append(configs, monitoring.MonitoringConfig{
			ID:       p.ID,
			Name:     p.Name,
			Enabled:  enabled,
			Interval: interval,
		})
	}
	a.Monitoring.UpdateProfiles(configs)
}
