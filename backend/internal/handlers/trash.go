// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"lightdev/internal/util"
)

// TrashEntry records a file deletion event.
type TrashEntry struct {
	OriginalPath string    `json:"originalPath"`
	TrashPath    string    `json:"trashPath"`
	DeletedAt    time.Time `json:"deletedAt"`
}

var (
	trashMu       sync.Mutex
	recentTrashed []TrashEntry
)

// RecordTrash adds an entry to the in-memory trash log.
func RecordTrash(original, trash string) {
	trashMu.Lock()
	defer trashMu.Unlock()
	recentTrashed = append(recentTrashed, TrashEntry{
		OriginalPath: original,
		TrashPath:    trash,
		DeletedAt:    time.Now().UTC(),
	})
	// Keep only last 100 entries to avoid memory leak
	if len(recentTrashed) > 100 {
		recentTrashed = recentTrashed[len(recentTrashed)-100:]
	}
}

// RecentTrashHandler returns the list of recently deleted files (in-memory session log).
// @Summary Get recently deleted files
// @Description Returns a list of files deleted during the current session.
// @ID getRecentTrash
// @Tags trash
// @Security TokenAuth
// @Produce json
// @Success 200 {array} TrashEntry
// @Router /api/trash/recent [get]
func RecentTrashHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		trashMu.Lock()
		defer trashMu.Unlock()
		// Return copy or slice
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(recentTrashed)
	}
}

type RestoreRequest struct {
	TrashPath string `json:"trashPath"`
}

// RestoreTrashHandler restores a file from trash to its original location.
// @Summary Restore file from trash
// @Description Restores a file from trash history.
// @ID restoreTrash
// @Tags trash
// @Security TokenAuth
// @Accept json
// @Param body body RestoreRequest true "Trash path to restore"
// @Success 204
// @Failure 404 "Not found"
// @Failure 409 "Destination exists"
// @Router /api/trash/restore [post]
func RestoreTrashHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req RestoreRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		trashMu.Lock()
		defer trashMu.Unlock()

		// Find entry
		var entry *TrashEntry
		idx := -1
		for i, e := range recentTrashed {
			if e.TrashPath == req.TrashPath {
				entry = &e
				idx = i
				break
			}
		}

		if entry == nil {
			http.Error(w, "trash entry not found in history", http.StatusNotFound)
			return
		}

		// Calculate destination
		dest, err := util.SanitizePath(root, entry.OriginalPath)
		if err != nil {
			http.Error(w, "invalid destination path", http.StatusBadRequest)
			return
		}

		// Check collision
		if _, err := os.Stat(dest); err == nil {
			http.Error(w, "destination already exists", http.StatusConflict)
			return
		}

		// Ensure parent dir exists
		if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
			http.Error(w, "mkdir failed", http.StatusInternalServerError)
			return
		}

		// Move back
		if err := os.Rename(entry.TrashPath, dest); err != nil {
			// fallback copy
			in, err := os.Open(entry.TrashPath)
			if err != nil {
				http.Error(w, "restore failed (open)", http.StatusInternalServerError)
				return
			}
			defer in.Close()
			out, err := os.Create(dest)
			if err != nil {
				http.Error(w, "restore failed (create)", http.StatusInternalServerError)
				return
			}
			defer out.Close()
			if _, err := io.Copy(out, in); err != nil {
				http.Error(w, "restore failed (copy)", http.StatusInternalServerError)
				return
			}
			_ = os.Remove(entry.TrashPath)
		}

		// Remove from history
		recentTrashed = append(recentTrashed[:idx], recentTrashed[idx+1:]...)

		w.WriteHeader(http.StatusNoContent)
	}
}

// EmptyTrashHandler permanently deletes all files in the trash directory.
// @Summary Empty trash
// @Description Permanently delete all files in trash.
// @ID emptyTrash
// @Tags trash
// @Security TokenAuth
// @Success 204
// @Failure 403 "Deletion disabled"
// @Router /api/trash [delete]
func EmptyTrashHandler(trashDir string, allowDelete bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !allowDelete {
			http.Error(w, "deletion is disabled", http.StatusForbidden)
			return
		}
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Clear in-memory history since backing files are gone
		trashMu.Lock()
		recentTrashed = []TrashEntry{}
		trashMu.Unlock()

		// Remove all contents of trashDir
		// We remove the dir itself and recreate it to be clean
		if err := os.RemoveAll(trashDir); err != nil {
			http.Error(w, "failed to empty trash", http.StatusInternalServerError)
			return
		}
		if err := os.MkdirAll(trashDir, 0755); err != nil {
			http.Error(w, "failed to recreate trash dir", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
