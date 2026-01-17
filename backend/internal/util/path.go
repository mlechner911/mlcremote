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
func SanitizePath(root string, req string) (string, error) {
	if req == "" {
		req = "."
	}
	clean := filepath.Clean(strings.TrimPrefix(req, "/"))
	candidate := filepath.Join(root, clean)
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
