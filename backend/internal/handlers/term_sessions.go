// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"encoding/json"
	"lightdev/internal/util"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"

	termutil "lightdev/internal/util/terminal"
)

// this holds websocc connections and PTY for a terminal session

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
	ptmx, cmd, err := termutil.StartShellPTY(shell, cwd)
	if err != nil {
		return nil, err
	}
	s := &terminalSession{
		id:    termutil.GenerateSessionID(),
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

// The heavy lifting for starting shells is provided by the util/terminal package.

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
// we kill the child process if still running after closing the PTY.
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

// Session id generation is handled by util/terminal.GenerateSessionID.

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
// @Summary Create terminal session
// @Description Creates a new PTY session.
// @ID createTerminalSession
// @Tags terminal
// @Security TokenAuth
// @Param shell query string false "Shell to use (bash, zsh)"
// @Param cwd query string false "Working directory"
// @Produce json
// @Success 200 {object} map[string]string
// @Router /api/terminal/new [post]
func NewTerminalAPI(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqShell := r.URL.Query().Get("shell")
		shell := termutil.ResolveRequestedShell(reqShell)
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
					log.Printf("[ERROR]  sanitized path stat failed: %v", err)
					cwd = ""
				}
			} else {
				log.Printf("[ERROR]  sanitize cwd failed: %v", err)
				cwd = ""
			}
		}
		s, err := newTerminalSession(shell, cwd)
		if err != nil {
			log.Printf("[ERROR] failed to start session (shell=%s cwd=%s): %v", shell, cwd, err)
			http.Error(w, "failed to start session: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"id": s.id})
	}
}
