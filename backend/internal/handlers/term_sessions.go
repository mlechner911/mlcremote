// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"

	"lightdev/internal/util"
)


var allowedShells = []string{"bash", "sh", "zsh"}

// resolveRequestedShell validates a requested shell from the client.
// If the client provided an absolute path we check it exists and return it.
// For simple basenames we only allow a small whitelist and resolve via PATH,
// returning the resolved absolute executable path when found.
func resolveRequestedShell(req string) string {
	if req == "" {
		return ""
	}
	// reject obviously malicious input
	if strings.ContainsAny(req, " \t\n") {
		return ""
	}
	// if it's an absolute path, accept only if the file exists and is executable
	if filepath.IsAbs(req) {
		if fi, err := os.Stat(req); err == nil {
			if fi.Mode().IsRegular() && fi.Mode().Perm()&0111 != 0 {
				return req
			}
		}
		return ""
	}
	// basename: only allow whitelisted names, and resolve via PATH
	for _, a := range allowedShells {
		if req == a {
			if p, err := exec.LookPath(req); err == nil {
				return p
			}
			return ""
		}
	}
	return ""
}

// terminalSession represents a server-side PTY and its attached websocket connections.
type terminalSession struct {
	id    string
	ptmx  *os.File
	cmd   *exec.Cmd
	mu    sync.Mutex
	conns map[*websocket.Conn]struct{}
}

var (
	sessionsMu sync.Mutex
	sessions   = map[string]*terminalSession{}
)

// newTerminalSession starts a PTY running the given shell and registers it.
func newTerminalSession(shell string, cwd string) (*terminalSession, error) {
	if shell == "" {
		shell = os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/bash"
		}
	}
	ptmx, cmd, err := startShellPTY(shell, cwd)
	if err != nil {
		return nil, err
	}
	s := &terminalSession{
		id:    generateSessionID(),
		ptmx:  ptmx,
		cmd:   cmd,
		conns: make(map[*websocket.Conn]struct{}),
	}
	// start reader from PTY to broadcast to connections
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				sessionsMu.Lock()
				for c := range s.conns {
					_ = c.WriteMessage(websocket.BinaryMessage, buf[:n])
				}
				sessionsMu.Unlock()
			}
			if err != nil {
				break
			}
		}
		// cleanup: remove session and close connections
		s.close()
		sessionsMu.Lock()
		delete(sessions, s.id)
		sessionsMu.Unlock()
	}()
	sessionsMu.Lock()
	sessions[s.id] = s
	sessionsMu.Unlock()
	if s.cmd != nil && s.cmd.Process != nil {
		log.Printf("terminal: new session registered id=%s pid=%d shell=%s cwd=%s", s.id, s.cmd.Process.Pid, shell, cwd)
	} else {
		log.Printf("terminal: new session registered id=%s shell=%s cwd=%s", s.id, shell, cwd)
	}
	return s, nil
}

