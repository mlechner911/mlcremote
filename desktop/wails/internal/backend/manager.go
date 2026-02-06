package backend

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os/exec"
	"sync"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/config"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/remotesystem"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
)

type cachedOS struct {
	OS   remotesystem.RemoteOS
	Arch remotesystem.RemoteArch
}

type Manager struct {
	payload fs.FS
	SSH     *ssh.Manager
	osCache map[string]cachedOS
	cacheMu sync.RWMutex
}

func NewManager(payload fs.FS, sshMgr *ssh.Manager) *Manager {
	return &Manager{
		payload: payload,
		SSH:     sshMgr,
		osCache: make(map[string]cachedOS),
	}
}

func createSilentCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	remotesystem.ConfigureCmd(cmd)
	return cmd
}

func (m *Manager) runSSH(profileJSON string, cmd string) (string, error) {
	var p config.ConnectionProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "", fmt.Errorf("invalid profile: %w", err)
	}
	port := p.Port
	if port == 0 {
		port = 22
	}
	return m.SSH.RunCommand(p.Host, p.User, port, p.Password, p.IdentityFile, p.Passphrase, cmd)
}

func (m *Manager) uploadSSH(profileJSON string, localPath, remotePath, mode string) error {
	var p config.ConnectionProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return fmt.Errorf("invalid profile: %w", err)
	}
	port := p.Port
	if port == 0 {
		port = 22
	}
	return m.SSH.UploadFile(p.Host, p.User, port, p.Password, p.IdentityFile, p.Passphrase, localPath, remotePath, mode)
}
