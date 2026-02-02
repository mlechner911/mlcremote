package stats

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

const (
	defaultHistorySize = 1000 // Keep ~3 days of 5-min intervals
	defaultInterval    = 5 * time.Minute
	statsMetaFile      = "stats.jsonl"
)

type FileCollector struct {
	mu           sync.RWMutex
	history      []SystemStats
	maxHistory   int
	interval     time.Duration
	stopChan     chan struct{}
	storagePath  string
	lastSaveTime int64
}

func NewCollector(storageDir string) *FileCollector {
	return &FileCollector{
		history:     make([]SystemStats, 0, defaultHistorySize),
		maxHistory:  defaultHistorySize,
		interval:    defaultInterval,
		stopChan:    make(chan struct{}),
		storagePath: filepath.Join(storageDir, statsMetaFile),
	}
}

func (c *FileCollector) Start() {
	go c.loop()
}

func (c *FileCollector) Stop() {
	close(c.stopChan)
}

func (c *FileCollector) GetHistory(since int64) []SystemStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if since <= 0 {
		return c.history
	}

	for i, stat := range c.history {
		if stat.Timestamp > since {
			return c.history[i:]
		}
	}
	return []SystemStats{}
}

func (c *FileCollector) loop() {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	// Initial collection
	c.collect()

	for {
		select {
		case <-ticker.C:
			c.collect()
		case <-c.stopChan:
			return
		}
	}
}

func (c *FileCollector) collect() {
	stat := c.collectInternal()

	c.mu.Lock()
	defer c.mu.Unlock()

	// Append to history
	if len(c.history) >= c.maxHistory {
		// Shift
		copy(c.history, c.history[1:])
		c.history[c.maxHistory-1] = stat
	} else {
		c.history = append(c.history, stat)
	}

	// Persist to file
	c.appendToFile(stat)
}

// CollectAndSave runs a single collection, saves to file, and returns the stats.
func (c *FileCollector) CollectAndSave() (SystemStats, error) {
	stat := c.collectInternal()

	// We still update history just in case, though for one-shot CLI it matters less (memory is transient)
	// But catching the lock is good practice.
	c.mu.Lock()
	// Append to history
	if len(c.history) >= c.maxHistory {
		copy(c.history, c.history[1:])
		c.history[c.maxHistory-1] = stat
	} else {
		c.history = append(c.history, stat)
	}
	c.mu.Unlock()

	c.appendToFile(stat)
	return stat, nil
}

func (c *FileCollector) collectInternal() SystemStats {
	stat := SystemStats{
		Timestamp: time.Now().Unix(),
	}

	// CPU
	if pct, err := cpu.Percent(0, false); err == nil && len(pct) > 0 {
		stat.CPU = pct[0]
	}

	// Mem
	if v, err := mem.VirtualMemory(); err == nil {
		stat.Memory = v.UsedPercent
	}

	// Disk (root)
	if d, err := disk.Usage("/"); err == nil {
		stat.Disk = d.UsedPercent
	}

	// Uptime
	if u, err := host.Uptime(); err == nil {
		stat.Uptime = u
	}
	return stat
}

func (c *FileCollector) appendToFile(stat SystemStats) {
	data, err := json.Marshal(stat)
	if err != nil {
		fmt.Printf("Failed to marshal stats: %v\n", err)
		return
	}

	// Ensure directory exists
	dir := filepath.Dir(c.storagePath)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		_ = os.MkdirAll(dir, 0755)
	}

	f, err := os.OpenFile(c.storagePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("Failed to open stats file: %v\n", err)
		return
	}
	defer f.Close()

	if _, err := f.Write(data); err != nil {
		fmt.Printf("Failed to write stats: %v\n", err)
		return
	}
	if _, err := f.WriteString("\n"); err != nil {
		fmt.Printf("Failed to write newline: %v\n", err)
	}
}
