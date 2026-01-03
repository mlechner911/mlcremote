package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/app"
)

//go:embed all:frontend/dist
//go:embed all:assets/payload
var assets embed.FS

func main() {
	// Create an instance of the app structure
	application := app.NewApp(assets)

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "MLCRemote Desktop",
		Width:  900,
		Height: 700,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Bind: []interface{}{
			application,
		},
		OnStartup:     application.Startup,
		OnShutdown:    application.Shutdown,
		OnBeforeClose: application.BeforeClose,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
