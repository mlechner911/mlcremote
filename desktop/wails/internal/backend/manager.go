package backend

import (
	"io/fs"
	"os/exec"
	"sync"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/remotesystem"
)

type cachedOS struct {
	OS   remotesystem.RemoteOS
	Arch remotesystem.RemoteArch
}

type Manager struct {
	payload fs.FS
	osCache map[string]cachedOS
	cacheMu sync.RWMutex
}

func NewManager(payload fs.FS) *Manager {
	return &Manager{
		payload: payload,
		osCache: make(map[string]cachedOS),
	}
}

func createSilentCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	remotesystem.ConfigureCmd(cmd)
	return cmd
}
