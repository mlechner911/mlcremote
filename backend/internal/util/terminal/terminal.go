package terminal

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/creack/pty"
)

var AllowedShells = []string{"bash", "sh", "zsh"}

// ResolveRequestedShell validates a requested shell string and returns an absolute
// executable path when possible. Empty string indicates invalid/unsupported.
func ResolveRequestedShell(req string) string {
	if req == "" {
		return ""
	}
	if strings.ContainsAny(req, " \t\n") {
		return ""
	}
	if filepath.IsAbs(req) {
		if fi, err := os.Stat(req); err == nil {
			if fi.Mode().IsRegular() && fi.Mode().Perm()&0111 != 0 {
				return req
			}
		}
		return ""
	}
	for _, a := range AllowedShells {
		if req == a {
			if p, err := exec.LookPath(req); err == nil {
				return p
			}
			return ""
		}
	}
	return ""
}

// ReadWriteCloser combines Reader, Writer and Closer.
type ReadWriteCloser interface {
	io.Reader
	io.Writer
	io.Closer
}

// StartShellPTY attempts to start a PTY running the requested shell with fallbacks.
// It returns the PTY file (as a ReadWriteCloser), the exec.Cmd, or an error.
func StartShellPTY(shell, cwd string) (io.ReadWriteCloser, *exec.Cmd, error) {
	candidates := [][]string{}
	// Windows prefers powershell/cmd
	if runtime.GOOS == "windows" {
		if shell != "" && !strings.Contains(shell, "bash") && !strings.Contains(shell, "zsh") {
			candidates = append(candidates, []string{shell})
		}
		// Force UTF-8 encoding for PowerShell
		utf8PsCmd := "$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding"
		candidates = append(candidates, []string{"powershell.exe", "-NoExit", "-Command", utf8PsCmd})
		candidates = append(candidates, []string{"pwsh.exe", "-NoExit", "-Command", utf8PsCmd})
		// Force UTF-8 for CMD
		candidates = append(candidates, []string{"cmd.exe", "/K", "chcp", "65001"})
	} else {
		if shell != "" {
			if strings.HasPrefix(shell, "env ") {
				parts := strings.Fields(shell)
				if len(parts) > 1 {
					candidates = append(candidates, parts)
				}
			} else {
				candidates = append(candidates, []string{shell})
			}
		}
		candidates = append(candidates, []string{"/bin/bash"})
		candidates = append(candidates, []string{"/usr/bin/bash"})
		candidates = append(candidates, []string{"bash"})
		candidates = append(candidates, []string{"zsh"})
		candidates = append(candidates, []string{"/bin/sh"})
		candidates = append(candidates, []string{"env", "bash"})
	}

	var lastErr error
	tried := map[string]struct{}{}
	for _, parts := range candidates {
		var exe string
		var args []string
		if len(parts) == 1 {
			exe = parts[0]
			args = []string{}
			if runtime.GOOS != "windows" && filepath.IsAbs(exe) {
				if fi, err := os.Stat(exe); err != nil || !fi.Mode().IsRegular() || fi.Mode().Perm()&0111 == 0 {
					lastErr = err
					continue
				}
			} else {
				if p, err := exec.LookPath(exe); err == nil {
					exe = p
				} else {
					lastErr = err
					continue
				}
			}
		} else {
			exe = parts[0]
			args = parts[1:]
			pathExe, err := exec.LookPath(exe)
			if err != nil {
				lastErr = err
				continue
			}
			exe = pathExe
		}

		key := exe + " " + strings.Join(args, " ")
		if _, ok := tried[key]; ok {
			continue
		}
		tried[key] = struct{}{}

		cmd := exec.Command(exe, args...)
		cmd.Env = append(os.Environ(), "TERM=xterm-256color")
		if cwd != "" {
			if fi, err := os.Stat(cwd); err == nil {
				if fi.IsDir() {
					cmd.Dir = cwd
				} else {
					log.Printf("StartShellPTY: provided cwd is not a directory, skipping: %s", cwd)
				}
			} else {
				log.Printf("StartShellPTY: provided cwd does not exist, skipping: %s (%v)", cwd, err)
			}
		}

		// Try PTY first
		ptmx, err := pty.Start(cmd)
		if err == nil {
			log.Printf("StartShellPTY: started shell '%s' (args='%v')", exe, args)
			return ptmx, cmd, nil
		}

		// If PTY fails on Windows (unsupported or otherwise), allow fallback to pipes
		if runtime.GOOS == "windows" {
			log.Printf("StartShellPTY: pty.Start failed for '%s': %v. Falling back to pipes.", exe, err)

			// dumb terminal fallback using pipes
			stdin, _ := cmd.StdinPipe()
			stdout, _ := cmd.StdoutPipe()
			stderr, _ := cmd.StderrPipe()

			if err := cmd.Start(); err != nil {
				lastErr = err
				log.Printf("StartShellPTY: cmd.Start failed fallback: %v", err)
				continue
			}

			// return a combiner
			return &cmdRW{
				stdin:  stdin,
				stdout: stdout,
				stderr: stderr,
			}, cmd, nil

		}

		lastErr = err
		log.Printf("StartShellPTY: attempt '%v' failed: '%v'", append([]string{exe}, args...), err)
	}
	return nil, nil, lastErr
}

// cmdRW implements io.ReadWriteCloser for a command using pipes
type cmdRW struct {
	stdin  io.WriteCloser
	stdout io.ReadCloser
	stderr io.ReadCloser
}

func (c *cmdRW) Read(p []byte) (n int, err error) {
	// read from stdout, maybe stderr? simpler to just read stdout for now
	return c.stdout.Read(p)
}
func (c *cmdRW) Write(p []byte) (n int, err error) {
	return c.stdin.Write(p)
}
func (c *cmdRW) Close() error {
	_ = c.stdin.Close()
	_ = c.stdout.Close()
	return c.stderr.Close()
}

// GenerateSessionID returns a random hex id prefixed with 's'.
func GenerateSessionID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return "s" + strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	return "s" + hex.EncodeToString(b)
}
