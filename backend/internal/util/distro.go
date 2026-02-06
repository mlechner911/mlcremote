package util

import (
	"fmt"
	"runtime"

	"github.com/shirou/gopsutil/v3/host"
)

// GetDistroInfo identifies the OS distribution/version using gopsutil.
func GetDistroInfo() string {
	info, err := host.Info()
	if err != nil {
		return runtime.GOOS // Fallback
	}

	if runtime.GOOS == "windows" {
		return fmt.Sprintf("Windows %s (%s)", info.Platform, info.PlatformVersion)
	}
	if runtime.GOOS == "darwin" {
		return fmt.Sprintf("macOS %s", info.PlatformVersion)
	}
	if runtime.GOOS == "linux" {
		if info.Platform != "" {
			if info.PlatformVersion != "" {
				return fmt.Sprintf("%s %s", info.Platform, info.PlatformVersion)
			}
			return info.Platform
		}
	}
	return fmt.Sprintf("%s %s", info.Platform, info.PlatformVersion)
}