// startShellPTY attempts to start a PTY running the requested shell. It will try
// a sequence of sensible fallbacks if the primary `shell` fails.
func startShellPTY(shell, cwd string) (*os.File, *exec.Cmd, error) {
	// build candidate commands. If `shell` is provided and resolves to an
	// executable path (or absolute path), try it first. Then try sensible
	// fallbacks.
	candidates := [][]string{}
	if shell != "" {
		// if the client provided something like "env bash", keep as-is
		if strings.HasPrefix(shell, "env ") {
			parts := strings.Fields(shell)
			if len(parts) > 1 {
				candidates = append(candidates, parts)
			}
		} else {
			candidates = append(candidates, []string{shell})
		}
	}
	// common fallbacks (try absolute paths first, then names resolved via PATH)
	candidates = append(candidates, []string{"/bin/bash"})
	candidates = append(candidates, []string{"/usr/bin/bash"})
	candidates = append(candidates, []string{"bash"})
	candidates = append(candidates, []string{"zsh"})
	candidates = append(candidates, []string{"/bin/sh"})
	candidates = append(candidates, []string{"env", "bash"})

	var lastErr error
	tried := map[string]struct{}{}
	for _, parts := range candidates {
		// resolve executable path for single-arg candidates that are not absolute
		var exe string
		var args []string
		if len(parts) == 1 {
			exe = parts[0]
			args = []string{}
			// if it's an absolute path, check it exists and is executable
			if filepath.IsAbs(exe) {
				if fi, err := os.Stat(exe); err != nil || !fi.Mode().IsRegular() || fi.Mode().Perm()&0111 == 0 {
					log.Printf("startShellPTY: candidate %s not present or not executable: %v", exe, err)
					lastErr = err
					continue
				}
			} else {
				// try to resolve via PATH
				if p, err := exec.LookPath(exe); err == nil {
					exe = p
				} else {
					log.Printf("startShellPTY: candidate %s not found in PATH", parts[0])
					lastErr = err
					continue
				}
			}
		} else {
			exe = parts[0]
			args = parts[1:]
			// try to resolve exe via PATH if not absolute
			if !filepath.IsAbs(exe) {
				if p, err := exec.LookPath(exe); err == nil {
					exe = p
				} else {
					log.Printf("startShellPTY: candidate %s not found in PATH", parts[0])
					lastErr = err
					continue
				}
			} else {
				if fi, err := os.Stat(exe); err != nil {
					log.Printf("startShellPTY: candidate %s not present: %v", exe, err)
					lastErr = err
					continue
				} else {
					// if the file exists but exec fails later, this may indicate a
					// missing interpreter (e.g. ELF interpreter) or incompatible binary.
					_ = fi
				}
			}
		}

		// skip duplicate attempts for the same resolved executable+args
		key := exe + " " + strings.Join(args, " ")
		if _, ok := tried[key]; ok {
			continue
		}
		tried[key] = struct{}{}

		cmd := exec.Command(exe, args...)
		// If a working directory was provided, ensure it exists and is a directory
		// before assigning it to the command. Setting cmd.Dir to a non-directory
		// can cause the exec to fail with misleading ENOENT errors.
		if cwd != "" {
			if fi, err := os.Stat(cwd); err == nil {
				if fi.IsDir() {
					cmd.Dir = cwd
				} else {
					log.Printf("startShellPTY: provided cwd is not a directory, skipping: %s", cwd)
				}
			} else {
				log.Printf("startShellPTY: provided cwd does not exist, skipping: %s (%v)", cwd, err)
			}
		}
		// attempt to start the PTY; if it fails and the executable is absolute
		// we add extra diagnostics to help identify cases like missing ELF
		// interpreter (ENOEXEC) or dynamic loader issues that present as
		// "no such file or directory" despite the file being present.
		ptmx, err := pty.Start(cmd)
		if err == nil {
			log.Printf("startShellPTY: started shell '%s' (args='%v')", exe, args)
			return ptmx, cmd, nil
		}
		lastErr = err
		// if the file existed but exec failed, add diagnostic hint
		if filepath.IsAbs(exe) {
			if fi, statErr := os.Stat(exe); statErr == nil {
				// Print the mode so we can confirm exec perms; also inspect the
				// underlying error to provide more actionable info.
				log.Printf("startShellPTY: attempt '%v' failed:'%v' (file exists, mode='%v')", append([]string{exe}, args...), err, fi.Mode())
				// Try to extract syscall.Errno if present to check for ENOEXEC/ENOENT
				if perr, ok := err.(*os.PathError); ok {
					if errno, ok := perr.Err.(syscall.Errno); ok {
						switch errno {
						case syscall.ENOEXEC:
							log.Printf("startShellPTY: exec failed with ENOEXEC for %s — file is not a valid executable or has an invalid interpreter", exe)
						case syscall.ENOENT:
							log.Printf("startShellPTY: exec failed with ENOENT for %s — interpreter or loader may be missing", exe)
						default:
							log.Printf("startShellPTY: exec syscall errno=%v", errno)
						}
					}
				}
				// If the binary is an ELF dynamically linked executable but the
				// dynamic loader is missing, the kernel returns ENOENT. We can
				// attempt to read the first bytes to detect ELF or a shebang.
				f, err2 := os.Open(exe)
				if err2 == nil {
					hdr := make([]byte, 4)
					if _, err3 := f.Read(hdr); err3 == nil {
						if string(hdr) == "\x7fELF" {
							log.Printf("startShellPTY: %s appears to be an ELF binary — missing interpreter/loader may cause ENOENT", exe)
						} else if hdr[0] == '#' && hdr[1] == '!' {
							log.Printf("startShellPTY: %s is a script with shebang — interpreter in shebang may be missing", exe)
						} else {
							log.Printf("startShellPTY: %s header: %v", exe, hdr)
						}
					}
					_ = f.Close()
				}

			} else {
				log.Printf("startShellPTY: attempt '%v' failed: '%v'", append([]string{exe}, args...), err)
			}
		} else {
			log.Printf("startShellPTY: attempt '%v' failed: '%v'", append([]string{exe}, args...), err)
		}
	}
	return nil, nil, lastErr
}

