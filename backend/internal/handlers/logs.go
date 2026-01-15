package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// @Router /api/logs [get]
func LogsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Determine log file path
		// We assume standard deployment location: ~/.mlcremote/current.log
		home, err := os.UserHomeDir()
		if err != nil {
			http.Error(w, "Could not determine home directory", http.StatusInternalServerError)
			return
		}

		logPath := filepath.Join(home, ".mlcremote", "current.log")

		f, err := os.Open(logPath)
		if err != nil {
			if os.IsNotExist(err) {
				http.Error(w, fmt.Sprintf("Log file not found at %s", logPath), http.StatusNotFound)
				return
			}
			http.Error(w, fmt.Sprintf("Failed to open log file: %v", err), http.StatusInternalServerError)
			return
		}
		defer f.Close()

		// Seek to end - 50KB or start if smaller
		stat, err := f.Stat()
		if err != nil {
			http.Error(w, "Failed to stat log file", http.StatusInternalServerError)
			return
		}

		const maxBytes = 50 * 1024 // 50KB
		if stat.Size() > maxBytes {
			_, err = f.Seek(-maxBytes, io.SeekEnd)
			if err != nil {
				// Fallback to start
				f.Seek(0, io.SeekStart)
			}
		}

		w.Header().Set("Content-Type", "text/plain")
		io.Copy(w, f)
	}
}
