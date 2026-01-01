// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"lightdev/internal/config"
	"lightdev/internal/server"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

// @title MLCRemote API
// @version 0.3.0
// @description Lightweight remote development server API.
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.email support@mlcremote.dev

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @securityDefinitions.apikey TokenAuth
// @in header
// @name X-Auth-Token

func generateToken() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "insecure-token-" + strconv.FormatInt(time.Now().UnixNano(), 16)
	}
	return hex.EncodeToString(b)
}

func main() {
	// 1. Load config from file (or defaults)
	cfg, err := config.Load()
	if err != nil {
		log.Printf("Warning: failed to load config file: %v", err)
	}

	// 2. Setup flags with defaults from config
	port := flag.Int("port", cfg.Port, "port to listen on")

	defaultRoot := cfg.Root
	if defaultRoot == "" {
		defaultRoot = os.Getenv("HOME")
	}
	root := flag.String("root", defaultRoot, "working directory root")

	staticDir := flag.String("static-dir", cfg.StaticDir, "directory for static files (dev mode)")
	openapiPath := flag.String("openapi", cfg.OpenAPIPath, "path to openapi.yaml (optional)")
	noAuth := flag.Bool("no-auth", cfg.NoAuth, "disable authentication (DANGEROUS)")

	flag.Parse()

	if *root == "" {
		*root = "."
	}

	token := ""
	if !*noAuth {
		token = generateToken()
	}

	trashDir := cfg.TrashDir
	if trashDir == "" {
		home, _ := os.UserHomeDir()
		trashDir = filepath.Join(home, ".trash")
	}

	srv := server.New(*root, *staticDir, *openapiPath, token, cfg.Password, cfg.AllowDelete, trashDir)
	srv.Routes()

	// startup banner
	log.Printf("MLCRemote v0.2.1 starting")
	log.Printf("Server root: %s", *root)

	addr := fmt.Sprintf("127.0.0.1:%d", *port)
	if token != "" {
		log.Printf("Security: Authentication ENABLED")
		log.Printf("Access URL: http://%s/?token=%s", addr, token)
		log.Printf("Token: %s", token)
	} else {
		log.Printf("Security: Authentication DISABLED (Running in insecure mode)")
		log.Printf("Access URL: http://%s/", addr)
	}

	if err := srv.Start(*port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}

	// wait for interrupt (Ctrl-C) or termination signal
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("shutdown signal received, shutting down server...")

	// graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("error during server shutdown: %v", err)
	}

	// ensure process exits

	go func() {

		time.Sleep(2 * time.Second)

		log.Println("forced exit")

		os.Exit(0)

	}()

}
