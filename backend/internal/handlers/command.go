package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"lightdev/internal/watcher"
)

// CommandRequest represents a generic command sent from the remote.
type CommandRequest struct {
	Command string                 `json:"command"`
	Args    map[string]interface{} `json:"args"`
}

// SendCommandHandler handles generic remote commands.
// It broadcasts a "remote_command" event to all connected clients.
func SendCommandHandler(w *watcher.Service, root string) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(rw, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req CommandRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(rw, "invalid json", http.StatusBadRequest)
			return
		}

		log.Printf("[Command] Received remote command: %s, args: %v", req.Command, req.Args)

		// Broadcast event
		if w != nil {
			w.Broadcast(watcher.Event{
				Type:    watcher.EventType("remote_command"),
				Path:    req.Command,
				Payload: req.Args,
			})
		}

		rw.WriteHeader(http.StatusOK)
	}
}
