// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package server

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"

	"lightdev/internal/handlers"
)

// Server represents the HTTP server configuration and mux.
type Server struct {
	Root        string
	StaticDir   string
	OpenAPIPath string
	Mux         *http.ServeMux
	httpServer  *http.Server
}

// New creates a Server with the provided root and static directory.
func New(root, staticDir string, openapiPath string) *Server {
	return &Server{
		Root:        root,
		StaticDir:   staticDir,
		OpenAPIPath: openapiPath,
		Mux:         http.NewServeMux(),
	}
}

// Routes registers all HTTP handlers on the server mux.
func (s *Server) Routes() {
	s.Mux.HandleFunc("/health", handlers.Health)

	// OpenAPI spec (if provided)
	s.Mux.HandleFunc("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		if s.OpenAPIPath == "" {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, s.OpenAPIPath)
	})

	// Swagger UI docs page
	s.Mux.HandleFunc("/docs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		page := `<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<title>API Docs</title>
		<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
		<style>body { margin: 0; }</style>
	</head>
	<body>
		<div id="swagger-ui"></div>
		<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
		<script>
			window.ui = SwaggerUIBundle({
				url: '/openapi.yaml',
				dom_id: '#swagger-ui',
				presets: [SwaggerUIBundle.presets.apis],
				layout: 'BaseLayout'
			});
		</script>
	</body>
</html>`
		_, _ = w.Write([]byte(page))
	})

	// APIs
	s.Mux.Handle("/ws/terminal", handlers.WsTerminalHandler(s.Root))
	s.Mux.Handle("/api/tree", handlers.TreeHandler(s.Root))
	s.Mux.Handle("/api/filetype", handlers.FileTypeHandler(s.Root))
	s.Mux.Handle("/api/stat", handlers.StatHandler(s.Root))
	s.Mux.Handle("/api/settings", handlers.SettingsHandler())
	s.Mux.HandleFunc("/api/terminal/new", handlers.NewTerminalAPI())
	s.Mux.Handle("/api/file", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.GetFileHandler(s.Root)(w, r)
		case http.MethodPost:
			handlers.PostFileHandler(s.Root)(w, r)
		case http.MethodDelete:
			handlers.DeleteFileHandler(s.Root)(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// Static files (for dev)
	if s.StaticDir != "" {
		abs, err := filepath.Abs(s.StaticDir)
		if err == nil {
			fs := http.FileServer(http.Dir(abs))
			s.Mux.Handle("/", fs)
			log.Printf("serving static from %s", abs)
		}
	} else {
		s.Mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("<html><body><h1>Dev Server</h1><p>Build frontend and use --static-dir to serve.</p></body></html>"))
		})
	}
}

// Start starts the HTTP server on the given port bound to localhost.
// Start starts the HTTP server on the given port bound to localhost.
// It runs ListenAndServe in a goroutine and returns immediately.
func (s *Server) Start(port int) error {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	log.Printf("starting server on %s, root=%s", addr, s.Root)
	s.httpServer = &http.Server{Addr: addr, Handler: s.Mux}
	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("server error: %v", err)
		}
	}()
	return nil
}

// Shutdown gracefully shuts down the HTTP server and closes terminal sessions.
func (s *Server) Shutdown() error {
	// attempt to stop accepting new connections
	if s.httpServer != nil {
		if err := s.httpServer.Close(); err != nil {
			log.Printf("error closing http server: %v", err)
		}
	}
	// cleanup terminal sessions
	handlers.ShutdownAllSessions()
	return nil
}
