package app

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// TunnelProfile describes the fields for starting an SSH tunnel
type TunnelProfile struct {
	User         string   `json:"user"`
	Host         string   `json:"host"`
	LocalPort    int      `json:"localPort"`
	RemoteHost   string   `json:"remoteHost"`
	RemotePort   int      `json:"remotePort"`
	IdentityFile string   `json:"identityFile"` // optional path to private key
	Password     string   `json:"password"`
	ExtraArgs    []string `json:"extraArgs"` // additional ssh args
}

// StartTunnel spawns an ssh -L localPort:remoteHost:remotePort user@host
// profile is a simple string with the ssh args encoded as JSON or a short form.
// For the prototype we accept a simple command-like string: e.g. "-L8443:localhost:8443 user@remotehost"
func (a *App) StartTunnel(profile string) (string, error) {
	a.tunnelMu.Lock()
	defer a.tunnelMu.Unlock()
	if a.tunnelCmd != nil {
		return "already-running", errors.New("tunnel already running")
	}

	// build ssh command
	// split profile by spaces into args (simple prototype)
	args := []string{"-o", "ExitOnForwardFailure=yes", "-N"}
	// append profile tokens
	// naive split
	var toks []string
	for _, t := range splitArgs(profile) {
		toks = append(toks, t)
	}
	args = append(args, toks...)

	cmd := createSilentCmd("ssh", args...)
	stdoutPipe, _ := cmd.StdoutPipe()
	stderrPipe, _ := cmd.StderrPipe()
	// start process
	if err := cmd.Start(); err != nil {
		return "failed", err
	}
	// stream logs
	go streamReaderToEvents(a.ctx, stdoutPipe)
	go streamReaderToEvents(a.ctx, stderrPipe)
	a.tunnelCmd = cmd
	// monitor process lifetime in a separate goroutine to ensure cleanup
	go func() {
		_ = cmd.Wait()
		a.tunnelMu.Lock()
		// Only clear if it's still OUR cmd (avoid clearing a newer one if raced)
		if a.tunnelCmd == cmd {
			a.tunnelCmd = nil
			a.tunnelState = "stopped"
		}
		a.tunnelMu.Unlock()
	}()

	a.tunnelState = "starting"

	// monitor in goroutine (Wait was moved to separate goroutine above, so here we just handle logical state if needed or remove this block if redundant.
	// In StartTunnelWithProfile we have specific health checks. Here it was just waiting.
	// The previous implementation had:
	/*
			go func() {
				err := cmd.Wait()
		        ...
			}()
	*/
	// The new structure above handles Wait. So we don't need another waiter.
	// However, StartTunnel (simple version) didn't have health check logic in the original main.go?
	// Let's check step 750 lines 109-120. Yes, it just waited and set stopped.
	// The new goroutine I added above lines 56-66 handles exactly that.

	return "started", nil
}

