package app

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/monitoring"
)

// pollStats is the callback for the monitoring service
func (a *App) pollStats(cfg monitoring.MonitoringConfig) (monitoring.Stats, error) {
	// 1. Get full profile
	profile, err := a.Config.GetProfile(cfg.ID)
	if err != nil {
		return monitoring.Stats{}, err
	}

	// 2. Determine command
	// We use the 'dev-server stats' command to trigger a one-shot collection
	// This ensures we get fresh data even if the main server process is not running.
	// It also persists the data to stats.jsonl.
	cmd := "~/.mlcremote/bin/dev-server stats"
	if profile.IsWindows || strings.Contains(strings.ToLower(profile.RemoteOS), "windows") {
		cmd = "%USERPROFILE%\\.mlcremote\\bin\\dev-server.exe stats"
	}

	// 3. Run Command
	output, err := a.SSH.RunCommand(profile.Host, profile.User, profile.Port, "", profile.IdentityFile, profile.Passphrase, cmd)
	if err != nil {
		// Self-healing: If permission denied (exit 126), try to chmod +x and retry
		if strings.Contains(err.Error(), "Permission denied") || strings.Contains(err.Error(), "126") {
			fixCmd := "chmod +x ~/.mlcremote/bin/dev-server"
			if profile.IsWindows {
				// Windows doesn't need chmod, but if we are here it's likely not windows or using WSL
				// Just retry for now or skip.
			} else {
				_, _ = a.SSH.RunCommand(profile.Host, profile.User, profile.Port, "", profile.IdentityFile, profile.Passphrase, fixCmd)
				// Retry
				output, err = a.SSH.RunCommand(profile.Host, profile.User, profile.Port, "", profile.IdentityFile, profile.Passphrase, cmd)
				if err != nil {
					return monitoring.Stats{}, err
				}
			}
		} else {
			return monitoring.Stats{}, err
		}
	}

	// 4. Parse Output
	var stat monitoring.Stats
	// Output might contain headers or empty lines? tail -n 1 should be just one line.
	if err := json.Unmarshal([]byte(output), &stat); err != nil {
		return monitoring.Stats{}, fmt.Errorf("failed to parse stats: %w. Output: %s", err, output)
	}

	return stat, nil
}

// GetServerStats returns the latest stats for a profile
func (a *App) GetServerStats(profileID string) monitoring.Stats {
	if a.Monitoring == nil {
		return monitoring.Stats{}
	}
	return a.Monitoring.GetStats(profileID)
}

// UpdateMonitoringProfiles updates the monitoring service with new configs
func (a *App) UpdateMonitoringProfiles(configs []monitoring.MonitoringConfig) {
	if a.Monitoring != nil {
		a.Monitoring.UpdateProfiles(configs)
	}
}
