package remotesystem

import (
	"strings"
)

// ProbeCommand is the shell command used to detect OS/Arch
const ProbeCommand = "uname -sm || echo 'windows-check'"

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

	if strings.Contains(outputLower, "windows-check") {
		return OSWindows, AMD64
	} else if strings.Contains(outputLower, "windows") {
		return OSWindows, AMD64
	}

	return OSUnknown, UnknownArch
}
