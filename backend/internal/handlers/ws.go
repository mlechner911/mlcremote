package handlers

import (
	"net/http"
	"os"
	"os/exec"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

// WsTerminalHandler upgrades to WebSocket and bridges data to a PTY shell.
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

		shell := os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/bash"
		}
		cmd := exec.Command(shell)
		ptmx, err := pty.Start(cmd)
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("failed to start shell"))
			return
		}
		defer func() { _ = ptmx.Close() }()

		done := make(chan struct{})

		// PTY -> WS
		go func() {
			buf := make([]byte, 4096)
			for {
				n, err := ptmx.Read(buf)
				if n > 0 {
					_ = conn.WriteMessage(websocket.BinaryMessage, buf[:n])
				}
				if err != nil {
					break
				}
			}
			close(done)
		}()

		// WS -> PTY
		for {
			mt, data, err := conn.ReadMessage()
			if err != nil {
				break
			}
			if mt == websocket.TextMessage || mt == websocket.BinaryMessage {
				_, _ = ptmx.Write(data)
			}
		}

		<-done
	}
}
