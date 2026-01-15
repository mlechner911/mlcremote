package app

import (
	"encoding/json"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/config"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
	"github.com/wailsapp/wails/v2/pkg/runtime"
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
	fmt.Printf("[DEBUG] StartTunnel: Raw JSON: %s\n", profileJSON)
	fmt.Printf("[DEBUG] StartTunnel: Parsed Mode: '%s'\n", cp.Mode)

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
	runtime.EventsEmit(a.ctx, "connection-status", "detecting_os")

	var osArch string
	var err error

	if cp.RemoteOS != "" && cp.RemoteArch != "" {
		fmt.Printf("[DEBUG] StartTunnel: Using cached OS: %s/%s\n", cp.RemoteOS, cp.RemoteArch)
		osArch = fmt.Sprintf("%s/%s", cp.RemoteOS, cp.RemoteArch)
	} else {
		// We pass the raw JSON because Backend service expects it (to avoid re-marshalling)
		osArch, err = a.Backend.DetectRemoteOS(profileJSON)
		if err != nil {
			return "failed", fmt.Errorf("failed to detect remote OS: %w", err)
		}
	}

	// 4. Deploy Agent

	// Update OS Metadata in Profile
	// We persist the detected OS, Architecture, and Version immediately.
	// This ensures the UI (Sidebar, Details) shows accurate info (e.g., "windows/amd64 v1.0.3")
	// avoiding "vunknown" or missing labels on subsequent launches.
	if parts := strings.Split(osArch, "/"); len(parts) >= 2 {
		cp.RemoteOS = parts[0]
		cp.RemoteArch = parts[1]

		// Fetch Version efficiently using known OS to handle pathing correctly
		if version, err := a.Backend.CheckRemoteVersionWithOS(profileJSON, cp.RemoteOS); err == nil {
			cp.RemoteVersion = version
		} else {
			cp.RemoteVersion = "unknown"
		}

		// Save Updated Profile with OS Info
		a.Config.SaveProfile(cp)
	}

	// Generate a secure session token
	token := uuid.New().String()

	runtime.EventsEmit(a.ctx, "connection-status", "deploying_agent")

	forceNew := cp.Mode == "parallel"
	deployRes, err := a.Backend.DeployAgent(profileJSON, osArch, token, forceNew)
	if err != nil {
		return deployRes, err
	}

	remotePort := 8443
	if strings.HasPrefix(deployRes, "deployed:") {
		remainder := strings.TrimPrefix(deployRes, "deployed:")
		if strings.Contains(remainder, ":") {
			// deployed:PORT:TOKEN
			parts := strings.SplitN(remainder, ":", 2)
			if p, err := strconv.Atoi(parts[0]); err == nil && p > 0 {
				remotePort = p
			}
			token = parts[1]
		} else {
			// Legacy/Standard: deployed:TOKEN
			token = remainder
		}
	}

	// 6. Start Tunnel via SSH Service
	runtime.EventsEmit(a.ctx, "connection-status", "starting_tunnel")
	// Check if LocalPort is available, if not find a free one
	targetPort := cp.LocalPort
	if targetPort == 0 {
		targetPort = 8443
	}

	// If parallel mode, ensure we don't conflict with default local port 8443 if user didn't specify strict port
	// But dynamic scanning below handles it.

	// Try to find a free port starting from targetPort
	for i := 0; i < 100; i++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", targetPort))
		if err == nil {
			ln.Close()
			break
		}
		targetPort++
	}

	// specific mapping to SSH TunnelProfile
	tp := ssh.TunnelProfile{
		User:         cp.User,
		Host:         cp.Host,
		LocalPort:    targetPort,
		RemoteHost:   "127.0.0.1", // Agent binds to 127.0.0.1 explicitly now
		RemotePort:   remotePort,
		IdentityFile: cp.IdentityFile,
		ExtraArgs:    cp.ExtraArgs,
		Mode:         cp.Mode,
	}
	if cp.Port != 0 && cp.Port != 22 {
		tp.ExtraArgs = append(tp.ExtraArgs, "-p", fmt.Sprintf("%d", cp.Port))
	}

	res, err := a.SSH.StartTunnel(a.ctx, tp)
	if err != nil {
		return res, err
	}

	// 7. Wait for Healthy (optional, but good UX)
	runtime.EventsEmit(a.ctx, "connection-status", "verifying_connection")
	// We can check /health through the tunnel
	time.Sleep(500 * time.Millisecond) // Wait for tunnel to establish
	// Check backend health
	for i := 0; i < 20; i++ {
		status, _ := a.HealthCheck(fmt.Sprintf("http://localhost:%d", targetPort), token, 1)
		if status == "ok" {
			return fmt.Sprintf("started:%d:%s", targetPort, token), nil
		}
		time.Sleep(500 * time.Millisecond)
	}

	return fmt.Sprintf("started:%d:%s", targetPort, token), nil // Return started anyway, frontend verifies connectivity
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
