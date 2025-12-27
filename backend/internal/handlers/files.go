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

type dirEntry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
}

// TreeHandler lists directory entries under the given path.
func TreeHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fi, err := os.Stat(target)
		if err != nil {
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
		rootAbs, _ := filepath.Abs(root)
		for _, e := range files {
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
func GetFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fi, err := os.Stat(target)
		if err != nil || fi.IsDir() {
			http.Error(w, "not a file", http.StatusBadRequest)
			return
		}
		f, err := os.Open(target)
		if err != nil {
			http.Error(w, "cannot open file", http.StatusInternalServerError)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		if _, err := io.Copy(w, f); err != nil {
			// ignore
		}
	}
}

// SaveRequest represents a POST /api/file body.
type SaveRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// PostFileHandler saves content to a file, creating it if needed.
func PostFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

// DeleteFileHandler deletes a file at path.
func DeleteFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := os.Remove(target); err != nil {
			http.Error(w, "delete failed", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