// StartTunnelWithProfile starts a tunnel using a structured JSON profile.
// profileJSON should be a JSON-encoded TunnelProfile.
func (a *App) StartTunnelWithProfile(profileJSON string) (string, error) {
	var p TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "failed", fmt.Errorf("invalid profile JSON: %w", err)
	}
	if p.Host == "" || p.User == "" || p.LocalPort == 0 || p.RemotePort == 0 {
		return "failed", errors.New("missing required profile fields: user, host, localPort, remotePort")
	}

	a.tunnelMu.Lock()
	defer a.tunnelMu.Unlock()
	if a.tunnelCmd != nil {
		return "already-running", errors.New("tunnel already running")
	}

	// check ssh binary exists
	if _, err := exec.LookPath("ssh"); err != nil {
		return "failed", fmt.Errorf("ssh not found in PATH: %w", err)
	}

	// check identity file if provided
	if p.IdentityFile != "" {
		if fi, err := os.Stat(p.IdentityFile); err != nil {
			return "failed", fmt.Errorf("identity file not accessible: %w", err)
		} else if fi.IsDir() {
			return "failed", fmt.Errorf("identity file is a directory: %s", p.IdentityFile)
		}
	}

	// check local port availability
	if err := a.KillPort(p.LocalPort); err != nil {
		fmt.Printf("Warning: failed to kill port %d: %v\n", p.LocalPort, err)
	}

	// try to listen on the local port to verify it's free
	ln, err := netListenTCP(p.LocalPort)
	if err != nil {
		fmt.Printf("Port %d busy, checking if existing tunnel is valid...\n", p.LocalPort)
		localURL := fmt.Sprintf("http://127.0.0.1:%d", p.LocalPort)
		client := &http.Client{Timeout: 2 * time.Second}
		resp, hErr := client.Get(fmt.Sprintf("%s/health", localURL))
		if hErr == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				a.tunnelState = "started"
				runtime.EventsEmit(a.ctx, "navigate", localURL)
				return "started", nil
			}
		}
		time.Sleep(500 * time.Millisecond)
		ln, err = netListenTCP(p.LocalPort)
		if err != nil {
			return "failed", fmt.Errorf("local port %d unavailable and health check failed: %w", p.LocalPort, err)
		}
	}
	_ = ln.Close()

	// --- Multi-OS / Agent Deployment Logic ---

	// 1. Detect OS/Arch
	runtime.EventsEmit(a.ctx, "connection-status", "Scanning remote host...")
	osArch, err := a.DetectRemoteOS(profileJSON)
	if err != nil {
		// Log but proceed? No, detection is critical now.
		return "failed", fmt.Errorf("remote detection failed: %w", err)
	}
	fmt.Printf("Detected Remote: %s\n", osArch)

	// 2. Check if Server is already running (Service Mode Check)
	runtime.EventsEmit(a.ctx, "connection-status", "Checking for running server...")
	running, err := a.IsServerRunning(profileJSON, osArch)
	if err != nil {
		fmt.Printf("Warning: server check failed: %v\n", err)
		running = false
	}

	var remoteCommand string
	if running {
		fmt.Println("Server is running (Service Mode). Connecting...")
		runtime.EventsEmit(a.ctx, "connection-status", "Service found, connecting...")
	} else {
		// Agent Mode: Deploy and Run
		fmt.Println("Server not running (Agent Mode). Deploying...")
		runtime.EventsEmit(a.ctx, "connection-status", "Deploying agent...")

		status, err := a.DeployAgent(profileJSON, osArch)
		if err != nil {
			return "failed", fmt.Errorf("agent deployment failed: %w", err)
		}
		fmt.Printf("Agent Deployed: %s\n", status)
		runtime.EventsEmit(a.ctx, "connection-status", "Starting agent...")

		// Construct Execution Command
		// Note: We use --no-auth because the tunnel secures the connection
		// and we don't want to deal with token exchange in this mode if possible.
		// However, backend authentication middleware might still be active?
		// The backend flag `--no-auth` disables the token check.
		if strings.HasPrefix(osArch, "windows") {
			// Windows: Execute EXE directly
			// Command: .mlcremote\bin\dev-server.exe --port 8443 --root . --static-dir .mlcremote\frontend --no-auth
			// We use %UserProfile% or relative path if we start in Home.
			// SSH usually starts in %UserProfile%.
			remoteCommand = ".mlcremote\\bin\\dev-server.exe --port 8443 --root . --static-dir .mlcremote\\frontend --no-auth"
		} else {
			// Linux/Mac: Execute wrapper script
			remoteCommand = "~/.mlcremote/run-server.sh"
		}
	}

	// Build ssh args
	args := []string{"-o", "ExitOnForwardFailure=yes"}

	// Add identity file if provided
	if p.IdentityFile != "" {
		args = append(args, "-i", p.IdentityFile)
	}
	// Forward argument
	forward := fmt.Sprintf("-L%d:%s:%d", p.LocalPort, p.RemoteHost, p.RemotePort)
	args = append(args, forward)

	// If Agent Mode, we need TTY maybe? Or just execute.
	// Actually, if we just run command, we don't pass -N.
	// If Service Mode (running), we pass -N.
	if remoteCommand == "" {
		args = append(args, "-N")
	}

	// append user@host
	args = append(args, fmt.Sprintf("%s@%s", p.User, p.Host))

	// append Remote Command if any
	if remoteCommand != "" {
		args = append(args, remoteCommand)
	}

	// append extras
	if len(p.ExtraArgs) > 0 {
		args = append(args, p.ExtraArgs...)
	}

	cmd := createSilentCmd("ssh", args...)
	stdoutPipe, _ := cmd.StdoutPipe()
	stderrPipe, _ := cmd.StderrPipe()
	if err := cmd.Start(); err != nil {
		return "failed", err
	}

	go streamReaderToEvents(a.ctx, stdoutPipe)
	go streamReaderToEvents(a.ctx, stderrPipe)

	a.tunnelCmd = cmd
	a.tunnelState = "starting"

	// ... Monitor Lifecycle ...
	go func() {
		_ = cmd.Wait()
		a.tunnelMu.Lock()
		if a.tunnelCmd == cmd {
			a.tunnelCmd = nil
			a.tunnelState = "stopped"
		}
		a.tunnelMu.Unlock()
	}()

	// monitor health in background and emit navigate event when reachable
	localURL := fmt.Sprintf("http://127.0.0.1:%d", p.LocalPort)
	go func() {
		client := &http.Client{Timeout: 2 * time.Second}
		// Try for 15 seconds (slightly longer for cold start)
		for i := 0; i < 45; i++ {
			a.tunnelMu.Lock()
			if a.tunnelCmd != cmd {
				a.tunnelMu.Unlock()
				return
			}
			a.tunnelMu.Unlock()

			resp, err := client.Get(fmt.Sprintf("%s/health", localURL))
			if err == nil {
				resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					runtime.EventsEmit(a.ctx, "navigate", localURL)
					a.tunnelMu.Lock()
					if a.tunnelCmd == cmd {
						a.tunnelState = "started"
					}
					a.tunnelMu.Unlock()
					return
				}
			}
			time.Sleep(500 * time.Millisecond)
		}
		// Timeout
		a.tunnelMu.Lock()
		if a.tunnelCmd == cmd {
			a.tunnelState = "started"
		}
		a.tunnelMu.Unlock()
	}()

	return "started", nil
}

