// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package util

import (
	"errors"
	"path/filepath"
	"strings"
)

// SanitizePath resolves a requested path against the configured root and
// ensures the target path is within root by resolving symlinks.
// It supports both absolute paths (if they are within root) and relative paths.
func SanitizePath(root string, req string) (string, error) {
	if req == "" {
		req = "."
	}

	// Helper to validate a candidate path
	validate := func(candidate string) (string, error) {
		resolved, err := filepath.EvalSymlinks(candidate)
		if err != nil {
			resolved = candidate
		}
		abs, err := filepath.Abs(resolved)
		if err != nil {
			return "", err
		}
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

		// Check for protected files
		base := strings.ToLower(filepath.Base(abs))
		protected := []string{
			"ntuser.dat",
			"system volume information",
			"$recycle.bin",
			"pagefile.sys",
			"hiberfil.sys",
			"swapfile.sys",
			"dumpstack.log.tmp",
		}
		for _, p := range protected {
			if base == p {
				return "", errors.New("access denied: protected system file")
			}
		}
		return abs, nil
	}

	// Strategy 1: If path is absolute, try to use it directly
	if filepath.IsAbs(req) {
		// Clean the path first
		clean := filepath.Clean(req)
		if res, err := validate(clean); err == nil {
			return res, nil
		}
		// If verification failed (e.g. outside root), fall through to relative strategy
		// This handles the case where frontend requests "/" meaning "workspace root"
		// which is strictly outside filesystem root, but valid as a relative request.
	}

	// Strategy 2: Treat as relative to root
	clean := filepath.Clean(strings.TrimPrefix(req, "/"))
	candidate := filepath.Join(root, clean)
	return validate(candidate)
}
