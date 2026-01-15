package handlers

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ArchiveEntry represents a file within an archive
type ArchiveEntry struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	IsDir   bool      `json:"isDir"`
	ModTime time.Time `json:"modTime"`
}

// ListArchiveHandler returns a handler that lists contents of an archive file
func ListArchiveHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		relPath := r.URL.Query().Get("path")
		if relPath == "" {
			http.Error(w, "path required", http.StatusBadRequest)
			return
		}

		// Security check: join with root and clean
		cleanRoot := filepath.Clean(root)
		absPath := filepath.Join(root, relPath)
		cleanPath := filepath.Clean(absPath)

		// Hmm .. Case-insensitive check on Windows is complex, but standard prefix check
		// with normalized separators should catch basic traversal attacks.
		// We use Clean() to ensure separators are consistent (OS-specific).
		if !strings.HasPrefix(cleanPath, cleanRoot) {
			http.Error(w, "access denied", http.StatusForbidden)
			return
		}

		entries, err := listArchive(absPath)
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to list archive: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(entries)
	}
}

func listArchive(path string) ([]ArchiveEntry, error) {
	ext := strings.ToLower(filepath.Ext(path))

	// Handle tar.gz / tgz (composite extension check)
	if strings.HasSuffix(strings.ToLower(path), ".tar.gz") || strings.HasSuffix(strings.ToLower(path), ".tgz") {
		return listTarGz(path)
	}

	switch ext {
	case ".zip":
		return listZip(path)
	case ".tar":
		return listTar(path)
	default:
		return nil, fmt.Errorf("unsupported archive type: %s", ext)
	}
}

func listZip(path string) ([]ArchiveEntry, error) {
	r, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	var entries []ArchiveEntry
	for _, f := range r.File {
		entries = append(entries, ArchiveEntry{
			Name:    f.Name,
			Size:    int64(f.UncompressedSize64),
			IsDir:   f.FileInfo().IsDir(),
			ModTime: f.Modified,
		})
	}
	return entries, nil
}

func listTar(path string) ([]ArchiveEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return readTar(f)
}

func listTarGz(path string) ([]ArchiveEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	gzr, err := gzip.NewReader(f)
	if err != nil {
		return nil, err
	}
	defer gzr.Close()

	return readTar(gzr)
}

func readTar(r io.Reader) ([]ArchiveEntry, error) {
	tr := tar.NewReader(r)
	var entries []ArchiveEntry

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		isDir := header.Typeflag == tar.TypeDir
		// Heuristic: if name ends in slash, it's a dir
		if strings.HasSuffix(header.Name, "/") {
			isDir = true
		}

		entries = append(entries, ArchiveEntry{
			Name:    header.Name,
			Size:    header.Size,
			IsDir:   isDir,
			ModTime: header.ModTime,
		})
	}
	return entries, nil
}
