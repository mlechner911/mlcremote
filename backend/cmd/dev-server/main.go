// Copyright (c) 2025 Michael Lechner
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"lightdev/internal/server"
	"lightdev/internal/stats"
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
	// Handle simplified CLI commands before flags
	if len(os.Args) > 1 {
		if os.Args[1] == "cmd" {
			// usage: dev-server cmd <command> [json_args | key=value ...]
			if len(os.Args) < 3 {
				fmt.Fprintln(os.Stderr, "Usage: dev-server cmd <command> [args...]")
				fmt.Fprintln(os.Stderr, "  args can be a single JSON string or key=value pairs")
				os.Exit(1)
			}
			commandName := os.Args[2]
			args := make(map[string]interface{})

			// Parse args
			if len(os.Args) == 4 && strings.HasPrefix(os.Args[3], "{") {
				// JSON string
				if err := json.Unmarshal([]byte(os.Args[3]), &args); err != nil {
					fmt.Fprintf(os.Stderr, "Error parsing JSON args: %v\n", err)
					os.Exit(1)
				}
			} else if len(os.Args) > 3 {
				// key=value pairs or positional args
				var positional []string
				for _, arg := range os.Args[3:] {
					parts := strings.SplitN(arg, "=", 2)
					if len(parts) == 2 {
						args[parts[0]] = parts[1]
					} else {
						// Collect positional arguments
						positional = append(positional, arg)
					}
				}
				if len(positional) > 0 {
					args["_positional"] = positional
				}
			}

			apiURL := os.Getenv("MLCREMOTE_API_URL")
			token := os.Getenv("MLCREMOTE_TOKEN")

			if apiURL == "" {
				fmt.Fprintln(os.Stderr, "Error: MLCREMOTE_API_URL not set.")
				os.Exit(1)
			}
			// Ensure no trailing slash
			if strings.HasSuffix(apiURL, "/") {
				apiURL = apiURL[:len(apiURL)-1]
			}

			target := fmt.Sprintf("%s/api/command", apiURL)
			if token != "" {
				target += "?token=" + token
			}

			reqBody := map[string]interface{}{
				"command": commandName,
				"args":    args,
			}
			jsonBody, _ := json.Marshal(reqBody)

			req, err := http.NewRequest("POST", target, bytes.NewBuffer(jsonBody))
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error building request: %v\n", err)
				os.Exit(1)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Auth-Token", token)

			client := &http.Client{Timeout: 2 * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Request failed: %v\n", err)
				os.Exit(1)
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				fmt.Fprintf(os.Stderr, "Server returned status: %s\n", resp.Status)
				os.Exit(1)
			}
			os.Exit(0)
		} else if os.Args[1] == "cwd" {
			// usage: dev-server cwd [path]
			// if path not provided, use PWD
			dir := ""
			if len(os.Args) > 2 {
				dir = os.Args[2]
			}
			if dir == "" {
				var err error
				dir, err = os.Getwd()
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error getting PWD: %v\n", err)
					os.Exit(1)
				}
			} else if !filepath.IsAbs(dir) {
				wd, _ := os.Getwd()
				dir = filepath.Join(wd, dir)
			}

			apiURL := os.Getenv("MLCREMOTE_API_URL")
			token := os.Getenv("MLCREMOTE_TOKEN")

			if apiURL == "" {
				fmt.Fprintln(os.Stderr, "Error: MLCREMOTE_API_URL not set. Are you running inside the remote terminal?")
				fmt.Fprintln(os.Stderr, "Debug Info - Available MLC Env Vars:")
				for _, e := range os.Environ() {
					if strings.Contains(e, "MLC") {
						fmt.Fprintln(os.Stderr, e)
					}
				}
				os.Exit(1)
			}

			// Ensure no trailing slash
			if apiURL[len(apiURL)-1] == '/' {
				apiURL = apiURL[:len(apiURL)-1]
			}

			target := fmt.Sprintf("%s/api/terminal/cwd", apiURL)
			if token != "" {
				target += "?token=" + token
			}

			body := fmt.Sprintf(`{"cwd": "%s"}`, dir)

			// simple POST request
			req, err := http.NewRequest("POST", target, strings.NewReader(body))
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error building request: %v\n", err)
				os.Exit(1)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Auth-Token", token)

			client := &http.Client{Timeout: 2 * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Request failed: %v\n", err)
				os.Exit(1)
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				fmt.Fprintf(os.Stderr, "Server returned status: %s\n", resp.Status)
				os.Exit(1)
			}
			os.Exit(0)
		} else if os.Args[1] == "stats" {
			// usage: dev-server stats [root-dir]
			// if root-dir not provided, use HOME
			root := ""
			if len(os.Args) > 2 {
				root = os.Args[2]
			}
			if root == "" {
				root = os.Getenv("HOME")
			}

			// Initialize collector (no need for full server)
			storageDir := filepath.Join(root, ".mlcremote")

			// Ensure storage dir exists (redundant with collector but good practice)
			_ = os.MkdirAll(storageDir, 0755)

			col := stats.NewCollector(storageDir)

			// Collect, Save, and Print
			s, err := col.CollectAndSave()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error collecting stats: %v\n", err)
				os.Exit(1)
			}

			// Output JSON to stdout
			encoder := json.NewEncoder(os.Stdout)
			if err := encoder.Encode(s); err != nil {
				fmt.Fprintf(os.Stderr, "Error encoding stats: %v\n", err)
				os.Exit(1)
			}
			os.Exit(0)
		}
	}

	debugTerminal := flag.Bool("debug-terminal", false, "enable verbose terminal logging")
	flag.Parse()

	if len(flag.Args()) > 0 {
		fmt.Fprintf(os.Stderr, "Unknown command or argument: %s\n", flag.Args()[0])
		fmt.Fprintf(os.Stderr, "Usage:\n  dev-server [flags]\n  dev-server cmd <command> [args]\n  dev-server cwd [path]\n")
		os.Exit(1)
	}

	// ... inside main ...
	version := "1.3.11"
	// We need to move version declaration up if we want to use it in the cwd block.
	// Or just hardcode it / copy it for now to avoid massive refactor of main.
	// Let's perform a move of the version variable to the top of main function or package level.

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

	fallback := false
	if _, err := os.Stat(*root); os.IsNotExist(err) {
		// this prevents the server from crashing if the root directory does not exist
		log.Printf("Configured root %s does not exist, falling back to HOME", *root)
		// Not sure if that always works - might be empty. if so .. what do we use?
		*root = os.Getenv("HOME")
		fallback = true
	}

	token := *tokenFlag
	if token == "" && !*noAuth {
		token = generateToken()
	}

	// Dev server doesn't use config file password for now
	// AllowDelete = true for dev server
	trashDir := filepath.Join(os.Getenv("HOME"), ".trash")

	s := server.New(*host, *root, *staticDir, *openapi, token, "", true, trashDir, *debugTerminal)

	if fallback {
		s.RootFallback = true
	}

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
