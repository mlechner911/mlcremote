package main

import (
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

// App is a minimal application placeholder.
type App struct{}

// startup runs when the app starts.
func (a *App) startup() {}

func main() {
	a := &App{}
	err := wails.Run(&options.App{
		Title:  "Light Dev",
		Width:  1024,
		Height: 768,
		OnStartup: func() { a.startup() },
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
