package util

import (
	"log"
	"sync"
)

var (
	mu sync.Mutex
)

// RecordMissingAccess logs that an access to a non-existent file occurred.
func RecordMissingAccess() {
	// Logging only, no blocking.
	log.Println("[INFO] access to non-existent file recorded")
}

// IsBlocked always returns false as we have removed the blocking mechanism.
func IsBlocked() bool {
	return false
}
