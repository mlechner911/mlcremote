package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// @Summary Get system logs
// @Description Returns the last 50KB of the application log.
// @ID getLogs
// @Tags system
// @Security TokenAuth
// @Produce text/plain
// @Success 200 {string} string "Log content"
// @Failure 404 "Log file not found"
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

		// Search for latest session-*.log file as optional secondary source
		logDir := filepath.Join(home, ".mlcremote")
		logPath := filepath.Join(logDir, "current.log")

		// If current.log doesn't exist, look for session-*.log
		if _, err := os.Stat(logPath); os.IsNotExist(err) {
			entries, err := os.ReadDir(logDir)
			if err == nil {
				var newestFile string
				var newestTime int64

				for _, entry := range entries {
					if entry.IsDir() {
						continue
					}
					name := entry.Name()
					// Match session-*.log
					if len(name) > 12 && name[0:8] == "session-" && name[len(name)-4:] == ".log" {
						info, err := entry.Info()
						if err == nil {
							if info.ModTime().Unix() > newestTime {
								newestTime = info.ModTime().Unix()
								newestFile = name
							}
						}
					}
				}
				if newestFile != "" {
					logPath = filepath.Join(logDir, newestFile)
				}
			}
		}

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
