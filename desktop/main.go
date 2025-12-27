package main

import (
	"context"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

// App is a minimal application placeholder.
type App struct{}

// startup runs when the app starts.
func (a *App) startup() {}

func main() {
	a := &App{}
	app := wails.CreateApp(&options.App{
		Title:  "MLCRemote",
		Width:  1024,
		Height: 768,
		OnStartup: func(ctx context.Context) { a.startup() },
	})
	if err := app.Run(); err != nil {
		println("Error:", err.Error())
	}
}
