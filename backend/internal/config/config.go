// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Config holds the application configuration.
type Config struct {
	Port        int
	Root        string
	StaticDir   string
	OpenAPIPath string
	NoAuth      bool
	Password    string
	AllowDelete bool
	TrashDir    string
}

// DefaultConfig returns the default configuration.
func DefaultConfig() *Config {
	return &Config{
		Port:        8443,
		Root:        "", // defaults to environment or current dir in main
		NoAuth:      false,
		AllowDelete: false, // Default to safe (read-only/no-delete)
		TrashDir:    "",    // defaults to ~/.trash in server
	}
}

// Load attempts to load configuration from the standard locations.
// Priority:
// 1. ~/.mlcremote/config.ini
// 2. /etc/mlcremote/config.ini
//
// It returns the loaded config (with defaults for missing fields) or the default config if no file is found.
// Errors are returned only if a file exists but cannot be read/parsed.
func Load() (*Config, error) {
	cfg := DefaultConfig()

	home, err := os.UserHomeDir()
	if err == nil {
		userPath := filepath.Join(home, ".mlcremote", "config.ini")
		if _, err := os.Stat(userPath); err == nil {
			return parseFile(userPath, cfg)
		}
	}

	sysPath := "/etc/mlcremote/config.ini"
	if _, err := os.Stat(sysPath); err == nil {
		return parseFile(sysPath, cfg)
	}

	return cfg, nil
}

// parseFile reads a simple key=value INI file.
// Supported keys: port, root, static_dir, openapi_path, no_auth
func parseFile(path string, defaults *Config) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// copy defaults
	cfg := *defaults

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		// Handle section headers [Section] - currently ignored as we use a flat structure
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		// remove quotes if present
		if len(val) >= 2 && (val[0] == '"' || val[0] == '\'') && val[len(val)-1] == val[0] {
			val = val[1 : len(val)-1]
		}

		switch strings.ToLower(key) {
		case "port":
			if i, err := strconv.Atoi(val); err == nil {
				cfg.Port = i
			}
		case "root":
			cfg.Root = expandHome(val)
		case "static_dir", "staticdir":
			cfg.StaticDir = expandHome(val)
		case "openapi", "openapi_path":
			cfg.OpenAPIPath = expandHome(val)
		case "no_auth", "noauth":
			if b, err := strconv.ParseBool(val); err == nil {
				cfg.NoAuth = b
			}
		case "password":
			cfg.Password = val
		case "allow_delete", "allowdelete":
			if b, err := strconv.ParseBool(val); err == nil {
				cfg.AllowDelete = b
			}
		case "trash_dir", "trashdir":
			cfg.TrashDir = expandHome(val)
		}
	}

	return &cfg, scanner.Err()
}

func expandHome(path string) string {
	if strings.HasPrefix(path, "~/") {
		home, _ := os.UserHomeDir()
		return filepath.Join(home, path[2:])
	}
	return path
}
