//go:build !windows

package handlers

import (
	"os/exec"
	"syscall"
	"time"
)

// killProcessGroup sends a kill signal to the process group (Unix).
func killProcessGroup(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}

	// Use negative PID to signal the Process Group
	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err == nil {
		// Try SIGTERM first
		_ = syscall.Kill(-pgid, syscall.SIGTERM)
		time.Sleep(50 * time.Millisecond)
		// Then force SIGKILL
		_ = syscall.Kill(-pgid, syscall.SIGKILL)
	} else {
		// Fallback if we can't get pgid
		_ = cmd.Process.Signal(syscall.SIGTERM)
		time.Sleep(100 * time.Millisecond)
		_ = cmd.Process.Kill()
	}
}
