package util

import (
	"log"
	"sync"
)

var (
	mu sync.Mutex
)

// RecordMissingAccess logs that an access to a non-existent file occurred.
func RecordMissingAccess(path string) {
	// Logging only, no blocking.
	log.Printf("[INFO] access to non-existent file recorded: %s", path)
}

// IsBlocked always returns false as we have removed the blocking mechanism.
func IsBlocked() bool {
	return false
}
