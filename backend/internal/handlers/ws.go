// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/websocket"

	"lightdev/internal/util"
	termutil "lightdev/internal/util/terminal"
)

// WsTerminalHandler upgrades the HTTP connection to a WebSocket and bridges
// data between the websocket and either an ephemeral PTY or an existing session.
// @Summary Connect to terminal WebSocket
// @Description Upgrade to WebSocket for terminal I/O.
// @ID connectTerminalWS
// @Tags terminal
// @Security TokenAuth
// @Param id query string false "Session ID"
// @Param token query string false "Auth token"
// @Success 101
// @Router /ws/terminal [get]
// @Router /ws/terminal [get]
// @Router /ws/terminal [get]
func WsTerminalHandler(root string, debug bool, serverPort *int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if debug {
			log.Printf("HANDLER: WsTerminalHandler called. Session=%s", r.URL.Query().Get("session"))
		}
		up := websocket.Upgrader{
			ReadBufferSize:  8192,
			WriteBufferSize: 8192,
			CheckOrigin:     func(r *http.Request) bool { return true },
		}
		conn, err := up.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, "upgrade failed", http.StatusBadRequest)
			return
		}
		defer conn.Close()

		// Support attaching to an existing session via ?session=<id>
		sessionID := r.URL.Query().Get("session")
		if sessionID == "" {
			// ephemeral PTY for this connection
			shell := os.Getenv("SHELL")
			if shell == "" {
				shell = "/bin/bash"
			}
			// validate requested shell from query and use helper with fallbacks
			reqShell := r.URL.Query().Get("shell")
			if rs := termutil.ResolveRequestedShell(reqShell); rs != "" {
				shell = rs
			}
			cwd := r.URL.Query().Get("cwd")
			// sanitize cwd against provided root; if it is a file, use its parent
			if cwd != "" {
				if p, err := util.SanitizePath(root, cwd); err == nil {
					if fi, err := os.Stat(p); err == nil {
						if fi.IsDir() {
							cwd = p
						} else {
							cwd = filepath.Dir(p)
						}
					} else {
						log.Printf("WsTerminalHandler: sanitized cwd stat failed: %v", err)
						cwd = ""
					}
				} else {
					log.Printf("WsTerminalHandler: sanitize cwd failed: %v", err)
					cwd = ""
				}
			}
			token := r.Header.Get("X-Auth-Token")
			if token == "" {
				token = r.URL.Query().Get("token")
			}
			env := buildSessionEnv(r, token, serverPort)

			log.Printf("WsTerminalHandler: creating session with env: %v", env)

			// create a tracked terminal session so ShutdownAllSessions can close it
			s, err := newTerminalSession(shell, cwd, env)
			if err != nil {
				log.Printf("failed to start shell for ephemeral ws: %v", err)
				_ = conn.WriteMessage(websocket.TextMessage, []byte("failed to start shell: "+err.Error()))
				return
			}
			// attach this websocket to the session
			s.addConn(conn)
			log.Printf("ws: attached conn %p to session %s", conn, s.id)
			WriteAuditLog("Terminal Session Connected (Ephemeral, shell=%s) from %s", shell, r.RemoteAddr)

			defer func() {
				s.removeConn(conn)
				log.Printf("ws: detached conn %p from session %s", conn, s.id)
				// close session (terminates child) when this ephemeral connection ends
				s.close()
				// remove from sessions map
				sessionsMu.Lock()
				delete(sessions, s.id)
				sessionsMu.Unlock()
				WriteAuditLog("Terminal Session Disconnected (Ephemeral) from %s", r.RemoteAddr)
			}()

			// WS -> PTY (write into session's PTY). Support resize JSON messages.
			// this needs clean up for too small screen size..
			for {
				mt, data, err := conn.ReadMessage()
				if err != nil {
					break
				}
				if mt == websocket.TextMessage {
					var msg struct {
						Type string `json:"type"`
						Cols int    `json:"cols"`
						Rows int    `json:"rows"`
					}
					if err := json.Unmarshal(data, &msg); err == nil && msg.Type == "resize" && msg.Cols > 0 && msg.Rows > 0 {
						_ = s.resize(msg.Cols, msg.Rows)
						continue
					}
				}
				if mt == websocket.TextMessage || mt == websocket.BinaryMessage {
					// Debug log for input troubleshooting
					if len(data) > 0 && debug {
						log.Printf("WsTerminalHandler [ephemeral]: received %d bytes from WS: %q", len(data), string(data))
					}
					s.write(data)
				}
			}
			return
		}

		// attach to existing persistent session
		s := getSession(sessionID)
		if s == nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("session not found"))
			return
		}

		s.addConn(conn)
		WriteAuditLog("Terminal Session Attached (Persistent, id=%s) from %s", sessionID, r.RemoteAddr)

		defer func() {
			s.removeConn(conn)
			// If this was the last connection attached to a persistent session,
			// close the session and remove it from the sessions map to avoid
			// leaving orphaned shells running after the client disconnects.
			sessionsMu.Lock()
			empty := len(s.conns) == 0
			sessionsMu.Unlock()
			if empty {
				s.close()
				sessionsMu.Lock()
				delete(sessions, s.id)
				sessionsMu.Unlock()
				WriteAuditLog("Terminal Session Closed (Persistent, id=%s) from %s", sessionID, r.RemoteAddr)
			} else {
				WriteAuditLog("Terminal Session Detached (Persistent, id=%s) from %s", sessionID, r.RemoteAddr)
			}
		}()

		// WS -> PTY (write into session's PTY). Support resize JSON messages.
		for {
			mt, data, err := conn.ReadMessage()
			if err != nil {
				break
			}
			if mt == websocket.TextMessage {
				var msg struct {
					Type string `json:"type"`
					Cols int    `json:"cols"`
					Rows int    `json:"rows"`
				}
				if err := json.Unmarshal(data, &msg); err == nil && msg.Type == "resize" && msg.Cols > 0 && msg.Rows > 0 {
					_ = s.resize(msg.Cols, msg.Rows)
					continue
				}
			}
			if mt == websocket.TextMessage || mt == websocket.BinaryMessage {
				// Debug log for input troubleshooting
				if len(data) > 0 && debug {
					log.Printf("WsTerminalHandler: received %d bytes from WS: %q", len(data), string(data))
				}
				s.write(data)
			}
		}
	}
}

// buildSessionEnv constructs the environment variables for a terminal session,
// including the auth token and the API URL.
// buildSessionEnv constructs the environment variables for a terminal session,
// including the auth token and the API URL.
func buildSessionEnv(r *http.Request, token string, serverPort *int) []string {
	var env []string
	if token != "" {
		env = append(env, "MLCREMOTE_TOKEN="+token)
	}

	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}

	var apiURL string
	if serverPort != nil && *serverPort > 0 {
		apiURL = fmt.Sprintf("%s://%s:%d", scheme, "127.0.0.1", *serverPort)
	} else {
		// Fallback if port is not available
		host := r.Host
		if host == "" {
			host = "127.0.0.1:8443" // unexpected fallback
		}
		apiURL = fmt.Sprintf("%s://%s", scheme, host)
	}

	env = append(env, "MLCREMOTE_API_URL="+apiURL)
	env = append(env, "MLCREMOTE_TEST=1") // Dummy var for debugging
	return env
}