// StopTunnel stops the running ssh tunnel process and waits for it to exit
func (a *App) StopTunnel() (string, error) {
	a.tunnelMu.Lock()
	cmd := a.tunnelCmd
	a.tunnelMu.Unlock()

	if cmd == nil {
		return "stopped", nil
	}

	a.tunnelState = "stopping"
	// Kill the process
	if cmd.Process != nil {
		// We use Kill immediately to be sure; Signal might be ignored or slow
		_ = cmd.Process.Kill()
	}

	// Poll wait for the monitor goroutine to clear the tunnelCmd
	// This ensures that when this function returns, reliable start is possible.
	for i := 0; i < 50; i++ {
		a.tunnelMu.Lock()
		if a.tunnelCmd == nil {
			a.tunnelMu.Unlock()
			return "stopped", nil
		}
		a.tunnelMu.Unlock()
		time.Sleep(100 * time.Millisecond)
	}

	return "failed", errors.New("timed out waiting for tunnel to stop")
}

// TunnelStatus returns a short status string
func (a *App) TunnelStatus() string {
	a.tunnelMu.Lock()
	defer a.tunnelMu.Unlock()
	if a.tunnelCmd == nil {
		return "stopped"
	}
	return a.tunnelState
}

// KillPort finds and kills the process listening on the given port (Windows specific)
func (a *App) KillPort(port int) error {
	// 1. Find the PID using netstat
	// netstat -ano | findstr :<port>
	cmd := createSilentCmd("netstat", "-ano")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return err
	}

	lines := strings.Split(string(out), "\n")
	var pid string
	target := fmt.Sprintf(":%d", port)
	for _, line := range lines {
		if strings.Contains(line, target) && strings.Contains(line, "LISTENING") {
			parts := strings.Fields(line)
			if len(parts) > 0 {
				pid = parts[len(parts)-1]
				break
			}
		}
	}

	if pid == "" || pid == "0" {
		return nil // no process found
	}

	// 2. Kill the process
	// taskkill /F /PID <pid>
	killCmd := createSilentCmd("taskkill", "/F", "/PID", pid)
	return killCmd.Run()
}

// streamReaderToEvents reads from an io.Reader line-by-line and emits 'ssh-log' events
func streamReaderToEvents(ctx context.Context, r io.Reader) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		runtime.EventsEmit(ctx, "ssh-log", line)
	}
}
