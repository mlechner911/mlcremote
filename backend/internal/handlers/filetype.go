// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"lightdev/internal/util"

	"github.com/h2non/filetype"
)

type fileTypeResp struct {
	Mime   string `json:"mime"`
	IsText bool   `json:"isText"`
	Ext    string `json:"ext"`
}

// FileTypeHandler inspects the file bytes to determine a mime type and
// whether the file is likely text. It returns JSON with {mime,isText,ext}.
// @Summary Detect file type
// @Description Returns MIME type and text/binary classification.
// @ID detectFileType
// @Tags file
// @Security TokenAuth
// @Param path query string true "File path"
// @Produce json
// @Success 200 {object} fileTypeResp
// @Router /api/filetype [get]
func FileTypeHandler(root string) http.HandlerFunc {
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
		if err != nil || fi.IsDir() {
			if err != nil && os.IsNotExist(err) {
				util.RecordMissingAccess()
			}
			http.Error(w, "not a file", http.StatusBadRequest)
			return
		}
		f, err := os.Open(target)
		if err != nil {
			if os.IsNotExist(err) {
				util.RecordMissingAccess()
			}
			http.Error(w, "cannot open file", http.StatusInternalServerError)
			return
		}
		defer f.Close()
		buf := make([]byte, 4100)
		n, _ := f.Read(buf)
		mimeType := http.DetectContentType(buf[:n])
		// try using filetype lib to get more specific type
		kind, _ := filetype.Match(buf[:n])
		if kind != filetype.Unknown {
			mimeType = kind.MIME.Value
		}
		ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(target)), ".")
		// heuristics for text-like types
		isText := strings.HasPrefix(mimeType, "text/") || strings.Contains(mimeType, "json") || strings.Contains(mimeType, "xml") || strings.Contains(mimeType, "javascript") || strings.Contains(mimeType, "yaml") || strings.Contains(mimeType, "toml")

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(fileTypeResp{Mime: mimeType, IsText: isText, Ext: ext})
	}
}
