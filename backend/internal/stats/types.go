package stats

// SystemStats represents a snapshot of system health
type SystemStats struct {
	Timestamp int64   `json:"timestamp"`
	CPU       float64 `json:"cpu"`    // Usage percentage
	Memory    float64 `json:"memory"` // Usage percentage
	Disk      float64 `json:"disk"`   // Usage percentage
	Uptime    uint64  `json:"uptime"` // Seconds
}

// Collector handles gathering and storing stats
type Collector interface {
	Start()
	Stop()
	GetHistory(since int64) []SystemStats
}
