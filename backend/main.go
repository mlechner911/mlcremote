package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

// healthHandler returns basic health info.
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{\"status\":\"ok\",\"version\":\"0.1.0\"}"))
}

// sanitizePath resolves a requested path against the configured root.
// It ensures the target path is within root by resolving symlinks.
func sanitizePath(root string, req string) (string, error) {
	if req == "" {
		req = "."
	}
	// treat req as relative to root even if it starts with '/'
	clean := filepath.Clean(strings.TrimPrefix(req, "/"))
	candidate := filepath.Join(root, clean)
	// resolve symlinks
	resolved, err := filepath.EvalSymlinks(candidate)
	if err != nil {
		// if file doesn't exist yet (e.g., POST create), fallback to Clean path
		resolved = candidate
	}
	abs, err := filepath.Abs(resolved)
	if err != nil {
		return "", err
	}
	// ensure within root
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(rootAbs, abs)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(rel, "..") {
		return "", errors.New("path outside root")
	}
	return abs, nil
}

// wsTerminalHandler upgrades to WebSocket and bridges data to a PTY shell.
func wsTerminalHandler(root string) http.HandlerFunc {
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

// dirEntry describes a file or directory for JSON responses.
type dirEntry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
}

// apiTreeHandler lists directory entries under the given path.
func apiTreeHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqPath := r.URL.Query().Get("path")
		target, err := sanitizePath(root, reqPath)
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

// apiGetFileHandler streams the content of a file.
func apiGetFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqPath := r.URL.Query().Get("path")
		target, err := sanitizePath(root, reqPath)
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
			log.Printf("stream error: %v", err)
		}
	}
}

// saveRequest represents a POST /api/file body.
type saveRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// apiPostFileHandler saves content to a file, creating it if needed.
func apiPostFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req saveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		target, err := sanitizePath(root, req.Path)
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

// apiDeleteFileHandler deletes a file at path.
func apiDeleteFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqPath := r.URL.Query().Get("path")
		target, err := sanitizePath(root, reqPath)
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

func main() {
	port := flag.Int("port", 8443, "port to listen on")
	root := flag.String("root", os.Getenv("HOME"), "working directory root")
	staticDir := flag.String("static-dir", "", "directory for static files (dev mode)")
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)

	// APIs
	mux.Handle("/ws/terminal", wsTerminalHandler(*root))
	mux.Handle("/api/tree", apiTreeHandler(*root))
	mux.Handle("/api/file", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			apiGetFileHandler(*root)(w, r)
		case http.MethodPost:
			apiPostFileHandler(*root)(w, r)
		case http.MethodDelete:
			apiDeleteFileHandler(*root)(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// Static files (for dev): if provided, serve frontend from staticDir
	if *staticDir != "" {
		abs, err := filepath.Abs(*staticDir)
		if err != nil {
			log.Fatalf("invalid static-dir: %v", err)
		}
		fs := http.FileServer(http.Dir(abs))
		mux.Handle("/", fs)
		log.Printf("serving static from %s", abs)
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("<html><body><h1>Dev Server</h1><p>Build frontend and use --static-dir to serve.</p></body></html>"))
		})
	}

	addr := fmt.Sprintf("127.0.0.1:%d", *port)
	log.Printf("starting server on %s, root=%s", addr, *root)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
