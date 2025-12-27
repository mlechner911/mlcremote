package handlers

import (
	"encoding/json"
	"net/http"
)

// SettingsHandler returns runtime-configurable settings for the frontend.
// Default values: allowDelete=false, defaultShell="bash"
func SettingsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"allowDelete":  false,
			"defaultShell": "bash",
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}
