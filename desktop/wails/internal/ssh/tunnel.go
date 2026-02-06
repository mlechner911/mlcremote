package ssh

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/remotesystem"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// TunnelProfile describes the fields for starting an SSH tunnel
type TunnelProfile struct {
	User         string   `json:"user"`
	Host         string   `json:"host"`
	LocalPort    int      `json:"localPort"`
	RemoteHost   string   `json:"remoteHost"`
	RemotePort   int      `json:"remotePort"`
	IdentityFile string   `json:"identityFile"`
	Password     string   `json:"password"`
	Passphrase   string   `json:"passphrase"`
	UseNativeSSH bool     `json:"useNativeSSH"`
	ExtraArgs    []string `json:"extraArgs"`
	Mode         string   `json:"mode"`         // "default" or "parallel"
	DefaultShell string   `json:"defaultShell"` // e.g. "bash" or "powershell"
	RootPath     string   `json:"rootPath"`     // Optional root directory override
}

type Manager struct {
	mu          sync.Mutex
	cmd         *exec.Cmd
	tunnelState string
	stopping    bool
	activePort  int
	cancelFunc  context.CancelFunc // For stopping native tunnel
}

func NewManager() *Manager {
	return &Manager{}
}

// StartTunnel spawns an ssh -L localPort:remoteHost:remotePort user@host
// StartTunnel spawns an ssh -L localPort:remoteHost:remotePort user@host
func (m *Manager) StartTunnel(ctx context.Context, profile TunnelProfile) (string, error) {
	m.mu.Lock()
	// No defer Unlock() here, we manage it manually to allow monitoring during sleep

	if m.cmd != nil && m.cmd.Process != nil {
		m.mu.Unlock()
		return "already-running", nil
	}

	// Reset stopping flag
	m.stopping = false

	// Basic validation
	if profile.User == "" || profile.Host == "" {
		m.mu.Unlock()
		return "", errors.New("missing user or host")
	}
	if profile.LocalPort == 0 {
		profile.LocalPort = 8443
	}
	if profile.RemotePort == 0 {
		profile.RemotePort = 8443
	}
	if profile.RemoteHost == "" {
		profile.RemoteHost = "127.0.0.1"
	}

	// Verify DNS
	if _, err := net.LookupHost(profile.Host); err != nil {
		m.mu.Unlock()
		return "unknown-host", nil
	}

	// Kill existing on 8443?
	// Note: killPort was Windows specific in original, assume we keep it?
	_ = m.KillPort(profile.LocalPort)
	// We iterate KillPort? Or assume one kill is enough?
	// Sometimes it takes time.

	m.mu.Unlock()
	// Release lock during sleep/setup to be nice?
	// No, checking KillPort might need wait. But KillPort logic is internal.
	time.Sleep(200 * time.Millisecond)
	m.mu.Lock()

	// Double check
	if m.cmd != nil {
		m.mu.Unlock()
		return "already-running", nil
	}

	// Use Native Tunnel if Passphrase is set or explicitly requested
	// Native tunnel is required for Passphrase support to avoid writing decrypted keys to disk.
	if profile.Passphrase != "" || profile.UseNativeSSH || profile.Mode == "native" {
		ctx, cancel := context.WithCancel(ctx)
		m.cancelFunc = cancel
		m.mu.Unlock() // StartNativeTunnel manages its own locking for state updates

		return m.StartNativeTunnel(ctx, profile)
	}

	// Construct args
	// ssh -L 8443:localhost:8443 -N user@host -i identityFile
	args := []string{
		"-L", fmt.Sprintf("%d:%s:%d", profile.LocalPort, profile.RemoteHost, profile.RemotePort),
		"-N", // Do not execute a remote command
		// "-v", // verbose
	}

	if profile.IdentityFile != "" {
		args = append(args, "-i", profile.IdentityFile)
	}

	// Extra args
	args = append(args, "-o", "StrictHostKeyChecking=no") // Prototype convenience
	args = append(args, "-o", "UserKnownHostsFile=/dev/null")
	args = append(args, "-o", "ExitOnForwardFailure=yes")

	// Append user extra args
	args = append(args, profile.ExtraArgs...)

	destination := fmt.Sprintf("%s@%s", profile.User, profile.Host)
	args = append(args, destination)

	fmt.Printf("Starting Tunnel: ssh %v\n", args)

	cmd := exec.Command("ssh", args...)
	// Set SysProcAttr for windows to hide window?
	// if runtime.GOOS == "windows" { ... } -> copied from original code usually
	remotesystem.ConfigureCmd(cmd)

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		m.tunnelState = "error"
		m.mu.Unlock()
		return "", err
	}

	m.cmd = cmd
	m.tunnelState = "connected"

	// Stream logs
	go streamReaderToEvents(ctx, stdout, "stdout")
	go streamReaderToEvents(ctx, stderr, "stderr")

	// Monitor exit
	go func() {
		err := cmd.Wait()
		m.mu.Lock()
		defer m.mu.Unlock()
		if m.cmd == cmd { // Only if it's still the active command
			m.cmd = nil
			m.tunnelState = "disconnected"
			m.activePort = 0
			wailsRuntime.EventsEmit(ctx, "tunnel-status", "disconnected")

			// Only log error if not stopping intentionally
			if err != nil && !m.stopping {
				fmt.Printf("Tunnel exited with error: %v\n", err)
			}
		}
	}()

	m.activePort = profile.LocalPort

	// Release lock to allow Monitor to acquire it if process exits immediately
	m.mu.Unlock()

	// Wait briefly to catch immediate startup errors (like port in use, auth fail)
	time.Sleep(500 * time.Millisecond)

	// Re-acquire lock to check status
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cmd != cmd {
		// The monitor goroutine has run and cleared m.cmd => Process exited!
		m.tunnelState = "error"
		return "failed", fmt.Errorf("tunnel process exited immediately (check logs or port conflict)")
	}

	return "started", nil
}

func (m *Manager) GetActivePort() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.activePort
}

func (m *Manager) StopTunnel() (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Signal intentional stop
	m.stopping = true

	// Stop native tunnel if running
	if m.cancelFunc != nil {
		m.cancelFunc()
		m.cancelFunc = nil
		m.tunnelState = "disconnected"
		m.activePort = 0
		return "stopped", nil
	}

	if m.cmd != nil && m.cmd.Process != nil {
		if err := m.cmd.Process.Kill(); err != nil {
			return "", err
		}
		// m.cmd set to nil in Wait() goroutine
		return "stopped", nil
	}
	return "not-running", nil
}

func (m *Manager) TunnelStatus() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.tunnelState
}

// Helper to kill port on Windows (or others using lsof?)
func (m *Manager) KillPort(port int) error {
	if runtime.GOOS == "windows" {
		// netstat -ano | findstr :<port>
		// taskkill /PID <pid> /F
		// Simplified implementation for prototype
		cmd := exec.Command("powershell", "-Command",
			fmt.Sprintf("Get-NetTCPConnection -LocalPort %d -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }", port))
		remotesystem.ConfigureCmd(cmd)
		// don't check error, might not exist
		_ = cmd.Run()
	} else {
		// Linux/Mac: lsof -ti:8443 | xargs kill -9
		// Not implemented in this snippet to keep it simple/safe
	}
	return nil
}

func streamReaderToEvents(ctx context.Context, r io.Reader, source string) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		if source == "stderr" {
			fmt.Printf("[SSH STDERR] %s\n", line)
		}
		wailsRuntime.EventsEmit(ctx, "ssh-log", fmt.Sprintf("[%s] %s", source, line))
	}
}
