// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/websocket"

	"lightdev/internal/util"
)

// WsTerminalHandler upgrades the HTTP connection to a WebSocket and bridges
// data between the websocket and either an ephemeral PTY or an existing session.
func WsTerminalHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
			if rs := resolveRequestedShell(reqShell); rs != "" {
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
			// create a tracked terminal session so ShutdownAllSessions can close it
			s, err := newTerminalSession(shell, cwd)
			if err != nil {
				log.Printf("failed to start shell for ephemeral ws: %v", err)
				_ = conn.WriteMessage(websocket.TextMessage, []byte("failed to start shell: " + err.Error()))
				return
			}
			// attach this websocket to the session
			s.addConn(conn)
			log.Printf("ws: attached conn %p to session %s", conn, s.id)
			defer func() {
				s.removeConn(conn)
				log.Printf("ws: detached conn %p from session %s", conn, s.id)
				// close session (terminates child) when this ephemeral connection ends
				s.close()
				// remove from sessions map
				sessionsMu.Lock()
				delete(sessions, s.id)
				sessionsMu.Unlock()
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
		defer s.removeConn(conn)

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
				s.write(data)
			}
		}
	}
}
