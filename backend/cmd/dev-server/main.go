// Copyright (c) 2025 Michael Lechner
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"lightdev/internal/server"
)

func generateToken() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "insecure-token-" + strconv.FormatInt(time.Now().UnixNano(), 16)
	}
	return hex.EncodeToString(b)
}

func main() {
	port := flag.Int("port", 8443, "port to listen on")
	host := flag.String("host", "127.0.0.1", "host interface to listen on")
	root := flag.String("root", "", "working directory root (default $HOME)")
	staticDir := flag.String("static-dir", "", "directory for static files (dev mode)")
	// add if needed: openapi spec path
	openapi := flag.String("openapi", "", "path to OpenAPI YAML spec (optional)")
	noAuth := flag.Bool("no-auth", false, "disable authentication (DANGEROUS)")
	showVersion := flag.Bool("version", false, "print version and exit")
	tokenFlag := flag.String("token", "", "auth token (if empty and no-auth is false, one will be generated)")
	flag.Parse()

	version := "1.0.3"
	if *showVersion {
		fmt.Println(version)
		os.Exit(0)
	}

	// Ensure logs go to stdout so the deployment script can capture them in current.log
	log.SetOutput(os.Stdout)
	log.Printf("MLCRemote v%s starting", version)
	if *root == "" {
		*root = os.Getenv("HOME")
	}

	token := *tokenFlag
	if token == "" && !*noAuth {
		token = generateToken()
	}

	// Dev server doesn't use config file password for now
	// AllowDelete = true for dev server
	trashDir := filepath.Join(os.Getenv("HOME"), ".trash")
	s := server.New(*host, *root, *staticDir, *openapi, token, "", true, trashDir)

	s.Routes()

	if *host != "127.0.0.1" && *host != "localhost" {
		log.Printf("[WARNING] Server is listening on EXTERNAL interface (%s). Only do this in a container!", *host)
	}
	// Start server (returns actual port)
	actualPort, err := s.Start(*port)
	if err != nil {
		log.Fatalf("server error: %v", err)
	}

	displayHost := *host
	if displayHost == "0.0.0.0" {
		displayHost = "localhost"
	}
	// Use actualPort for display
	displayAddr := fmt.Sprintf("%s:%d", displayHost, actualPort)

	if token != "" {
		log.Printf("Security: Authentication ENABLED")
		log.Printf("Access URL: http://%s/?token=%s", displayAddr, token)
	} else {
		log.Printf("Security: Authentication DISABLED")
		log.Printf("Access URL: http://%s/", displayAddr)
	}

	// log binary size
	if exe, err := os.Executable(); err == nil {
		if fi, err := os.Stat(exe); err == nil {
			log.Printf("Server started on http://localhost:%d, binary=%s size=%d bytes", actualPort, filepath.Base(exe), fi.Size())
		} else {
			log.Printf("Server started on http://localhost:%d", actualPort)
		}
	} else {
		log.Printf("Server started on http://localhost:%d", actualPort)
	}
	// wait for interrupt (Ctrl-C) or termination signal
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("shutdown signal received, shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
