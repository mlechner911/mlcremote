package util

import (
	"bufio"
	"os"
	"runtime"
	"strings"
)

// GetDistroInfo tries to identify the OS distribution/version.
func GetDistroInfo() string {
	if runtime.GOOS == "windows" {
		return "Windows" // precise version is harder without syscalls/exec, keeping simple
	}
	if runtime.GOOS == "linux" {
		// try /etc/os-release
		f, err := os.Open("/etc/os-release")
		if err == nil {
			defer f.Close()
			scanner := bufio.NewScanner(f)
			var name, version string
			for scanner.Scan() {
				line := scanner.Text()
				if strings.HasPrefix(line, "PRETTY_NAME=") {
					return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), "\"")
				}
				if strings.HasPrefix(line, "NAME=") {
					name = strings.Trim(strings.TrimPrefix(line, "NAME="), "\"")
				}
				if strings.HasPrefix(line, "VERSION=") {
					version = strings.Trim(strings.TrimPrefix(line, "VERSION="), "\"")
				}
			}
			if name != "" {
				if version != "" {
					return name + " " + version
				}
				return name
			}
		}
	}
	if runtime.GOOS == "darwin" {
		return "macOS"
	}
	return runtime.GOOS
}
