// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"encoding/json"
	"net/http"
)

// SettingsHandler returns runtime-configurable settings for the frontend.
// Default values: allowDelete=false, defaultShell="bash".
// @Summary Get frontend settings
// @Description Returns runtime-configurable settings.
// @ID getSettings
// @Tags system
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/settings [get]
func SettingsHandler(allowDelete bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"allowDelete":  allowDelete,
			"defaultShell": "bash",
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}