// addConn attaches a websocket connection to the session for broadcasting.
func (s *terminalSession) addConn(c *websocket.Conn) {
	sessionsMu.Lock()
	s.conns[c] = struct{}{}
	sessionsMu.Unlock()
	log.Printf("terminal: session %s - connection attached (conn=%p)", s.id, c)
}

// removeConn detaches a websocket connection from the session.
func (s *terminalSession) removeConn(c *websocket.Conn) {
	sessionsMu.Lock()
	delete(s.conns, c)
	sessionsMu.Unlock()
	log.Printf("terminal: session %s - connection detached (conn=%p)", s.id, c)
}

// write writes bytes into the PTY backing the session. a nmutex is used to serialize writes.
func (s *terminalSession) write(data []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, _ = s.ptmx.Write(data)
}

// resize updates the PTY window size for the session.
func (s *terminalSession) resize(cols, rows int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return pty.Setsize(s.ptmx, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
}

// close cleanly shuts down the session by closing all websockets and the PTY.
func (s *terminalSession) close() {
	sessionsMu.Lock()
	for c := range s.conns {
		_ = c.Close()
		delete(s.conns, c)
	}
	sessionsMu.Unlock()
	// attempt to close PTY
	_ = s.ptmx.Close()
	// attempt to terminate the child process
	if s.cmd != nil && s.cmd.Process != nil {
		pid := s.cmd.Process.Pid
		log.Printf("terminal: closing session id=%s pid=%d", s.id, pid)
		_ = s.cmd.Process.Signal(syscall.SIGTERM)
		// give it a short moment to exit gracefully
		time.Sleep(100 * time.Millisecond)
		_ = s.cmd.Process.Kill()
	}
}

// getSession returns a registered session by id or nil.
func getSession(id string) *terminalSession {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	return sessions[id]
}

// generateSessionID returns a random hex id prefixed with 's'.
func generateSessionID() string {
	// generate a 16-byte random id and hex-encode it
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		// fallback to a naive counter-based id (should be rare)
		sessionsMu.Lock()
		id := "s" + strconv.Itoa(len(sessions)+1)
		sessionsMu.Unlock()
		return id
	}
	return "s" + hex.EncodeToString(b)
}

// ShutdownAllSessions attempts to close all active terminal sessions and their
// associated PTYs/connections. It is safe to call multiple times.
func ShutdownAllSessions() {
	sessionsMu.Lock()
	// snapshot ids to avoid holding lock while closing
	ids := make([]string, 0, len(sessions))
	for id := range sessions {
		ids = append(ids, id)
	}
	sessionsMu.Unlock()

	if len(ids) == 0 {
		log.Printf("terminal: ShutdownAllSessions called — no active sessions")
		return
	}

	log.Printf("terminal: ShutdownAllSessions called — closing %d sessions", len(ids))
	for _, id := range ids {
		sessionsMu.Lock()
		s, ok := sessions[id]
		sessionsMu.Unlock()
		if !ok {
			continue
		}
		if s.cmd != nil && s.cmd.Process != nil {
			log.Printf("terminal: shutting session id=%s pid=%d", s.id, s.cmd.Process.Pid)
		} else {
			log.Printf("terminal: shutting session id=%s (no pid)", s.id)
		}
		s.close()
		sessionsMu.Lock()
		delete(sessions, id)
		sessionsMu.Unlock()
	}
}

// NewTerminalAPI creates a session and returns {"id": "..."} as JSON.
func NewTerminalAPI(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqShell := r.URL.Query().Get("shell")
		shell := resolveRequestedShell(reqShell)
		cwd := r.URL.Query().Get("cwd")
		// If a cwd was provided, try to resolve it against the server root.
		// If it points to a file, use the parent directory. If sanitization
		// fails, clear cwd and let startShellPTY fall back to defaults.
		if cwd != "" {
			if p, err := util.SanitizePath(root, cwd); err == nil {
				if fi, err := os.Stat(p); err == nil {
					if fi.IsDir() {
						cwd = p
					} else {
						cwd = filepath.Dir(p)
					}
				} else {
					log.Printf("NewTerminalAPI: sanitized path stat failed: %v", err)
					cwd = ""
				}
			} else {
				log.Printf("NewTerminalAPI: sanitize cwd failed: %v", err)
				cwd = ""
			}
		}
		s, err := newTerminalSession(shell, cwd)
		if err != nil {
			log.Printf("failed to start session (shell=%s cwd=%s): %v", shell, cwd, err)
			http.Error(w, "failed to start session: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"id": s.id})
	}
}
