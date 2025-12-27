// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

// terminalSession represents a server-side PTY and its attached websocket connections.
type terminalSession struct {
	id    string
	ptmx  *os.File
	mu    sync.Mutex
	conns map[*websocket.Conn]struct{}
}

var (
	sessionsMu sync.Mutex
	sessions   = map[string]*terminalSession{}
)

// newTerminalSession starts a PTY running the given shell and registers it.
func newTerminalSession(shell string) (*terminalSession, error) {
	if shell == "" {
		shell = os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/bash"
		}
	}
	cmd := exec.Command(shell)
	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}
	s := &terminalSession{
		id:    generateSessionID(),
		ptmx:  ptmx,
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
		// cleanup
		sessionsMu.Lock()
		delete(sessions, s.id)
		sessionsMu.Unlock()
	}()
	sessionsMu.Lock()
	sessions[s.id] = s
	sessionsMu.Unlock()
	return s, nil
}

// addConn attaches a websocket connection to the session for broadcasting.
func (s *terminalSession) addConn(c *websocket.Conn) {
	sessionsMu.Lock()
	s.conns[c] = struct{}{}
	sessionsMu.Unlock()
}

// removeConn detaches a websocket connection from the session.
func (s *terminalSession) removeConn(c *websocket.Conn) {
	sessionsMu.Lock()
	delete(s.conns, c)
	sessionsMu.Unlock()
}

// write writes bytes into the PTY backing the session.
func (s *terminalSession) write(data []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, _ = s.ptmx.Write(data)
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
		id := "s" + string(len(sessions)+1)
		sessionsMu.Unlock()
		return id
	}
	return "s" + hex.EncodeToString(b)
}

// ShutdownAllSessions attempts to close all active terminal sessions and their
// associated PTYs/connections. It is safe to call multiple times.
func ShutdownAllSessions() {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	for id, s := range sessions {
		s.close()
		delete(sessions, id)
	}
}

// NewTerminalAPI creates a session and returns {"id": "..."} as JSON.
func NewTerminalAPI() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		shell := r.URL.Query().Get("shell")
		s, err := newTerminalSession(shell)
		if err != nil {
			http.Error(w, "failed to start session", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"id": s.id})
	}
}
