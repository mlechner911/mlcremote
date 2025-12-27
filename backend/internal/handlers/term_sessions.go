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

func (s *terminalSession) addConn(c *websocket.Conn) {
	sessionsMu.Lock()
	s.conns[c] = struct{}{}
	sessionsMu.Unlock()
}

func (s *terminalSession) removeConn(c *websocket.Conn) {
	sessionsMu.Lock()
	delete(s.conns, c)
	sessionsMu.Unlock()
}

func (s *terminalSession) write(data []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, _ = s.ptmx.Write(data)
}

func getSession(id string) *terminalSession {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	return sessions[id]
}

// generateSessionID returns a simple unique id. Replace with crypto secure id if needed.
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

// NewTerminalAPI creates a session and returns {id}
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
