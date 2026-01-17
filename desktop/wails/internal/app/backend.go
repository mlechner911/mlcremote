package app

import (
	"fmt"
	"strings"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/remotesystem"
)

// CheckBackend checks if the dev-server binary exists on the remote host
func (a *App) CheckBackend(profileJSON string) (bool, error) {
	return a.Backend.CheckBackend(profileJSON)
}

// CheckRemoteVersion returns the version string of the remote backend or "unknown"
func (a *App) CheckRemoteVersion(profileJSON string) (string, error) {
	return a.Backend.CheckRemoteVersion(profileJSON)
}

// DetectRemoteOS attempts to determine the remote operating system and architecture
func (a *App) DetectRemoteOS(profileJSON string) (string, error) {
	os, arch, err := a.Backend.DetectRemoteOS(profileJSON)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/%s", os, arch), nil
}

// DeployAgent ensures the correct binary and assets are on the remote host
func (a *App) DeployAgent(profileJSON string, osArch string, token string) (string, error) {
	parts := strings.Split(osArch, "/")
	if len(parts) != 2 {
		return "failed", fmt.Errorf("invalid os/arch format: %s", osArch)
	}
	targetOS := remotesystem.RemoteOS(parts[0])
	targetArch := remotesystem.RemoteArch(parts[1])

	// Basic validation (optional but good)
	if targetOS != remotesystem.OSLinux && targetOS != remotesystem.OSDarwin && targetOS != remotesystem.OSWindows {
		return "failed", fmt.Errorf("unknown os: %s", targetOS)
	}

	return a.Backend.DeployAgent(profileJSON, targetOS, targetArch, token, false)
}

// IsServerRunning checks if the backend is already active on the remote host
func (a *App) IsServerRunning(profileJSON string, osString string) (bool, error) {
	return a.Backend.IsServerRunning(profileJSON, osString)
}

// InstallBackend is legacy/stub for backward compatibility
func (a *App) InstallBackend(profileJSON string) (string, error) {
	return "deprecated", nil
}

// SaveIdentityFile writes a base64-encoded private key payload to a temp file
func (a *App) SaveIdentityFile(b64 string, filename string) (string, error) {
	return a.Backend.SaveIdentityFile(b64, filename)
}

// GetRemoteFileTree returns a string representation of the remote .mlcremote directory tree
func (a *App) GetRemoteFileTree(profileJSON string) (string, error) {
	return a.Backend.GetRemoteFileTree(profileJSON)
}

// TailRemoteLogs returns the last 50 lines of the systemd service logs (or log file)
func (a *App) TailRemoteLogs(profileJSON string) (string, error) {
	return a.Backend.TailRemoteLogs(profileJSON)
}

// StopBackend attempts to kill the remote process
func (a *App) StopBackend(profileJSON string) (string, error) {
	return a.Backend.StopBackend(profileJSON)
}
