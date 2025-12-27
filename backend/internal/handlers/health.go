package handlers

import "net/http"

// Health returns basic health info.
func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{\"status\":\"ok\",\"version\":\"0.1.0\"}"))
}
