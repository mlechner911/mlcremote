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
	"time"

	"lightdev/internal/util"
)

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
			if err := os.Remove(target); err != nil {
				// If we fail to remove the original, the delete is incomplete.
				// For the user, the file is still there.
				if os.IsPermission(err) {
					http.Error(w, "permission denied deleting original file", http.StatusForbidden)
				} else {
					http.Error(w, "failed to delete original file: "+err.Error(), http.StatusInternalServerError)
				}
				return
			}
		}
		// Record deletion
		RecordTrash(reqPath, dest)
		w.WriteHeader(http.StatusNoContent)
	}
}

// RenameRequest represents a POST /api/rename body.
type RenameRequest struct {
	OldPath string `json:"oldPath"`
	NewPath string `json:"newPath"`
}

// RenameFileHandler renames or moves a file.
// @Summary Rename file
// @Description Renames or moves a file.
// @ID renameFile
// @Tags file
// @Security TokenAuth
// @Accept json
// @Param body body RenameRequest true "Rename details"
// @Success 204
// @Router /api/rename [post]
func RenameFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		var req RenameRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		oldTarget, err := util.SanitizePath(root, req.OldPath)
		if err != nil {
			http.Error(w, "invalid old path: "+err.Error(), http.StatusBadRequest)
			return
		}

		newTarget, err := util.SanitizePath(root, req.NewPath)
		if err != nil {
			http.Error(w, "invalid new path: "+err.Error(), http.StatusBadRequest)
			return
		}

		// Check if destination exists
		if _, err := os.Stat(newTarget); err == nil {
			http.Error(w, "destination already exists", http.StatusConflict)
			return
		}

		// Ensure parent dir of new target exists
		if err := os.MkdirAll(filepath.Dir(newTarget), 0755); err != nil {
			http.Error(w, "failed to create destination dir", http.StatusInternalServerError)
			return
		}

		if err := os.Rename(oldTarget, newTarget); err != nil {
			if os.IsPermission(err) {
				http.Error(w, "permission denied", http.StatusForbidden)
				return
			}
			if os.IsNotExist(err) {
				// old path missing
				http.Error(w, "file not found", http.StatusNotFound)
				return
			}
			// Fallback copy if different device?
			// Since we might be inside same root, likely not, but good to handle.
			// Similar logic to delete...
			http.Error(w, "rename failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// CopyRequest represents a POST /api/copy body.
type CopyRequest struct {
	OldPath string `json:"oldPath"`
	NewPath string `json:"newPath"`
}

// CopyFileHandler copies a file.
// @Summary Copy file
// @Description Copies a file.
// @ID copyFile
// @Tags file
// @Security TokenAuth
// @Accept json
// @Param body body CopyRequest true "Copy details"
// @Success 204
// @Router /api/copy [post]
func CopyFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		var req CopyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		oldTarget, err := util.SanitizePath(root, req.OldPath)
		if err != nil {
			http.Error(w, "invalid old path: "+err.Error(), http.StatusBadRequest)
			return
		}

		newTarget, err := util.SanitizePath(root, req.NewPath)
		if err != nil {
			http.Error(w, "invalid new path: "+err.Error(), http.StatusBadRequest)
			return
		}

		// Check if destination exists
		if _, err := os.Stat(newTarget); err == nil {
			http.Error(w, "destination already exists", http.StatusConflict)
			return
		}

		// Ensure parent dir of new target exists
		if err := os.MkdirAll(filepath.Dir(newTarget), 0755); err != nil {
			http.Error(w, "failed to create destination dir", http.StatusInternalServerError)
			return
		}

		// Perform copy
		src, err := os.Open(oldTarget)
		if err != nil {
			if os.IsPermission(err) {
				http.Error(w, "permission denied", http.StatusForbidden)
				return
			}
			if os.IsNotExist(err) {
				http.Error(w, "file not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to open source: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer src.Close()

		dst, err := os.Create(newTarget)
		if err != nil {
			if os.IsPermission(err) {
				http.Error(w, "permission denied", http.StatusForbidden)
				return
			}
			http.Error(w, "failed to create destination: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, src); err != nil {
			http.Error(w, "failed to copy content: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
