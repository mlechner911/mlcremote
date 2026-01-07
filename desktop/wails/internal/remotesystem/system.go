package remotesystem

// Remote defines the interface for OS-specific remote operations abstraction.
// Implementations (Linux, Darwin, Windows) provide the exact shell commands.
type Remote interface {
	// JoinPath joins path elements using the remote OS separator (e.g. "/" or "\")
	JoinPath(elem ...string) string

	// Mkdir returns the command to create directories (recursive, like mkdir -p)
	Mkdir(path string) string

	// Remove returns the command to remove files or directories (force, recursive, like rm -rf)
	Remove(path string) string

	// FileHash returns the command to get MD5 hash of a file, and a parser function to extract the hash from output.
	// The parser handles OS-specific output differences (e.g. md5sum vs CertUtil).
	FileHash(path string) (script string, parser func(string) string)

	// IsProcessRunning returns the command to check if a PID is running.
	// Should return exit code 0 if running, non-zero otherwise.
	IsProcessRunning(pid string) string

	// KillProcess returns the command to strictly kill a process by PID (e.g. kill -9).
	KillProcess(pid string) string

	// FallbackKill returns the command to kill by process name (e.g. pkill).
	// Used for cleanup of zombie processes.
	FallbackKill(name string) string

	// StartProcess returns the command to start the backend executable in a detached/background mode.
	// it handles stdout/stderr redirection to logFile, and writing the PID to pidFile.
	StartProcess(bin, args, logFile, pidFile string) string

	// GetHomeDir returns the path prefix for the home directory (e.g. "~" for *nix).
	// On Windows this might return "." if relative paths are used, or explicit env var usage.
	GetHomeDir() string

	// GetStartupScript returns a filename and content for a helper script (e.g. PowerShell script).
	// If the OS requires a complex startup sequence (like Windows), this returns the script to be uploaded.
	// Returns empty strings if no script is needed.
	GetStartupScript() (name string, content string)

	// GetOSName returns the identifier for this system implementation (linux, darwin, windows).
	GetOSName() string
}
