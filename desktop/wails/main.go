package main

import (
	"bufio"
	"context"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

// App struct
type App struct {
	ctx         context.Context
	tunnelMu    sync.Mutex
	tunnelCmd   *exec.Cmd
	tunnelState string
}

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

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// HealthCheck checks whether the backend at the given URL responds to /health
func (a *App) HealthCheck(url string, timeoutSeconds int) (string, error) {
	client := http.Client{Timeout: time.Duration(timeoutSeconds) * time.Second}
	resp, err := client.Get(fmt.Sprintf("%s/health", url))
	if err != nil {
		return "not-found", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return "ok", nil
	}
	return "not-ok", nil
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

	cmd := exec.Command("ssh", args...)
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
	a.tunnelState = "starting"

	// monitor in goroutine
	go func() {
		err := cmd.Wait()
		a.tunnelMu.Lock()
		defer a.tunnelMu.Unlock()
		if err != nil {
			a.tunnelState = "stopped"
			a.tunnelCmd = nil
		} else {
			a.tunnelState = "stopped"
			a.tunnelCmd = nil
		}
	}()

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
	// try to listen on the local port; if occupied, return error
	ln, err := netListenTCP(p.LocalPort)
	if err != nil {
		return "failed", fmt.Errorf("local port %d unavailable: %w", p.LocalPort, err)
	}
	// close immediately to free for ssh to bind
	_ = ln.Close()

	// Build ssh args
	args := []string{"-o", "ExitOnForwardFailure=yes", "-N"}
	// Add identity file if provided
	if p.IdentityFile != "" {
		args = append(args, "-i", p.IdentityFile)
	}
	// Forward argument
	forward := fmt.Sprintf("-L%d:%s:%d", p.LocalPort, p.RemoteHost, p.RemotePort)
	args = append(args, forward)
	// append user@host
	args = append(args, fmt.Sprintf("%s@%s", p.User, p.Host))
	// append extras
	if len(p.ExtraArgs) > 0 {
		args = append(args, p.ExtraArgs...)
	}

	cmd := exec.Command("ssh", args...)
	stdoutPipe, _ := cmd.StdoutPipe()
	stderrPipe, _ := cmd.StderrPipe()
	if err := cmd.Start(); err != nil {
		return "failed", err
	}
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

	a.tunnelCmd = cmd
	a.tunnelState = "starting"

	// monitor health in background and emit navigate event when reachable
	localURL := fmt.Sprintf("http://127.0.0.1:%d", p.LocalPort)
	go func() {
		client := &http.Client{Timeout: 2 * time.Second}
		// Try for 15 seconds
		for i := 0; i < 30; i++ {
			// Check if process died
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
			a.tunnelState = "started" // assume started even if check failed? or failed?
		}
		a.tunnelMu.Unlock()
	}()

	return "started", nil
}

// SaveIdentityFile writes a base64-encoded private key payload to a temp file and returns the path.
func (a *App) SaveIdentityFile(b64 string, filename string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", fmt.Errorf("invalid base64 payload: %w", err)
	}
	tmpdir := os.TempDir()
	// sanitize filename
	outPath := fmt.Sprintf("%s/mlcremote-key-%d-%s", tmpdir, time.Now().UnixNano(), filename)
	if err := ioutil.WriteFile(outPath, data, 0600); err != nil {
		return "", fmt.Errorf("failed to write identity file: %w", err)
	}
	return outPath, nil
}

// StopTunnel stops the running ssh tunnel process
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

// splitArgs is a naive splitter that handles quoted tokens roughly
func splitArgs(s string) []string {
	var out []string
	cur := ""
	inQuotes := false
	for _, r := range s {
		switch r {
		case ' ':
			if inQuotes {
				cur += string(r)
			} else if cur != "" {
				out = append(out, cur)
				cur = ""
			}
		case '"':
			inQuotes = !inQuotes
		default:
			cur += string(r)
		}
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

// netListenTCP tries to listen on localhost:port to detect availability.
func netListenTCP(port int) (net.Listener, error) {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	return net.Listen("tcp", addr)
}

// streamReaderToEvents reads from an io.Reader line-by-line and emits 'ssh-log' events
func streamReaderToEvents(ctx context.Context, r io.Reader) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		runtime.EventsEmit(ctx, "ssh-log", line)
	}
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	a.tunnelMu.Lock()
	defer a.tunnelMu.Unlock()
	if a.tunnelCmd != nil && a.tunnelCmd.Process != nil {
		_ = a.tunnelCmd.Process.Kill()
	}
}

