//go:build !windows

package ssh

import (
	"os/exec"
)

func configureSysProcAttr(cmd *exec.Cmd) {
	// No-op on non-Windows
}
