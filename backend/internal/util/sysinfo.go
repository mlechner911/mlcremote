package util

import (
	"os"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/process"
)

// ReadProcRSS returns the resident set size of the current process in bytes.
func ReadProcRSS() uint64 {
	p, err := process.NewProcess(int32(os.Getpid()))
	if err != nil {
		return 0
	}
	memInfo, err := p.MemoryInfo()
	if err != nil {
		return 0
	}
	return memInfo.RSS
}

// ReadMemInfo returns total and free memory in bytes.
// Free matches "Available" semantic (memory available for new apps).
func ReadMemInfo() (total uint64, free uint64) {
	v, err := mem.VirtualMemory()
	if err != nil {
		return 0, 0
	}
	return v.Total, v.Available
}

// SampleCPUPercent returns the busy CPU percentage over the given delay.
func SampleCPUPercent(delay time.Duration) float64 {
	pct, err := cpu.Percent(delay, false)
	if err != nil || len(pct) == 0 {
		return 0
	}
	return pct[0]
}
