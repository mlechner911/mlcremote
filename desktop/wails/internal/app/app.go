package app

import (
	"context"
	"fmt"
	"io/fs"
	"net/http"
	"os/exec"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx         context.Context
	payload     fs.FS // Added payload field
	tunnelMu    sync.Mutex
	tunnelCmd   *exec.Cmd
	tunnelState string
}

// NewApp creates a new App application struct
func NewApp(payload fs.FS) *App {
	return &App{
		payload: payload,
	}
}

// Startup is called at application startup
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// Shutdown is called at application termination
// Shutdown is called at application termination
func (a *App) Shutdown(ctx context.Context) {
	a.cleanup()
}

// BeforeClose is called when the user tries to close the window
func (a *App) BeforeClose(ctx context.Context) (prevent bool) {
	a.tunnelMu.Lock()
	running := a.tunnelCmd != nil && a.tunnelCmd.Process != nil
	a.tunnelMu.Unlock()

	if running {
		runtime.EventsEmit(ctx, "shutdown-initiated")
		go func() {
			// Give UI a moment to show "Disconnecting..."
			time.Sleep(500 * time.Millisecond)
			a.cleanup()
			runtime.Quit(ctx)
		}()
		return true // Prevent immediate close
	}
	return false // Allow close
}

func (a *App) cleanup() {
	a.tunnelMu.Lock()
	defer a.tunnelMu.Unlock()
	if a.tunnelCmd != nil && a.tunnelCmd.Process != nil {
		fmt.Println("Gracefully stopping tunnel...")
		_ = a.tunnelCmd.Process.Kill()
		a.tunnelCmd = nil
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
