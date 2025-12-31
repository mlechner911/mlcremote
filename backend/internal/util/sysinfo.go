package util

import (
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"
)

// fix me - should work on macos as well

// internal struct to hold CPU stats
type cpuStat struct {
	idle, total uint64
}

// ReadProcRSS returns the resident set size of the current process in bytes.
// Returns 0 on failure or on non-Linux platforms.
func ReadProcRSS() uint64 {
    if runtime.GOOS != "linux" {
        return 0
    }
    data, err := os.ReadFile("/proc/self/statm")
    if err != nil {
        return 0
    }
    var size, rss uint64
    if _, err := fmt.Sscanf(string(data), "%d %d", &size, &rss); err != nil {
        return 0
    }
    page := uint64(os.Getpagesize())
    return rss * page
}

// ReadMemInfo reads /proc/meminfo and returns total and free memory in bytes. (linux only)
// It prefers MemAvailable over MemFree. Returns (0,0) on failure or non-Linux.
func ReadMemInfo() (total uint64, free uint64) {
    if runtime.GOOS != "linux" {
        return 0, 0
    }
    data, err := os.ReadFile("/proc/meminfo")
    if err != nil {
        return 0, 0
    }
    var key string
    var val uint64
    for _, line := range strings.Split(string(data), "\n") {
        if _, err := fmt.Sscanf(line, "%s %d kB", &key, &val); err == nil {
            switch key {
            case "MemTotal:":
                total = val * 1024
            case "MemAvailable:", "MemFree:":
                if free == 0 {
                    free = val * 1024
                }
            }
        }
    }
    return total, free
}

// SampleCPUPercent reads /proc/stat twice with the given delay and returns the busy CPU percentage.
// Returns -1 on failure or non-Linux.
func SampleCPUPercent(delay time.Duration) float64 {
    if runtime.GOOS != "linux" {
        return -1
    }
    a, ok := readCPUStat()
    if !ok {
        return -1
    }
    time.Sleep(delay)
    b, ok := readCPUStat()
    if !ok {
        return -1
    }
    idle := float64(b.idle - a.idle)
    total := float64(b.total - a.total)
    if total <= 0 {
        return -1
    }
    busy := (1.0 - idle/total) * 100.0
    return busy
}


func readCPUStat() (cpuStat, bool) {
    var s cpuStat
    data, err := os.ReadFile("/proc/stat")
    if err != nil {
        return s, false
    }
    var line string
    for _, l := range strings.Split(string(data), "\n") {
        if strings.HasPrefix(l, "cpu ") {
            line = l
            break
        }
    }
    if line == "" {
        return s, false
    }
    var label string
    var vals [10]uint64
    n, _ := fmt.Sscanf(line, "%s %d %d %d %d %d %d %d %d %d %d", &label, &vals[0], &vals[1], &vals[2], &vals[3], &vals[4], &vals[5], &vals[6], &vals[7], &vals[8], &vals[9])
    if n < 4 {
        return s, false
    }
    var total uint64
    for i := 0; i < n-1; i++ {
        total += vals[i]
    }
    s.total = total
    s.idle = vals[3]
    return s, true
}
