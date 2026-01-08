package backend

import (
	"io/fs"
	"os/exec"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/remotesystem"
)

type Manager struct {
	payload fs.FS
}

func NewManager(payload fs.FS) *Manager {
	return &Manager{
		payload: payload,
	}
}

func createSilentCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	remotesystem.ConfigureCmd(cmd)
	return cmd
}
