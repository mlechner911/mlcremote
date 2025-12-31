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
	trashMu      sync.Mutex
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

type dirEntry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
}

// TreeHandler lists directory entries under the given path.
// @Summary List directory
// @Description Lists files and directories.
// @ID listDirectory
// @Tags file
// @Security TokenAuth
// @Param path query string false "Relative path"
// @Param showHidden query boolean false "Show hidden files"
// @Produce json
// @Success 200 {array} dirEntry
// @Router /api/tree [get]
func TreeHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fi, err := os.Stat(target)
		if err != nil {
			// if the file does not exist, record and block
			if os.IsNotExist(err) {
				util.RecordMissingAccess()
			}
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if !fi.IsDir() {
			http.Error(w, "not a directory", http.StatusBadRequest)
			return
		}
		f, err := os.Open(target)
		if err != nil {
			http.Error(w, "cannot open dir", http.StatusInternalServerError)
			return
		}
		defer f.Close()
		files, err := f.Readdir(0)
		if err != nil {
			http.Error(w, "cannot read dir", http.StatusInternalServerError)
			return
		}
		entries := make([]dirEntry, 0, len(files))
		// check whether client requested hidden files
		showHidden := false
		sh := r.URL.Query().Get("showHidden")
		if sh == "1" || sh == "true" || sh == "yes" {
			showHidden = true
		}
		rootAbs, _ := filepath.Abs(root)
		for _, e := range files {
			// skip hidden files (starting with '.') unless requested
			if !showHidden && len(e.Name()) > 0 && e.Name()[0] == '.' {
				continue
			}
			p := filepath.Join(target, e.Name())
			abs, _ := filepath.Abs(p)
			rel, _ := filepath.Rel(rootAbs, abs)
			entries = append(entries, dirEntry{
				Name:    e.Name(),
				Path:    "/" + rel,
				IsDir:   e.IsDir(),
				Size:    e.Size(),
				ModTime: e.ModTime(),
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(entries)
	}
}

// GetFileHandler streams the content of a file.
// @Summary Download file
// @Description Streams file content.
// @ID downloadFile
// @Tags file
// @Security TokenAuth
// @Param path query string true "File path"
// @Produce application/octet-stream
// @Success 200
// @Router /api/file [get]
func GetFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fi, err := os.Stat(target)
		if err != nil || fi.IsDir() {
			if err != nil && os.IsNotExist(err) {
				util.RecordMissingAccess()
			}
			http.Error(w, "not a file", http.StatusBadRequest)
			return
		}
		f, err := os.Open(target)
		if err != nil {
			http.Error(w, "cannot open file", http.StatusInternalServerError)
			return
		}
		defer f.Close()
		// detect content type from the first bytes
		buf := make([]byte, 4100)
		n, _ := f.Read(buf)
		mime := http.DetectContentType(buf[:n])
		w.Header().Set("Content-Type", mime)
		// rewind to start
		if _, err := f.Seek(0, 0); err == nil {
			_, _ = io.Copy(w, f)
		}
	}
}

// SaveRequest represents a POST /api/file body.
type SaveRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// PostFileHandler saves content to a file, creating it if needed.
// @Summary Save file
// @Description Creates or overwrites a text file.
// @ID saveFile
// @Tags file
// @Security TokenAuth
// @Accept json
// @Param body body SaveRequest true "File content"
// @Success 204
// @Router /api/file [post]
func PostFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		var req SaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		target, err := util.SanitizePath(root, req.Path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			http.Error(w, "mkdir failed", http.StatusInternalServerError)
			return
		}
		if err := os.WriteFile(target, []byte(req.Content), 0644); err != nil {
			http.Error(w, "write failed", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// DeleteFileHandler deletes a file at path (moves to .trash for safety).
// @Summary Delete file
// @Description Moves a file to trash.
// @ID deleteFile
// @Tags file
// @Security TokenAuth
// @Param path query string true "File path"
// @Success 204
// @Failure 403 "Deletion disabled"
// @Router /api/file [delete]
func DeleteFileHandler(root string, trashDir string, allowDelete bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !allowDelete {
			http.Error(w, "deletion is disabled", http.StatusForbidden)
			return
		}
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		// Move to trash
		ts := time.Now().UTC().Format("20060102-150405")
		trashBase := filepath.Join(trashDir, ts)
		relPath, _ := filepath.Rel(root, target)
		dest := filepath.Join(trashBase, relPath)
		if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
			http.Error(w, "mkdir failed", http.StatusInternalServerError)
			return
		}
		// attempt rename first
		if err := os.Rename(target, dest); err != nil {
			// fallback to copy
			in, err := os.Open(target)
			if err != nil {
				http.Error(w, "move failed", http.StatusInternalServerError)
				return
			}
			defer in.Close()
			out, err := os.Create(dest)
			if err != nil {
				http.Error(w, "move failed", http.StatusInternalServerError)
				return
			}
			defer out.Close()
			if _, err := io.Copy(out, in); err != nil {
				http.Error(w, "move failed", http.StatusInternalServerError)
				return
			}
			// remove original
			_ = os.Remove(target)
		}
		// Record deletion
		RecordTrash(reqPath, dest)
		w.WriteHeader(http.StatusNoContent)
	}
}

// StatHandler returns basic file metadata: mime, permissions, modTime
// @Summary Get file metadata
// @Description Returns file size, mode, time, etc.
// @ID getFileStat
// @Tags file
// @Security TokenAuth
// @Param path query string true "File path"
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/stat [get]
func StatHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fi, err := os.Stat(target)
		if err != nil {
			if os.IsNotExist(err) {
				util.RecordMissingAccess()
			}
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		mime := ""
		if !fi.IsDir() {
			f, err := os.Open(target)
			if err == nil {
				defer f.Close()
				buf := make([]byte, 4100)
				n, _ := f.Read(buf)
				mime = http.DetectContentType(buf[:n])
			}
		}
		resp := map[string]interface{}{
			"isDir":   fi.IsDir(),
			"size":    fi.Size(),
			"mode":    fi.Mode().String(),
			"modTime": fi.ModTime(),
			"absPath": target,
			"mime":    mime,
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// UploadHandler accepts multipart form file uploads and writes them into the
// target directory specified by the `path` query parameter (relative to root).
// @Summary Upload files
// @Description Upload one or more files via multipart/form-data.
// @ID uploadFiles
// @Tags file
// @Security TokenAuth
// @Accept multipart/form-data
// @Param path query string false "Target directory"
// @Param file formData file true "Files to upload"
// @Success 204
// @Router /api/upload [post]
func UploadHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		// limit parse size (32MB) to avoid huge memory usage
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			http.Error(w, "failed to parse upload", http.StatusBadRequest)
			return
		}
		reqPath := r.URL.Query().Get("path")
		targetDir, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		// ensure directory exists
		if err := os.MkdirAll(targetDir, 0755); err != nil {
			http.Error(w, "failed to create dir", http.StatusInternalServerError)
			return
		}
		// iterate uploaded files (form field may be 'file' or multiple)
		files := r.MultipartForm.File
		for _, fhs := range files {
			for _, fh := range fhs {
				in, err := fh.Open()
				if err != nil {
					continue
				}
				defer in.Close()
				dstPath := filepath.Join(targetDir, filepath.Base(fh.Filename))
				out, err := os.Create(dstPath)
				if err != nil {
					in.Close()
					continue
				}
				if _, err := io.Copy(out, in); err != nil {
					out.Close()
					in.Close()
					continue
				}
				out.Close()
			}
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
