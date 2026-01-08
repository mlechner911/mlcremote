//go:build windows

package remotesystem

import (
	"os/exec"
	"syscall"
)

// ConfigureCmd applies platform-specific attributes to the command.
// On Windows, it hides the console window.
func ConfigureCmd(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
