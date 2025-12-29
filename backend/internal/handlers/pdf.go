package handlers

import (
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"lightdev/internal/util"
)

// PdfRenderHandler renders a single page of a PDF to PNG using pdftoppm (Poppler).
// Query params:
//  - path: server-relative path to PDF (required)
//  - page: 1-based page number (default 1)
//  - dpi: rendering DPI (default 150)
func PdfRenderHandler(root string) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        reqPath := r.URL.Query().Get("path")
        if reqPath == "" {
            http.Error(w, "path required", http.StatusBadRequest)
            return
        }
        target, err := util.SanitizePath(root, reqPath)
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }
        fi, err := os.Stat(target)
        if err != nil || fi.IsDir() {
            http.Error(w, "not a file", http.StatusBadRequest)
            return
        }

        page := 1
        if p := r.URL.Query().Get("page"); p != "" {
            if v, err := strconv.Atoi(p); err == nil && v > 0 {
                page = v
            }
        }
        dpi := 150
        if d := r.URL.Query().Get("dpi"); d != "" {
            if v, err := strconv.Atoi(d); err == nil && v > 0 {
                dpi = v
            }
        }

        // Create temp dir for output
        tmpDir, err := ioutil.TempDir("", "pdfrender")
        if err != nil {
            http.Error(w, "internal error", http.StatusInternalServerError)
            return
        }
        defer os.RemoveAll(tmpDir)

        // output prefix (without extension)
        outPrefix := filepath.Join(tmpDir, "out")

        // pdftoppm -f <page> -l <page> -png -singlefile -r <dpi> <input> <outPrefix>
        cmd := exec.Command("pdftoppm", "-f", strconv.Itoa(page), "-l", strconv.Itoa(page), "-png", "-singlefile", "-r", strconv.Itoa(dpi), target, outPrefix)
        // set reasonable timeout by running in goroutine with channel
        done := make(chan error, 1)
        go func() { done <- cmd.Run() }()
        select {
        case err := <-done:
            if err != nil {
                http.Error(w, "render failed", http.StatusInternalServerError)
                return
            }
        case <-time.After(15 * time.Second):
            _ = cmd.Process.Kill()
            http.Error(w, "render timeout", http.StatusGatewayTimeout)
            return
        }

        // read generated PNG
        pngPath := outPrefix + ".png"
        data, err := ioutil.ReadFile(pngPath)
        if err != nil {
            http.Error(w, "render output missing", http.StatusInternalServerError)
            return
        }
        w.Header().Set("Content-Type", "image/png")
        w.Header().Set("Cache-Control", "public, max-age=3600")
        _, _ = w.Write(data)
    }
}
