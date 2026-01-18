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
	"sync"
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
func StartShellPTY(shell, cwd string, extraEnv []string) (io.ReadWriteCloser, *exec.Cmd, error) {
	log.Printf("StartShellPTY: Requested shell='%s', cwd='%s'", shell, cwd)
	candidates := [][]string{}
	// Windows prefers powershell/cmd
	if runtime.GOOS == "windows" {
		if shell != "" {
			candidates = append(candidates, []string{shell})
		}
		// Force UTF-8 encoding for PowerShell
		utf8PsCmd := "$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding"
		candidates = append(candidates, []string{"powershell.exe", "-NoExit", "-Command", utf8PsCmd})
		candidates = append(candidates, []string{"pwsh.exe", "-NoExit", "-Command", utf8PsCmd})

		// Attempt to detect Git Bash
		gitBashPath := `C:\Program Files\Git\bin\bash.exe`
		if _, err := os.Stat(gitBashPath); err == nil {
			candidates = append(candidates, []string{gitBashPath, "--login", "-i"})
		}

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

	// 1. Try PTY for all candidates
	var lastErr error
	tried := map[string]struct{}{}
	for _, parts := range candidates {
		exe, args, err := resolveExeArgs(parts, cwd)
		if err != nil {
			lastErr = err
			continue
		}

		key := exe + " " + strings.Join(args, " ")
		if _, ok := tried[key]; ok {
			continue
		}
		tried[key] = struct{}{}

		cmd := exec.Command(exe, args...)
		cmd.Env = append(os.Environ(), "TERM=xterm-256color")
		if len(extraEnv) > 0 {
			log.Printf("StartShellPTY: Appending extraEnv: %v", extraEnv) // Added debug log
			cmd.Env = append(cmd.Env, extraEnv...)
		}
		// Log specific vars to verify presence in final env
		for _, e := range cmd.Env {
			if strings.Contains(e, "MLCREMOTE_API_URL") || strings.Contains(e, "MLCREMOTE_TOKEN") {
				log.Printf("StartShellPTY: Env contains: %s", e)
			}
		}
		if cwd != "" {
			cmd.Dir = cwd
		}

		ptmx, err := pty.Start(cmd)
		if err == nil {
			log.Printf("StartShellPTY: started shell '%s' (args='%v') via PTY", exe, args)
			return ptmx, cmd, nil
		}

		lastErr = err
		log.Printf("StartShellPTY: pty.Start failed for '%s': %v", exe, err)
	}

	// 2. Windows Fallback: Try Pipes on the first valid candidate
	if runtime.GOOS == "windows" {
		log.Printf("StartShellPTY: All PTY attempts failed. Falling back to pipes.")

		// Reset tried map or just pick the first candidate that resolves
		for _, parts := range candidates {
			exe, args, err := resolveExeArgs(parts, cwd)
			if err != nil {
				continue
			}

			log.Printf("StartShellPTY: Attempting pipe fallback for '%s'", exe)
			log.Printf("StartShellPTY: Attempting pipe fallback for '%s'", exe)
			cmd := exec.Command(exe, args...)
			cmd.Env = append(os.Environ(), "TERM=xterm-256color")
			if cwd != "" {
				cmd.Dir = cwd
			}

			stdin, err := cmd.StdinPipe()
			if err != nil {
				log.Printf("StartShellPTY: StdinPipe failed: %v", err)
				lastErr = err
				continue
			}
			stdout, err := cmd.StdoutPipe()
			if err != nil {
				log.Printf("StartShellPTY: StdoutPipe failed: %v", err)
				lastErr = err
				continue
			}
			stderr, err := cmd.StderrPipe()
			if err != nil {
				log.Printf("StartShellPTY: StderrPipe failed: %v", err)
				lastErr = err
				continue
			}

			if err := cmd.Start(); err != nil {
				log.Printf("StartShellPTY: pipe fallback start failed: %v", err)
				lastErr = err
				continue
			}

			// Create pipe to merge stdout/stderr
			pr, pw := io.Pipe()
			var wg sync.WaitGroup
			wg.Add(2)

			go func() {
				defer wg.Done()
				if _, err := io.Copy(pw, stdout); err != nil {
					log.Printf("Pipe copy stdout error: %v", err)
				}
			}()

			go func() {
				defer wg.Done()
				if _, err := io.Copy(pw, stderr); err != nil {
					log.Printf("Pipe copy stderr error: %v", err)
				}
			}()

			go func() {
				wg.Wait()
				pw.Close()
				log.Printf("Pipe writer closed for %s", exe)
			}()

			log.Printf("StartShellPTY: pipe fallback started successfully for '%s'", exe)

			// WAKE UP FIX: cmd.exe over pipes can be silent/buffered until input is received.
			// send a newline or 'ver' to force a prompt/output.
			if strings.Contains(strings.ToLower(exe), "cmd.exe") {
				log.Printf("StartShellPTY: Sending wake-up newline to cmd.exe")
				go func() {
					// Delay slightly to let process initialize
					time.Sleep(100 * time.Millisecond)
					_, _ = stdin.Write([]byte("\r\n"))
				}()
			}

			return &cmdRW{
				stdin: stdin,
				pr:    pr,
				pw:    pw,
				name:  exe,
			}, cmd, nil
		}
	}

	return nil, nil, lastErr
}

func resolveExeArgs(parts []string, cwd string) (string, []string, error) {
	if len(parts) == 0 {
		return "", nil, os.ErrInvalid
	}
	exe := parts[0]
	args := parts[1:]

	if len(parts) == 1 {
		if runtime.GOOS != "windows" && filepath.IsAbs(exe) {
			if fi, err := os.Stat(exe); err != nil || !fi.Mode().IsRegular() || fi.Mode().Perm()&0111 == 0 {
				return "", nil, err
			}
		} else {
			if p, err := exec.LookPath(exe); err == nil {
				exe = p
			} else {
				return "", nil, err
			}
		}
	} else {
		pathExe, err := exec.LookPath(exe)
		if err != nil {
			return "", nil, err
		}
		exe = pathExe
	}
	return exe, args, nil
}

// cmdRW implements io.ReadWriteCloser for a command using pipes, merging stdout and stderr
type cmdRW struct {
	stdin io.WriteCloser
	pr    *io.PipeReader
	pw    *io.PipeWriter
	name  string
}

func (c *cmdRW) Read(p []byte) (n int, err error) {
	n, err = c.pr.Read(p)
	if n > 0 {
		// Log first few bytes to debug responsiveness
		sample := string(p[:n])
		if len(sample) > 50 {
			sample = sample[:50] + "..."
		}
		// Avoid spamming logs, maybe only log once or on error?
		// For now, log everything to debug this specific issue.
		// log.Printf("cmdRW read %d bytes from %s: %q", n, c.name, sample)
	}
	if err != nil && err != io.EOF {
		log.Printf("cmdRW read error from %s: %v", c.name, err)
	}
	return n, err
}

func (c *cmdRW) Write(p []byte) (n int, err error) {
	// Normalize \r to \r\n for cmd.exe pipes
	// Xterm sends \r for Enter, but cmd.exe via pipe expects \r\n
	// We allocate a new buffer to avoid modifying p in place if needed
	var buf []byte
	for _, b := range p {
		if b == '\r' {
			buf = append(buf, '\r', '\n')
		} else {
			buf = append(buf, b)
		}
	}

	log.Printf("cmdRW writing %d bytes (swollen to %d) to %s", len(p), len(buf), c.name)

	// We must return the number of bytes from 'p' consumed, not the actual bytes written to pipe
	// otherwise the caller might think partial write occurred.
	// Since we handle the translation, we claim to have written all of p.

	// SOFTWARE ECHO: Since pipes don't echo, we must echo back to the user
	// so they see what they typed.
	// We write the *normalized* buffer so newlines appear correctly.
	go func() {
		// Write to the output pipe (pw) which the user reads from (pr)
		// Ignore errors as this is just visual feedback
		_, _ = c.pw.Write(buf)
	}()

	_, err = c.stdin.Write(buf)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

func (c *cmdRW) Close() error {
	_ = c.stdin.Close()
	_ = c.pw.Close()
	_ = c.pr.Close()
	return nil
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
