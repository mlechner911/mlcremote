package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"lightdev/internal/watcher"
)

// EventsHandler returns a handler for Server-Sent Events
// @Summary Stream filesystem events
// @Description Subscribe to filesystem changes
// @Tags events
// @Produce text/event-stream
// @Success 200 {string} string "stream"
// @Router /api/events [get]
func EventsHandler(w *watcher.Service) http.HandlerFunc {
	return func(wResp http.ResponseWriter, r *http.Request) {
		// Set headers for SSE
		wResp.Header().Set("Content-Type", "text/event-stream")
		wResp.Header().Set("Cache-Control", "no-cache")
		wResp.Header().Set("Connection", "keep-alive")
		wResp.Header().Set("Access-Control-Allow-Origin", "*")

		// Flush headers immediately
		flusher, ok := wResp.(http.Flusher)
		if !ok {
			http.Error(wResp, "Streaming unsupported", http.StatusInternalServerError)
			return
		}
		flusher.Flush()

		// Subscribe to events
		ch := w.Subscribe()
		defer w.Unsubscribe(ch)

		// Notify connection open (optional, but good for debug)
		// fmt.Fprintf(wResp, ": connected\n\n")
		// flusher.Flush()

		log.Printf("[SSE] Client connected: %s", r.RemoteAddr)

		for {
			select {
			case <-r.Context().Done():
				log.Printf("[SSE] Client disconnected: %s", r.RemoteAddr)
				return
			case event := <-ch:
				data, err := json.Marshal(event)
				if err != nil {
					continue
				}
				fmt.Fprintf(wResp, "data: %s\n\n", data)
				flusher.Flush()
			}
		}
	}
}
