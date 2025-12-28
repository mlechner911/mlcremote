package main

import (
	"bufio"
	"context"
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
	"sync"
	"syscall"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct{
	ctx context.Context
	tunnelMu sync.Mutex
	tunnelCmd *exec.Cmd
	tunnelState string
}

// TunnelProfile describes the fields for starting an SSH tunnel
type TunnelProfile struct {
	User string `json:"user"`
	Host string `json:"host"`
	LocalPort int `json:"localPort"`
	RemoteHost string `json:"remoteHost"`
	RemotePort int `json:"remotePort"`
	IdentityFile string `json:"identityFile"` // optional path to private key
	Password string `json:"password"`
	ExtraArgs []string `json:"extraArgs"` // additional ssh args
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
	a.tunnelState = "starting"

	// monitor process and emit navigate event when the forwarded service becomes reachable
	localURL := fmt.Sprintf("http://127.0.0.1:%d", p.LocalPort)
	go func() {
		// wait for process exit in background
		waitErrCh := make(chan error, 1)
		go func() { waitErrCh <- cmd.Wait() }()

		// poll health endpoint until reachable or process exits
		client := &http.Client{Timeout: 2 * time.Second}
		pollTicker := time.NewTicker(500 * time.Millisecond)
		defer pollTicker.Stop()
		timeout := time.After(15 * time.Second)
		for {
			select {
			case <-pollTicker.C:
				resp, err := client.Get(fmt.Sprintf("%s/health", localURL))
				if err == nil {
					resp.Body.Close()
					if resp.StatusCode == http.StatusOK {
						// service reachable — emit navigate event
						runtime.EventsEmit(a.ctx, "navigate", localURL)
						// update state to started
						a.tunnelMu.Lock()
						a.tunnelState = "started"
						a.tunnelMu.Unlock()
						return
					}
					// otherwise continue polling
				}
			case err := <-waitErrCh:
				// process exited before service became reachable
				_ = err
				a.tunnelMu.Lock()
				a.tunnelCmd = nil
				a.tunnelState = "stopped"
				a.tunnelMu.Unlock()
				return
			case <-timeout:
				// timed out waiting for service
				a.tunnelMu.Lock()
				a.tunnelState = "started" // ssh likely started but service not responding
				a.tunnelMu.Unlock()
				return
			}
		}
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
func (a *App) StopTunnel() (string, error) {
	a.tunnelMu.Lock()
	defer a.tunnelMu.Unlock()
	if a.tunnelCmd == nil {
		return "not-running", errors.New("no tunnel running")
	}
	// try graceful kill
	if err := a.tunnelCmd.Process.Signal(syscall.SIGTERM); err != nil {
		// fallback to kill
		_ = a.tunnelCmd.Process.Kill()
	}
	a.tunnelState = "stopping"
	return "stopping", nil
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

func main() {
	app := NewApp()

	// Check if a local frontend dist exists (useful when assets not embedded)
	distPath := "appfrontend/dist/index.html"
	var appOptions options.App
	appOptions = options.App{
		Title:  "MLCRemote Desktop Prototype",
		Width:  900,
		Height: 700,
		Bind: []interface{}{
			app,
		},
		OnStartup: app.startup,
	}
	if _, err := os.Stat(distPath); os.IsNotExist(err) {
		// If the dist index is missing on disk, provide a minimal fallback HTTP handler
		helloHTML := `<!doctype html>
<html><head><meta charset="utf-8"><title>MLCRemote</title></head><body>
<h1>MLCRemote Desktop</h1>
<p>This is the fallback Hello screen. Press Continue to try loading the app UI.</p>
<button onclick="location.reload()">Continue</button>
</body></html>`
		appOptions.Middleware = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(helloHTML))
		})
	}

	// Create application with options
	err := wails.Run(&appOptions)

	if err != nil {
		println("Error:", err.Error())
	}
}
