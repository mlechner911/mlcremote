package app

import (
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"sync"
	"time"
)

// App struct
type App struct {
	ctx         context.Context
	tunnelMu    sync.Mutex
	tunnelCmd   *exec.Cmd
	tunnelState string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// Startup is called at application startup
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// Shutdown is called at application termination
func (a *App) Shutdown(ctx context.Context) {
	a.tunnelMu.Lock()
	defer a.tunnelMu.Unlock()
	if a.tunnelCmd != nil && a.tunnelCmd.Process != nil {
		_ = a.tunnelCmd.Process.Kill()
	}
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
