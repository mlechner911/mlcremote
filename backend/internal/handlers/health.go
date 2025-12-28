// Copyright (c) 2025 MLCRemote authors
// All rights reserved. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file.

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	cpuutil "github.com/shirou/gopsutil/v3/cpu"
	memutil "github.com/shirou/gopsutil/v3/mem"
)

// healthInfo contains lightweight runtime and system usage details.
type healthInfo struct {
	Status      string  `json:"status"`
	Version     string  `json:"version"`
	Host        string  `json:"host,omitempty"`
	PID         int     `json:"pid"`
	GoAlloc     uint64  `json:"go_alloc_bytes"`
	GoSys       uint64  `json:"go_sys_bytes"`
	GoNumGC     uint32  `json:"go_num_gc"`
	ProcRSS     uint64  `json:"proc_rss_bytes,omitempty"`
	SysMemTotal uint64  `json:"sys_mem_total_bytes,omitempty"`
	SysMemFree  uint64  `json:"sys_mem_free_bytes,omitempty"`
	CPUPercent  float64 `json:"cpu_percent,omitempty"`
	ServerTime  string  `json:"server_time,omitempty"`
	Timezone    string  `json:"timezone,omitempty"`
}

// Health returns a JSON payload including process and lightweight system metrics.
// This is intentionally small and low-overhead; CPU percent is sampled briefly.
func Health(w http.ResponseWriter, r *http.Request) {
	var info healthInfo
	info.Status = "ok"
	info.Version = "0.2.0"
	info.PID = os.Getpid()
	if hn, err := os.Hostname(); err == nil {
		info.Host = hn
	}

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	info.GoAlloc = ms.Alloc
	info.GoSys = ms.Sys
	info.GoNumGC = ms.NumGC

	// best-effort proc stats on Linux: proc RSS and system mem/cpu
	// keep functions small and fail silently if unavailable
	// try gopsutil first (cross-platform)
	if vm, err := memutil.VirtualMemory(); err == nil {
		info.SysMemTotal = vm.Total
		info.SysMemFree = vm.Available
	} else {
		if total, free := readMemInfo(); total > 0 {
			info.SysMemTotal = total
			info.SysMemFree = free
		}
	}

	if percents, err := cpuutil.Percent(120*time.Millisecond, false); err == nil && len(percents) > 0 {
		info.CPUPercent = percents[0]
	} else {
		if cpu := sampleCPUPercent(120 * time.Millisecond); cpu >= 0 {
			info.CPUPercent = cpu
		}
	}

	if rss := readProcRSS(); rss > 0 {
		info.ProcRSS = rss
	}

	// include server time and timezone
	now := time.Now()
	info.ServerTime = now.Format(time.RFC3339)
	info.Timezone = now.Format("MST")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(info)
}

// The helpers below try to read small Linux /proc files; they return 0 on failure.
func readProcRSS() uint64 {
	// only supported on Linux via /proc
	if runtime.GOOS != "linux" {
		return 0
	}
	// read /proc/self/statm: second field is resident set in pages
	data, err := os.ReadFile("/proc/self/statm")
	if err != nil {
		return 0
	}
	var size, rss uint64
	if _, err := fmt.Sscanf(string(data), "%d %d", &size, &rss); err != nil {
		return 0
	}
	// convert pages to bytes
	page := uint64(os.Getpagesize())
	return rss * page
}
// readMemInfo reads /proc/meminfo and returns total and free memory in bytes. (linux only)
func readMemInfo() (total uint64, free uint64) {
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
				// prefer MemAvailable
				if free == 0 {
					free = val * 1024
				}
			}
		}
	}
	return total, free
}

// sampleCPUPercent reads /proc/stat twice with a delay and computes CPU busy percentage.
// returns -1 on failure.
func sampleCPUPercent(delay time.Duration) float64 {
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

type cpuStat struct{ idle, total uint64 }

func readCPUStat() (cpuStat, bool) {
	var s cpuStat
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return s, false
	}
	// first line: cpu  user nice system idle iowait irq softirq steal guest guest_nice
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
	// scan up to 10 numbers
	n, _ := fmt.Sscanf(line, "%s %d %d %d %d %d %d %d %d %d %d", &label, &vals[0], &vals[1], &vals[2], &vals[3], &vals[4], &vals[5], &vals[6], &vals[7], &vals[8], &vals[9])
	if n < 4 {
		return s, false
	}
	// total is sum of the parsed fields
	var total uint64
	for i := 0; i < n-1; i++ {
		total += vals[i]
	}
	s.total = total
	s.idle = vals[3] // idle is the 4th field
	return s, true
}
