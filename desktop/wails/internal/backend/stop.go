package backend

import (
	"encoding/json"
	"fmt"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
)

// StopBackend kills the remote dev-server process using the stored PID
func (m *Manager) StopBackend(profileJSON string) (string, error) {
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "", fmt.Errorf("invalid profile JSON: %w", err)
	}

	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	// Kill command:
	// Linux/Mac: kill $(cat .mlcremote/pid)
	// Windows: PowerShell Stop-Process
	// We chain them to support cross-platform without upfront OS detection.
	// Note: We use .mlcremote/pid for Linux and .mlcremote\pid for Windows (though PS handles / usually)

	cmd := "kill $(cat .mlcremote/pid) 2>/dev/null || " +
		"powershell -Command \"if (Test-Path .mlcremote\\pid) { Stop-Process -Id (Get-Content .mlcremote\\pid) -Force -ErrorAction SilentlyContinue }\" 2>NUL || " +
		"echo 'Failed to kill or process already dead'"

	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, cmd)

	out, err := createSilentCmd("ssh", cmdArgs...).CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return "stopped", nil
}
