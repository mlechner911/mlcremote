package remotesystem

// Remote defines the interface for OS-specific remote operations
type Remote interface {
	// JoinPath joins path elements using the remote OS separator
	JoinPath(elem ...string) string

	// Mkdir returns the command to create directories (recursive)
	Mkdir(path string) string

	// Remove returns the command to remove files or directories (force, recursive)
	Remove(path string) string

	// FileHash returns the command to get MD5 hash of a file, and a parser for the output
	FileHash(path string) (script string, parser func(string) string)

	// IsProcessRunning returns the command to check if a PID is running
	IsProcessRunning(pid string) string

	// KillProcess returns the command to strictly kill a process by PID (e.g. kill -9)
	KillProcess(pid string) string

	// FallbackKill returns the command to kill by name (e.g. pkill)
	FallbackKill(name string) string

	// StartProcess returns the command to start the backend detached
	StartProcess(bin, args, logFile, pidFile string) string

	// GetHomeDir returns the path prefix for the home directory (e.g. "~" or ".")
	GetHomeDir() string

	// GetOSName returns the identifier for this system implementation
	GetOSName() string
}
