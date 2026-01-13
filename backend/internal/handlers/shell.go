package handlers

import (
	"os"
	"runtime"
)

func detectDefaultShell() string {
	shell := os.Getenv("SHELL")
	if shell != "" {
		return shell
	}

	if runtime.GOOS == "windows" {
		comspec := os.Getenv("COMSPEC")
		if comspec != "" {
			return comspec
		}
		return "cmd.exe"
	}

	// Fallback for Linux/macOS
	return "/bin/bash"
}
