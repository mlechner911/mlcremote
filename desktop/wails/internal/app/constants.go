package app

const (
	// RemoteBaseDir is the base directory for the application on the remote server
	RemoteBaseDir = ".mlcremote"

	// RemoteBinDir is where the binary is stored
	RemoteBinDir = ".mlcremote/bin"

	// RemoteFrontendDir is where the frontend assets are stored
	RemoteFrontendDir = ".mlcremote/frontend"

	// RemoteBinaryName is the name of the executable
	RemoteBinaryName = "dev-server"

	// RunScript is the name of the wrapper script
	RunScript = "run-server.sh"

	// ServiceName is the systemd service name
	ServiceName = "mlcremote.service"

	// SystemdUserDir is the standard user systemd directory
	SystemdUserDir = ".config/systemd/user"
)
