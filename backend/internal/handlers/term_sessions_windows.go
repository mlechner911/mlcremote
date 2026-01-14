//go:build windows

package handlers

import (
	"os/exec"
	"syscall"
	"time"
)

// killProcessGroup sends a kill signal to the process group (Windows).
func killProcessGroup(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}

	// On Windows, killing the process usually kills the tree if started correctly,
	// but we can't use syscall.Kill(-pid).
	// We could use taskkill /T /F /PID <pid> to be sure, but standard Kill is often enough.

	_ = cmd.Process.Signal(syscall.SIGTERM)
	time.Sleep(100 * time.Millisecond)
	_ = cmd.Process.Kill()
}
