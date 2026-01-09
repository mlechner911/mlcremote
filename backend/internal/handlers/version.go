package handlers

import (
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
	_, _ = w.Write([]byte(`{"backend":"0.3.1","frontendCompatible":"^0.3"}`))
}
