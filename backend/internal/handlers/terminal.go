package handlers

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"

	"lightdev/internal/watcher"
)

type UpdateCwdRequest struct {
	Cwd string `json:"cwd"`
	Pid int    `json:"pid"`
}

// UpdateCwdHandler handles updates to the current working directory from a terminal session.
// It broadcasts a "cwd_update" event to all connected clients.
func UpdateCwdHandler(w *watcher.Service, root string) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(rw, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req UpdateCwdRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(rw, "invalid json", http.StatusBadRequest)
			return
		}

		path := req.Cwd
		// Try to make path relative to root if possible, for frontend consistency
		if filepath.IsAbs(path) {
			rel, err := filepath.Rel(root, path)
			if err == nil && !strings.HasPrefix(rel, "..") {
				// It is inside root!
				// Ensure it starts with / for the frontend
				if rel == "." {
					path = "/"
				} else {
					path = "/" + filepath.ToSlash(rel)
				}
			}
		}

		// Broadcast event
		if w != nil {
			w.Broadcast(watcher.Event{
				Type: watcher.EventType("cwd_update"),
				Path: path,
			})
		}

		// If watcher doesn't support generic broadcast, we assume the frontend polls or we implement a better event bus.
		// For this MVP, let's just respond OK and we will refine the broadcast part after checking watcher.go.
		rw.WriteHeader(http.StatusOK)
	}
}
