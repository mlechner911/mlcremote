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
	return abs, nil
}
