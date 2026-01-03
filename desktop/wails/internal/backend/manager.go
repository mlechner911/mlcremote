package backend

import (
	"io/fs"
	"os/exec"
	"syscall"
)

type Manager struct {
	payload fs.FS
}

func NewManager(payload fs.FS) *Manager {
	return &Manager{
		payload: payload,
	}
}

// createSilentCmd works like exec.Command but hides the window on Windows.
func createSilentCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow: true,
	}
	return cmd
}
