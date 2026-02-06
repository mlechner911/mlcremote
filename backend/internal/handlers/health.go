package handlers

import (
	"encoding/json"
	"lightdev/internal/util"
	"net/http"
	"os"
	"runtime"
	"time"

	cpuutil "github.com/shirou/gopsutil/v3/cpu"
	memutil "github.com/shirou/gopsutil/v3/mem"
)

// startTime is set when the package initializes
var startTime = time.Now()

// healthInfo contains some runtime and system usage details.
type healthInfo struct {
	Status       string  `json:"status"`
	Version      string  `json:"version"`
	Host         string  `json:"host,omitempty"`
	OS           string  `json:"os,omitempty"`
	Distro       string  `json:"distro,omitempty"`
	PID          int     `json:"pid"`
	GoAlloc      uint64  `json:"go_alloc_bytes"`
	GoSys        uint64  `json:"go_sys_bytes"`
	GoNumGC      uint32  `json:"go_num_gc"`
	ProcRSS      uint64  `json:"proc_rss_bytes,omitempty"`
	SysMemTotal  uint64  `json:"sys_mem_total_bytes,omitempty"`
	SysMemFree   uint64  `json:"sys_mem_free_bytes,omitempty"`
	CPUPercent   float64 `json:"cpu_percent,omitempty"`
	ServerTime   string  `json:"server_time,omitempty"`
	Timezone     string  `json:"timezone,omitempty"`
	StartTime    string  `json:"start_time,omitempty"`
	PasswordAuth bool    `json:"password_auth"`
	AuthRequired bool    `json:"auth_required"`
	HomeDir      string  `json:"home_dir,omitempty"`
}

// Health returns a handler that serves health info.
// @Summary Get system health
// @Description Returns the status of the server and basic system metrics.
// @ID getHealth
// @Tags system
// @Produce json
// @Success 200 {object} healthInfo
// @Router /health [get]
func Health(passwordAuth bool, authRequired bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var info healthInfo
		info.Status = "ok"
		info.Version = BackendVersion
		info.PasswordAuth = passwordAuth
		info.AuthRequired = authRequired
		info.PID = os.Getpid()
		info.StartTime = startTime.Format("2006-01-02 15:04:05")
		if hn, err := os.Hostname(); err == nil {
			info.Host = hn
		}
		if home, err := os.UserHomeDir(); err == nil {
			info.HomeDir = home
		}

		info.OS = runtime.GOOS
		info.Distro = util.GetDistroInfo()

		var ms runtime.MemStats
		runtime.ReadMemStats(&ms)
		info.GoAlloc = ms.Alloc
		info.GoSys = ms.Sys
		info.GoNumGC = ms.NumGC

		// try gopsutil first (cross-platform)
		if vm, err := memutil.VirtualMemory(); err == nil {
			info.SysMemTotal = vm.Total
			info.SysMemFree = vm.Available
		} else {
			if total, free := util.ReadMemInfo(); total > 0 {
				info.SysMemTotal = total
				info.SysMemFree = free
			}
		}

		if percents, err := cpuutil.Percent(120*time.Millisecond, false); err == nil && len(percents) > 0 {
			info.CPUPercent = percents[0]
		} else {
			if cpu := util.SampleCPUPercent(120 * time.Millisecond); cpu >= 0 {
				info.CPUPercent = cpu
			}
		}

		if rss := util.ReadProcRSS(); rss > 0 {
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
}
