//go:build !windows

package handlers

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/shirou/gopsutil/v3/process"
)

// isBusySession returns true if the foreground process group is different from the shell's PID.
func isBusySession(s *terminalSession) bool {
	log.Printf("isBusySession (Unix): called for id=%s", s.id)
	if s == nil || s.tty == nil {
		return false
	}

	// 1. Try Linux /proc filesystem check first if available
	if s.cmd != nil && s.cmd.Process != nil {
		shellPid := s.cmd.Process.Pid
		tpgid, err := getTpgidFromProc(shellPid)
		if err == nil && tpgid > 0 {
			shellPgid, errPgid := syscall.Getpgid(shellPid)
			if errPgid == nil {
				if tpgid != shellPgid {
					log.Printf("isBusySession: id=%s busy via /proc check (tpgid=%d shellPgid=%d)", s.id, tpgid, shellPgid)
					return true
				}
			} else if tpgid != shellPid {
				log.Printf("isBusySession: id=%s busy via /proc check (tpgid=%d shellPid=%d)", s.id, tpgid, shellPid)
				return true
			}
		}
	}

	// 2. IOCTL fallback (TIOCGPGRP) - Useful for macOS/BSD or if /proc fails
	f, ok := s.tty.(*os.File)
	if ok {
		var fgPgid int32
		_, _, err := syscall.Syscall(syscall.SYS_IOCTL, f.Fd(), uintptr(syscall.TIOCGPGRP), uintptr(unsafe.Pointer(&fgPgid)))
		if err == 0 && fgPgid > 0 {
			if s.cmd != nil && s.cmd.Process != nil {
				shellPid := s.cmd.Process.Pid
				shellPgid, errPgid := syscall.Getpgid(shellPid)
				if errPgid == nil {
					if int(fgPgid) != shellPgid {
						log.Printf("isBusySession: id=%s busy via ioctl check (fgPgid=%d shellPgid=%d)", s.id, fgPgid, shellPgid)
						return true
					}
				} else if int(fgPgid) != shellPid {
					log.Printf("isBusySession: id=%s busy via ioctl check (fgPgid=%d shellPid=%d)", s.id, fgPgid, shellPid)
					return true
				}
			}
		}
	}

	// 3. Child process fallback (gopsutil) - Catch-all for non-synchronized PGIDs
	if s.cmd != nil && s.cmd.Process != nil {
		shellPid := s.cmd.Process.Pid
		p, errProc := process.NewProcess(int32(shellPid))
		if errProc == nil {
			children, _ := p.Children()
			if len(children) > 0 {
				log.Printf("isBusySession: id=%s busy via children check (count=%d)", s.id, len(children))
				return true
			}
		}
	}

	return false
}

// getTpgidFromProc reads the foreground process group ID from /proc/[pid]/stat (Linux specific).
func getTpgidFromProc(pid int) (int, error) {
	statPath := fmt.Sprintf("/proc/%d/stat", pid)
	data, err := os.ReadFile(statPath)
	if err != nil {
		return -1, err
	}

	// Format: pid (comm) state ppid pgrp session tty_nr tpgid ...
	sData := string(data)
	lastParen := strings.LastIndex(sData, ")")
	if lastParen == -1 {
		return -1, fmt.Errorf("invalid stat format")
	}
	afterParen := sData[lastParen+1:]
	fields := strings.Fields(afterParen)
	if len(fields) < 6 { // state(1), ppid(2), pgrp(3), session(4), tty_nr(5), tpgid(6)
		return -1, fmt.Errorf("too few fields")
	}

	return strconv.Atoi(fields[5])
}

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
