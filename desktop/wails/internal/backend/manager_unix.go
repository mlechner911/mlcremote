//go:build !windows

package backend

import (
	"os/exec"
)

func configureSysProcAttr(cmd *exec.Cmd) {
	// No-op on non-Windows
}
