package remotesystem

// RemoteOS defines the supported operating systems
type RemoteOS string

const (
	OSLinux   RemoteOS = "linux"
	OSDarwin  RemoteOS = "darwin"
	OSWindows RemoteOS = "windows"
	OSUnknown RemoteOS = "unknown"
)

// RemoteArch defines the supported architectures
type RemoteArch string

const (
	AMD64       RemoteArch = "amd64"
	ARM64       RemoteArch = "arm64"
	UnknownArch RemoteArch = "unknown"
)
