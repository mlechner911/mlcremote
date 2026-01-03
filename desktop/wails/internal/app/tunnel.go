package app

import (
	"encoding/json"
	"fmt"
	"net"
	"time"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/config"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
)

// StartTunnel starts a basic tunnel from a command string (legacy/simple)
func (a *App) StartTunnel(profile string) (string, error) {
	// profile string example: "-L8443:localhost:8443 user@host"
	// This was for the prototype. We should encourage using StartTunnelWithProfile.
	// But to keep binding compatible, we might need it.
	// For now, let's return error or try to parse if really needed.
	// The frontend primarily uses StartTunnelWithProfile now.
	return "", fmt.Errorf("use StartTunnelWithProfile")
}

// StartTunnelWithProfile starts a tunnel using a structured JSON profile.
func (a *App) StartTunnelWithProfile(profileJSON string) (string, error) {
	// 1. Parse generic profile for Config Service
	var cp config.ConnectionProfile
	if err := json.Unmarshal([]byte(profileJSON), &cp); err != nil {
		return "failed", fmt.Errorf("invalid profile JSON: %w", err)
	}

	// 2. Save/Update Profile (LastUsed)
	// We might want to ensure ID is set if missing, but LaunchScreen usually handles it.
	if _, err := a.Config.SaveProfile(cp); err != nil {
		fmt.Printf("Warning: Failed to save profile: %v\n", err)
	}

	// 2.5 Verify DNS (Fail fast)
	if _, err := net.LookupHost(cp.Host); err != nil {
		return "unknown-host", fmt.Errorf("unknown host: %w", err)
	}

	// 3. Detect Remote OS
	// We pass the raw JSON because Backend service expects it (to avoid re-marshalling)
	osArch, err := a.Backend.DetectRemoteOS(profileJSON)
	if err != nil {
		return "failed", fmt.Errorf("failed to detect remote OS: %w", err)
	}

	// update profile with detected OS if missing?
	// The frontend does this after connection success, so we can skip here or do it.
	// Let's stick to the flow: Backend methods return info, Front end saves it.

	// 4. Deploy Agent
	if res, err := a.Backend.DeployAgent(profileJSON, osArch); err != nil {
		return res, err
	}

	// 5. Start Tunnel via SSH Service
	// specific mapping to SSH TunnelProfile
	tp := ssh.TunnelProfile{
		User:         cp.User,
		Host:         cp.Host,
		LocalPort:    cp.LocalPort,
		RemoteHost:   "localhost", // Agent binds to localhost
		RemotePort:   8443,
		IdentityFile: cp.IdentityFile,
		ExtraArgs:    cp.ExtraArgs,
	}
	if cp.Port != 0 && cp.Port != 22 {
		tp.ExtraArgs = append(tp.ExtraArgs, "-p", fmt.Sprintf("%d", cp.Port))
	}

	res, err := a.SSH.StartTunnel(a.ctx, tp)
	if err != nil {
		return res, err
	}

	// 6. Wait for Healthy (optional, but good UX)
	// We can check /health through the tunnel
	time.Sleep(500 * time.Millisecond) // Wait for tunnel to establish
	// Check backend health
	for i := 0; i < 5; i++ {
		status, _ := a.HealthCheck(fmt.Sprintf("http://localhost:%d", cp.LocalPort), 1)
		if status == "ok" {
			return "started", nil
		}
		time.Sleep(500 * time.Millisecond)
	}

	return "started", nil // Return started anyway, frontend verifies connectivity
}

// StopTunnel stops the running ssh tunnel process and waits for it to exit
func (a *App) StopTunnel() (string, error) {
	return a.SSH.StopTunnel()
}

// TunnelStatus returns a short status string
func (a *App) TunnelStatus() string {
	return a.SSH.TunnelStatus()
}

// KillPort finds and kills the process listening on the given port (Windows specific)
func (a *App) KillPort(port int) error {
	return a.SSH.KillPort(port)
}
