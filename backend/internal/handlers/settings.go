// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"encoding/json"
	"lightdev/internal/config"
	"net/http"
)

// SettingsHandler handles reading and writing user settings.
// GET: Returns merged system config + user settings.
// POST: Updates user settings.
// @Summary Get or Update frontend settings
// @Description Returns runtime-configurable settings or updates them.
// @ID settingsHandler
// @Tags system
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/settings [get]
// @Router /api/settings [post]
func SettingsHandler(allowDelete bool, settingsPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			// Update settings
			var updates config.UserSettings
			if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}

			// Load existing to merge/preserve if needed (though we mostly overwrite)
			// For now, simple save.
			// Actually ideally we load, update fields, save.
			// However the struct is small and flat.

			if err := config.SaveSettings(settingsPath, &updates); err != nil {
				http.Error(w, "failed to save settings: "+err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(updates)
			return
		}

		// GET
		userSettings, err := config.LoadSettings(settingsPath)
		if err != nil {
			// log error but continue with defaults?
			userSettings = config.DefaultSettings()
		}

		// Merge system settings (read-only) with user settings
		resp := map[string]interface{}{
			"allowDelete":     allowDelete,
			"defaultShell":    detectDefaultShell(),
			"theme":           userSettings.Theme,
			"autoOpen":        userSettings.AutoOpen,
			"showHidden":      userSettings.ShowHidden,
			"showLogs":        userSettings.ShowLogs,
			"hideMemoryUsage": userSettings.HideMemoryUsage,
			"maxEditorSize":   userSettings.MaxEditorSize,
			"language":        userSettings.Language,
			"uiMode":          userSettings.UiMode,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}
