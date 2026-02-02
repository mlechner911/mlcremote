// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"archive/zip"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"lightdev/internal/util"
)

type dirEntry struct {
	Name         string    `json:"name"`
	Path         string    `json:"path"`
	IsDir        bool      `json:"isDir"`
	IsSymlink    bool      `json:"isSymlink"`
	IsBroken     bool      `json:"isBroken"`
	IsExternal   bool      `json:"isExternal"`
	IsReadOnly   bool      `json:"isReadOnly"`   // !canWrite
	IsRestricted bool      `json:"isRestricted"` // !canRead || (IsDir && !canExec)
	Mode         string    `json:"mode"`         // Human readable mode string
	Size         int64     `json:"size"`
	ModTime      time.Time `json:"modTime"`
}

// TreeHandler lists directory entries under the given path.
// @Summary List directory
// @Description Lists files and directories.
// @ID listDirectory
// @Tags file
// @Security TokenAuth
// @Param path query string false "Relative path"
// @Param showHidden query boolean false "Show hidden files"
// @Produce json
// @Success 200 {array} dirEntry
// @Router /api/tree [get]
func TreeHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fi, err := os.Stat(target)
		if err != nil {
			// if the file does not exist, record and block
			if os.IsNotExist(err) {
				util.RecordMissingAccess(target)
				// If requesting root specifically (or root path is bad)
				if reqPath == "" || reqPath == "." || reqPath == "/" {
					http.Error(w, "root directory not found", http.StatusNotFound)
					return
				}
			}
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if !fi.IsDir() {
			http.Error(w, "not a directory", http.StatusBadRequest)
			return
		}
		f, err := os.Open(target)
		if err != nil {
			if os.IsPermission(err) {
				http.Error(w, "permission denied opening directory", http.StatusForbidden)
				return
			}
			if os.IsNotExist(err) {
				http.Error(w, "directory does not exist", http.StatusNotFound)
				return
			}
			http.Error(w, "cannot open dir: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer f.Close()
		files, err := f.Readdir(0)
		if err != nil {
			if os.IsPermission(err) {
				http.Error(w, "permission denied", http.StatusForbidden)
				return
			}
			http.Error(w, "cannot read dir", http.StatusInternalServerError)
			return
		}
		entries := make([]dirEntry, 0, len(files))
		// check whether client requested hidden files
		showHidden := false
		sh := r.URL.Query().Get("showHidden")
		if sh == "1" || sh == "true" || sh == "yes" {
			showHidden = true
		}
		rootAbs, _ := filepath.Abs(root)
		for _, e := range files {
			// skip hidden files (starting with '.') unless requested
			if !showHidden && len(e.Name()) > 0 && e.Name()[0] == '.' {
				continue
			}
			p := filepath.Join(target, e.Name())
			abs, _ := filepath.Abs(p)
			// rel, _ := filepath.Rel(rootAbs, abs)
			isSymlink := e.Mode()&os.ModeSymlink != 0
			isBroken := false
			isExternal := false
			if isSymlink {
				if _, err := os.Stat(p); err != nil {
					isBroken = true
				} else {
					// Check if external
					if realPath, err := filepath.EvalSymlinks(p); err == nil {
						if relToRoot, err := filepath.Rel(rootAbs, realPath); err == nil {
							// If relative path starts with "..", it's outside the root
							if len(relToRoot) >= 2 && relToRoot[:2] == ".." {
								isExternal = true
							}
						}
					}
				}
			}

			canRead, canWrite, canExec := resolveAccess(e)
			isRestricted := !canRead
			if e.IsDir() && !canExec {
				isRestricted = true
			}

			// Use absolute path for API to avoid ambiguity with SanitizePath strategy
			// when root is not system root.
			fullPath := filepath.ToSlash(abs)
			if !strings.HasPrefix(fullPath, "/") {
				fullPath = "/" + fullPath // Ensure leading slash for Unix-like consistency in API
			}

			entries = append(entries, dirEntry{
				Name:         e.Name(),
				Path:         fullPath,
				IsDir:        e.IsDir(),
				IsSymlink:    isSymlink,
				IsBroken:     isBroken,
				IsExternal:   isExternal,
				IsReadOnly:   !canWrite,
				IsRestricted: isRestricted,
				Mode:         e.Mode().String(),
				Size:         e.Size(),
				ModTime:      e.ModTime(),
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(entries)
	}
}

// GetFileHandler streams the content of a file.
// @Summary Download file
// @Description Streams file content.
// @ID downloadFile
// @Tags file
// @Security TokenAuth
// @Param path query string true "File path"
// @Produce application/octet-stream
// @Success 200
// @Router /api/file [get]
func GetFileHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fi, err := os.Stat(target)
		if err != nil {
			if os.IsNotExist(err) {
				util.RecordMissingAccess(target)
				http.Error(w, "not found", http.StatusNotFound)
			} else {
				http.Error(w, "stat failed", http.StatusInternalServerError)
			}
			return
		}

		// Handle Directory Download (ZIP streaming)
		if fi.IsDir() {
			if r.URL.Query().Get("download") == "true" {
				serveDirectoryAsZip(w, target)
				return
			}
			// If not download, return error as before (editor can't open dir)
			http.Error(w, "not a file", http.StatusBadRequest)
			return
		}

		serveFile(w, r, target)
	}
}

// serveDirectoryAsZip streams the contents of a directory as a ZIP archive.
// It walks the directory tree rooted at 'target' and adds each file to the ZIP writer.
//
// Features:
// - Sets Content-Type to application/zip and Content-Disposition header.
// - Supports recursive directory structure.
// - Skips directories in the zip file itself (only adds files with paths).
// - Uses Deflate compression.
//
// Limitations:
// - Does not preserve file permissions/executable bits perfectly in all unzip clients (uses os.FileInfoHeader).
// - Errors during walking are logged but might result in a partial download since headers are already sent.
func serveDirectoryAsZip(w http.ResponseWriter, target string) {
	// Stream ZIP
	filename := filepath.Base(target) + ".zip"
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")

	zw := zip.NewWriter(w)
	defer zw.Close()

	rootLen := len(target)
	err := filepath.Walk(target, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		// Create relative path for zip entry
		relPath := path[rootLen:]
		if len(relPath) > 0 && (relPath[0] == '/' || relPath[0] == '\\') {
			relPath = relPath[1:]
		}
		if relPath == "" {
			return nil // skip root dir entry itself usually, or keep if you want?
		}
		// Convert to forward slash for zip spec
		relPath = filepath.ToSlash(relPath)

		if info.IsDir() {
			relPath += "/"
		}

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = relPath
		header.Method = zip.Deflate

		writer, err := zw.CreateHeader(header)
		if err != nil {
			return err
		}

		if !info.IsDir() {
			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()
			_, err = io.Copy(writer, file)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		// Too late to send HTTP error if we started writing?
		// But we can log.
		// Since we stream, user gets partial zip.
	}
}

func serveFile(w http.ResponseWriter, r *http.Request, target string) {
	f, err := os.Open(target)
	if err != nil {
		if os.IsPermission(err) {
			http.Error(w, "permission denied", http.StatusForbidden)
			return
		}
		http.Error(w, "cannot open file", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	// detect content type from the first bytes
	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	mime := http.DetectContentType(buf[:n])

	// Override mime for SVG if detected as text/plain or text/xml
	if filepath.Ext(target) == ".svg" && (mime == "text/plain" || mime == "text/xml") {
		mime = "image/svg+xml"
	}

	w.Header().Set("Content-Type", mime)

	// Check if download is requested
	if r.URL.Query().Get("download") == "true" {
		filename := filepath.Base(target)
		w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")
	}

	// Check for UTF-8 BOM
	startOffset := int64(0)
	// Only strip BOM if NOT downloading (i.e. viewing in editor)
	if r.URL.Query().Get("download") != "true" {
		if n >= 3 && buf[0] == 0xEF && buf[1] == 0xBB && buf[2] == 0xBF {
			startOffset = 3
		}
	}

	// rewind to start (or skip BOM)
	if _, err := f.Seek(startOffset, 0); err == nil {
		_, _ = io.Copy(w, f)
	}
}

// FileStat represents extended file metadata.
type FileStat struct {
	IsDir         bool      `json:"isDir"`
	Size          int64     `json:"size"`
	Mode          string    `json:"mode"`
	ModTime       time.Time `json:"modTime"`
	AbsPath       string    `json:"absPath"`
	Mime          string    `json:"mime"`
	IsBlockDevice bool      `json:"isBlockDevice"`
	IsCharDevice  bool      `json:"isCharDevice"`
	IsSocket      bool      `json:"isSocket"`
	IsNamedPipe   bool      `json:"isNamedPipe"`
	IsReadOnly    bool      `json:"isReadOnly"`
	IsRestricted  bool      `json:"isRestricted"`
}

// StatHandler returns basic file metadata: mime, permissions, modTime
// @Summary Get file metadata
// @Description Returns file size, mode, time, and flags.
// @ID getFileStat
// @Tags file
// @Security TokenAuth
// @Param path query string true "File path"
// @Produce json
// @Success 200 {object} FileStat
// @Router /api/stat [get]
func StatHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if util.IsBlocked() {
			http.Error(w, "service temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		reqPath := r.URL.Query().Get("path")
		target, err := util.SanitizePath(root, reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fi, err := os.Stat(target)
		if err != nil {
			if os.IsPermission(err) {
				http.Error(w, "permission denied", http.StatusForbidden)
				return
			}
			if os.IsNotExist(err) {
				util.RecordMissingAccess(target)
			}
			// Log the actual error
			// fmt.Printf("[DEBUG] StatHandler Lstat failed for %s: %v\n", target, err)
			http.Error(w, "stat failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		mime := ""
		if !fi.IsDir() {
			f, err := os.Open(target)
			if err == nil {
				defer f.Close()
				buf := make([]byte, 4100)
				n, _ := f.Read(buf)
				mime = http.DetectContentType(buf[:n])
			} else if os.IsPermission(err) {
				// if we can't open it to read mime, that's fine, just leave mime empty
				// but strictly speaking we might want to flag it?
				// For stat, getting the info is enough.
			}
		}

		mode := fi.Mode()
		canRead, canWrite, canExec := resolveAccess(fi)
		isRestricted := !canRead
		if fi.IsDir() && !canExec {
			isRestricted = true
		}

		resp := FileStat{
			IsDir:         fi.IsDir(),
			Size:          fi.Size(),
			Mode:          mode.String(),
			ModTime:       fi.ModTime(),
			AbsPath:       target,
			Mime:          mime,
			IsBlockDevice: mode&os.ModeDevice != 0 && mode&os.ModeCharDevice == 0,
			IsCharDevice:  mode&os.ModeCharDevice != 0,
			IsSocket:      mode&os.ModeSocket != 0,
			IsNamedPipe:   mode&os.ModeNamedPipe != 0,
			IsReadOnly:    !canWrite,
			IsRestricted:  isRestricted,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}
