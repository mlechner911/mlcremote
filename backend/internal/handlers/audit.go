package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var auditMu sync.Mutex

// WriteAuditLog appends a message to ~/.mlcremote/audit.log with a timestamp.
func WriteAuditLog(format string, v ...interface{}) {
	auditMu.Lock()
	defer auditMu.Unlock()

	home, err := os.UserHomeDir()
	if err != nil {
		return // Silently fail if we can't find home
	}

	logDir := filepath.Join(home, ".mlcremote")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return
	}

	logPath := filepath.Join(logDir, "audit.log")
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	msg := fmt.Sprintf(format, v...)
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	line := fmt.Sprintf("[%s] %s\n", timestamp, msg)

	if _, err := f.WriteString(line); err != nil {
		// ignore
	}
}
