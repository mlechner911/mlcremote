package main

import (
	"embed"
	"fmt"
	"os"
	"runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/app"
)

//go:embed all:frontend/dist
//go:embed all:assets/payload
var assets embed.FS

func main() {
	// Check for headless environment on Linux
	if runtime.GOOS == "linux" {
		display := os.Getenv("DISPLAY")
		waylandDisplay := os.Getenv("WAYLAND_DISPLAY")
		if display == "" && waylandDisplay == "" {
			fmt.Println("Error: No X Server or Wayland display detected.")
			fmt.Println("This application requires a graphical environment to run.")
			fmt.Println("If you are running this over SSH, try enabling X11 forwarding with 'ssh -X' or 'ssh -Y'.")
			fmt.Println("Alternatively, you can try running with a virtual framebuffer: 'xvfb-run task dev'")
			fmt.Println("If you meant to run the backend agent, use the 'dev-server' binary instead.")
			os.Exit(1)
		}
	}

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
