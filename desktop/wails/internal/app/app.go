package app

import (
	"context"
	"fmt"
	"io/fs"
	"net/http"
	"time"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/backend"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/config"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context

	// Services
	Config  *config.Manager
	SSH     *ssh.Manager
	Backend *backend.Manager
}

// NewApp creates a new App application struct
func NewApp(payload fs.FS) *App {
	return &App{
		Config:  config.NewManager(),
		SSH:     ssh.NewManager(),
		Backend: backend.NewManager(payload),
	}
}

// Startup is called at application startup
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	_, _ = a.Config.DeduplicateProfiles()
}

// Shutdown is called at application termination
// Shutdown is called at application termination
func (a *App) Shutdown(ctx context.Context) {
	a.cleanup()
}

// BeforeClose is called when the user tries to close the window
func (a *App) BeforeClose(ctx context.Context) (prevent bool) {
	status := a.SSH.TunnelStatus()
	running := status == "connected" || status == "starting"

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
	fmt.Println("Gracefully stopping tunnel...")
	_, _ = a.SSH.StopTunnel()
}

// DeduplicateProfiles removes entries with identical User, Host, Port
func (a *App) DeduplicateProfiles() (int, error) {
	return a.Config.DeduplicateProfiles()
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
