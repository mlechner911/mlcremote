package remotesystem

import (
	"strconv"
	"strings"
)

// ProbeCommand is the shell command used to detect OS/Arch
const ProbeCommand = "uname -sm || ver"

// ParseOS determines the RemoteOS and RemoteArch from the probe output
func ParseOS(output string) (RemoteOS, RemoteArch) {
	outputLower := strings.ToLower(output)

	if strings.Contains(outputLower, "linux") {
		arch := AMD64 // default
		if strings.Contains(outputLower, "aarch64") || strings.Contains(outputLower, "arm64") {
			arch = ARM64
		}
		return OSLinux, arch
	}
	// windows with cygwin, msys or mingw
	if strings.Contains(outputLower, "mingw") || strings.Contains(outputLower, "msys") || strings.Contains(outputLower, "cygwin") {
		arch := AMD64
		if strings.Contains(outputLower, "aarch64") || strings.Contains(outputLower, "arm64") {
			arch = ARM64
		}
		return OSWindows, arch
	}

	if strings.Contains(outputLower, "darwin") {
		arch := AMD64
		if strings.Contains(outputLower, "arm64") {
			arch = ARM64
		}
		return OSDarwin, arch
	}

	// Windows "ver" check
	// Output example: "Microsoft Windows [Version 10.0.22631.2861]"
	if strings.Contains(outputLower, "windows") && strings.Contains(outputLower, "version") {
		// Use regex/scanner to find the version string X.Y.Z
		// We look for "version X.Y.Z" or just "X.Y.Z" where X is 10
		// Robust approach: find substring "10.0." and parse following digits
		idx := strings.Index(outputLower, "10.0.")
		if idx != -1 {
			msg := outputLower[idx:] // "10.0.22631.2861]..."
			// Find end of version (space, bracket, newline)
			end := strings.IndexAny(msg, " ]\r\n")
			if end != -1 {
				msg = msg[:end]
			}
			parts := strings.Split(msg, ".")
			if len(parts) >= 3 {
				build, _ := strconv.Atoi(parts[2])
				if build >= 22000 {
					return "windows-11", AMD64
				}
				if build >= 10240 {
					return "windows-10", AMD64
				}
			}
		}
		return OSWindows, AMD64
	}

	return OSUnknown, UnknownArch
}
