package handlers

import "net/http"

// CheckAuthHandler is a no-op handler. 
// If the request reaches this handler, it means the authentication middleware 
// has already successfully validated the token.
// @Summary Check auth token validity
// @Description Verifies if the provided authentication token is valid.
// @ID checkAuth
// @Tags auth
// @Security TokenAuth
// @Success 200
// @Failure 401
// @Router /api/auth/check [get]
func CheckAuthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}
