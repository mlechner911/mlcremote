package stats

import (
	"encoding/json"
	"net/http"
	"strconv"
)

func Handler(c Collector) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sinceStr := r.URL.Query().Get("since")
		var since int64
		if sinceStr != "" {
			if s, err := strconv.ParseInt(sinceStr, 10, 64); err == nil {
				since = s
			}
		}

		history := c.GetHistory(since)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(history)
	}
}
