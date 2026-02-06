//go:build windows

package handlers

import (
	"log"
	"os/exec"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v3/process"
)

// isBusySession returns true if the session has a foreground process running (Windows implementation).
func isBusySession(s *terminalSession) bool {
	if s.cmd == nil || s.cmd.Process == nil {
		return false
	}

	p, err := process.NewProcess(int32(s.cmd.Process.Pid))
	if err != nil {
		return false
	}

	children, err := p.Children()
	if err != nil {
		return false
	}

	// On Windows, if the shell has any child processes, we consider it busy.
	// This covers commands like 'vi', 'top' (via git bash), or long-running tasks.
	if len(children) > 0 {
		log.Printf("terminal: busy check session=%s pid=%d children_count=%d", s.id, s.cmd.Process.Pid, len(children))
		return true
	}

	return false
}

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