func main() {
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "MLCRemote Desktop Prototype",
		Width:  900,
		Height: 700,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Bind: []interface{}{
			app,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

// CheckBackend checks if the dev-server binary exists on the remote host
func (a *App) CheckBackend(profileJSON string) (bool, error) {
	var p TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return false, fmt.Errorf("invalid profile JSON: %w", err)
	}
	if p.Host == "" || p.User == "" {
		return false, errors.New("missing user or host")
	}

	// Construct SSH command to check file existence
	args := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		args = append(args, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		args = append(args, p.ExtraArgs...)
	}
	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	// Check for the binary in the new location
	args = append(args, target, "test -f ~/.mlcremote/bin/dev-server")

	cmd := exec.Command("ssh", args...)
	// verify functionality: exit code 0 means file exists
	if err := cmd.Run(); err != nil {
		return false, nil
	}
	return true, nil
}

// InstallBackend builds the backend locally and deploys it to the remote server
func (a *App) InstallBackend(profileJSON string) (string, error) {
	var p TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "failed", fmt.Errorf("invalid profile JSON: %w", err)
	}

	// 1. Cross-compile backend
	cwd, _ := os.Getwd()
	// Navigate up from desktop/wails to root, then to backend
	// Assuming cwd is .../desktop/wails
	backendRoot := filepath.Join(cwd, "..", "..", "backend")

	// Check if backendRoot exists to be sure
	if _, err := os.Stat(backendRoot); os.IsNotExist(err) {
		// Fallback: maybe we are running in dev mode differently?
		// Try relative to binary location if compiled?
		return "failed", fmt.Errorf("backend directory not found at %s", backendRoot)
	}

	binDir := filepath.Join(cwd, "..", "..", "bin")
	// Ensure bin dir exists
	_ = os.MkdirAll(binDir, 0755)

	destBinary := filepath.Join(binDir, "dev-server")

	// We run go build inside the backend directory so it picks up the go.mod there
	buildCmd := exec.Command("go", "build", "-ldflags", "-s -w", "-o", destBinary, "./cmd/dev-server")
	buildCmd.Dir = backendRoot
	buildCmd.Env = append(os.Environ(), "GOOS=linux", "GOARCH=amd64")

	if out, err := buildCmd.CombinedOutput(); err != nil {
		return "build-failed", fmt.Errorf("build failed: %s (dir: %s)", string(out), backendRoot)
	}

	binPath := destBinary // use absolute path for SCP

	// 2. Create remote directory structure
	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	mkdirArgs := append([]string{}, sshBaseArgs...)
	// Create ~/.mlcremote structure
	mkdirArgs = append(mkdirArgs, target, "mkdir -p ~/.mlcremote/bin ~/.mlcremote/frontend ~/.config/systemd/user")
	if err := exec.Command("ssh", mkdirArgs...).Run(); err != nil {
		return "setup-failed", fmt.Errorf("failed to create remote directories: %w", err)
	}

	// 3. Upload binary using SCP
	scpArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		scpArgs = append(scpArgs, "-i", p.IdentityFile)
	}
	// Upload to ~/.mlcremote/bin/dev-server
	// We need to use scp args structure carefully
	scpBinArgs := append([]string{}, scpArgs...)
	scpBinArgs = append(scpBinArgs, binPath, fmt.Sprintf("%s:~/.mlcremote/bin/dev-server", target))

	if out, err := exec.Command("scp", scpBinArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("scp binary failed: %s", string(out))
	}

	// 3.5. Upload Frontend Assets
	// Ensure local dist exists (it should, we are running wails)
	frontendDist := filepath.Join(cwd, "frontend", "dist")
	if _, err := os.Stat(frontendDist); err == nil {
		scpDistArgs := append([]string{}, scpArgs...)
		// recursive copy
		scpDistArgs = append(scpDistArgs, "-r", frontendDist, fmt.Sprintf("%s:~/.mlcremote/frontend", target))
		// first remove old frontend to be clean
		rmArgs := append([]string{}, sshBaseArgs...)
		rmArgs = append(rmArgs, target, "rm -rf ~/.mlcremote/frontend && mkdir -p ~/.mlcremote/frontend")
		_ = exec.Command("ssh", rmArgs...).Run()

		// scp -r .../dist/* user@host:~/.mlcremote/frontend
		// simpler: upload dist as folder then rename? or scp -r dist/. destination
		// scp -r source destination
		// We want contents of dist to be in ~/.mlcremote/frontend
		// So we upload dist to ~/.mlcremote/ and rename or just scp to ~/.mlcremote/frontend
		// Let's safe-bet: upload dist folder to ~/.mlcremote/ then move contents

		// Actually let's use the scp recursive to target directory
		// scp -r dist/* target:path is glob expansion which shell handles
		// simpler: scp -r dist target:frontend
		// but target:frontend must not exist for it to become frontend? or if it exists it becomes frontend/dist

		// clean approach:
		// 1. remove remote frontend dir
		// 2. scp -r local/dist remote:~/.mlcremote/frontend
		if out, err := exec.Command("scp", scpDistArgs...).CombinedOutput(); err != nil {
			// ignore error? no, this is important
			fmt.Printf("warning: frontend upload failed: %s\n", string(out))
		}
	}

	// 4. Create and upload run-server.sh wrapper
	runScriptContent := `#!/usr/bin/env bash
set -euo pipefail
# ensure we start in the user's home so any relative paths the server relies on work
cd "$HOME"
# Exec binary with default port 8443 and static dir
# We use --no-auth because the connection is already secured via SSH tunnel
exec "$HOME/.mlcremote/bin/dev-server" --port 8443 --root "$HOME" --static-dir "$HOME/.mlcremote/frontend" --no-auth
`
	runScriptFile := "run-server.sh"
	_ = ioutil.WriteFile(runScriptFile, []byte(runScriptContent), 0755)
	defer os.Remove(runScriptFile)

	scpRunArgs := append([]string{}, scpArgs...)
	scpRunArgs = append(scpRunArgs, runScriptFile, fmt.Sprintf("%s:~/.mlcremote/run-server.sh", target))

	if out, err := exec.Command("scp", scpRunArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("scp run-script failed: %s", string(out))
	}

	// Make script executable
	chmodArgs := append([]string{}, sshBaseArgs...)
	chmodArgs = append(chmodArgs, target, "chmod +x ~/.mlcremote/run-server.sh ~/.mlcremote/bin/dev-server")
	_ = exec.Command("ssh", chmodArgs...).Run()

	// 5. Create and upload systemd service file
	serviceContent := `[Unit]
Description=mlcremote user service
After=network.target

[Service]
Type=simple
ExecStart=%h/.mlcremote/run-server.sh
Restart=on-failure

[Install]
WantedBy=default.target
`
	serviceFile := "mlcremote.service"
	_ = ioutil.WriteFile(serviceFile, []byte(serviceContent), 0644)
	defer os.Remove(serviceFile)

	scpServiceArgs := append([]string{}, scpArgs...)
	scpServiceArgs = append(scpServiceArgs, serviceFile, fmt.Sprintf("%s:~/.config/systemd/user/mlcremote.service", target))

	if out, err := exec.Command("scp", scpServiceArgs...).CombinedOutput(); err != nil {
		return "service-upload-failed", fmt.Errorf("failed to upload service file: %s", string(out))
	}

	// 6. Enable and start service
	startServiceArgs := append([]string{}, sshBaseArgs...)
	startServiceArgs = append(startServiceArgs, target, "systemctl --user daemon-reload && systemctl --user enable --now mlcremote.service")

	if out, err := exec.Command("ssh", startServiceArgs...).CombinedOutput(); err != nil {
		return "start-failed", fmt.Errorf("failed to start service: %s", string(out))
	}

	return "installed", nil
}
