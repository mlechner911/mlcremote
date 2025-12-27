package main

import (
	"flag"
	"log"
	"os"

	"lightdev/internal/server"
)

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
}
