package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/wailsapp/wails/v2"
)

// App struct
type App struct{
	ctx context.Context
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

func main() {
	app := NewApp()

	// Create application with options
	err := wails.Run(&wails.Options{
		Title:  "MLCRemote Desktop Prototype",
		Width:  900,
		Height: 700,
		Bind: []interface{}{
			app,
		},
		OnStartup: app.startup,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
