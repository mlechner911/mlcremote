// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"lightdev/internal/server"
)

// main starts the dev-server with flags for root, static-dir and openapi.
func main() {
	port := flag.Int("port", 8443, "port to listen on")
	root := flag.String("root", "", "working directory root (default $HOME)")
	staticDir := flag.String("static-dir", "", "directory for static files (dev mode)")
	openapi := flag.String("openapi", "", "path to OpenAPI YAML spec (optional)")
	flag.Parse()

	if *root == "" {
		*root = os.Getenv("HOME")
	}

	s := server.New(*root, *staticDir, *openapi)
	s.Routes()
	if err := s.Start(*port); err != nil {
		log.Fatalf("server error: %v", err)
	}
	// log binary size (best-effort)
	if exe, err := os.Executable(); err == nil {
		if fi, err := os.Stat(exe); err == nil {
			log.Printf("Server started on http://localhost:%d, binary=%s size=%d bytes", *port, filepath.Base(exe), fi.Size())
		} else {
			log.Printf("Server started on http://localhost:%d", *port)
		}
	} else {
		log.Printf("Server started on http://localhost:%d", *port)
	}
	// wait for interrupt (Ctrl-C) or termination signal
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("shutdown signal received, shutting down server...")
	if err := s.Shutdown(); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
