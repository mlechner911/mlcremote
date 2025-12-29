package handlers

import (
	"io"
	"lightdev/internal/util"
	"net/http"
	"os"
	"strconv"
)

// FileSectionHandler serves a section of a file specified by offset and length.
// Query params: path, offset (int64), length (int64). Length is capped to prevent abuse.
func FileSectionHandler(root string) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        reqPath := r.URL.Query().Get("path")
        target, err := util.SanitizePath(root, reqPath)
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }
        f, err := os.Open(target)
        if err != nil {
            http.Error(w, "cannot open file", http.StatusInternalServerError)
            return
        }
        defer f.Close()
        fi, err := f.Stat()
        if err != nil || fi.IsDir() {
            http.Error(w, "not a file", http.StatusBadRequest)
            return
        }

        // parse offset and length
        off := int64(0)
        if s := r.URL.Query().Get("offset"); s != "" {
            if v, err := strconv.ParseInt(s, 10, 64); err == nil && v >= 0 {
                off = v
            }
        }
        length := int64(64 * 1024) // default 64KiB
        if s := r.URL.Query().Get("length"); s != "" {
            if v, err := strconv.ParseInt(s, 10, 64); err == nil && v > 0 {
                length = v
            }
        }
        // cap length to prevent abuse (e.g., 16 MiB)
        const maxLen = 16 * 1024 * 1024
        if length > maxLen {
            length = maxLen
        }

        // ensure offset within file
        if off >= fi.Size() {
            http.Error(w, "offset out of range", http.StatusBadRequest)
            return
        }
        // adjust length if it exceeds file size
        if off+length > fi.Size() {
            length = fi.Size() - off
        }

        // set content-type as octet-stream; clients may interpret as text if desired
        w.Header().Set("Content-Type", "application/octet-stream")
        // copy the section
        sr := io.NewSectionReader(f, off, length)
        if _, err := io.Copy(w, sr); err != nil {
            // client may have disconnected; nothing to do
            return
        }
    }
}
