package handlers

import (
	"encoding/json"
	"net/http"
)

// VersionHandler returns version compatibility information.
// @Summary Get version info
// @Description Returns backend version and frontend compatibility info.
// @ID getVersion
// @Tags system
// @Produce json
// @Success 200 {object} map[string]string
// @Router /api/version [get]
func VersionHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"backend":            BackendVersion,
		"frontendCompatible": FrontendCompatibleVersion,
	})
}
