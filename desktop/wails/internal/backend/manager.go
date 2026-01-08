package backend

import (
	"io/fs"
	"os/exec"
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
	configureSysProcAttr(cmd)
	return cmd
}
