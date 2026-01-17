package remotesystem

import (
	"fmt"
	"strings"
)

type Linux struct{}

func (l *Linux) GetOSName() string {
	return "linux"
}

func (l *Linux) GetHomeDir() string {
	return "$HOME"
}

func (l *Linux) JoinPath(elem ...string) string {
	return strings.Join(elem, "/")
}

func (l *Linux) Mkdir(path string) string {
	return fmt.Sprintf("mkdir -p \"%s\"", path)
}

func (l *Linux) Remove(path string) string {
	return fmt.Sprintf("rm -rf \"%s\"", path)
}

func (l *Linux) Rename(src, dst string) string {
	return fmt.Sprintf("mv -f \"%s\" \"%s\"", src, dst)
}

func (l *Linux) FileHash(path string) (string, func(string) string) {
	// Uses the custom md5-util if available, fallback to md5sum
	// For now, we assume md5-util will be deployed to ~/.mlcremote/bin/md5-util
	// We'll use a shell condition to check for it? Or just assume it's there after deployment.
	// Let's rely on md5sum as fallback for now.
	// note.. i had issues with my md5sum on windows and with virus scanner as well..

	// We return a command that tries md5-util, then md5sum, then md5
	// cmd := "md5sum path | awk '{print $1}'"

	cmd := fmt.Sprintf("~/.mlcremote/bin/md5-util \"%s\" || md5sum \"%s\" | awk '{print $1}'", path, path)

	parser := func(output string) string {
		return strings.TrimSpace(output)
	}
	return cmd, parser
}

func (l *Linux) IsProcessRunning(pid string) string {
	return fmt.Sprintf("kill -0 %s", pid)
}

func (l *Linux) KillProcess(pid string) string {
	return fmt.Sprintf("kill -9 %s", pid)
}

func (l *Linux) FallbackKill(name string) string {
	return fmt.Sprintf("pkill -9 -f %s || true", name)
}

func (l *Linux) StartProcess(bin, args, logFile, pidFile string) string {
	// Execute the uploaded shell script.
	// We assume the script is at ~/.mlcremote/start_agent_linux.sh
	scriptPath := "~/.mlcremote/start_agent_linux.sh"
	return fmt.Sprintf("sh %s \"%s\" \"%s\" \"%s\" \"%s\"", scriptPath, bin, args, logFile, pidFile)
}

func (l *Linux) GetStartupScript() (string, string) {
	script := `#!/bin/sh
#
# MLCRemote Agent Startup Script (Linux)
# --------------------------------------
# This script handles the robust startup of the mlcremote-server binary.
# It ensures the process is detatched (nohup), logs are redirected,
# and the PID is correctly written for process management.
#
# Arguments:
#   $1: Binary Path (absolute)
#   $2: Arguments for the binary (quoted string)
#   $3: Log File Path (absolute)
#   $4: PID File Path (absolute)
#
# Usage:
#   ./start_agent_linux.sh /path/to/bin "-arg1 -arg2" /path/to/log /path/to/pid

set -e

BIN_PATH="$1"
ARGS="$2"
LOG_FILE="$3"
PID_FILE="$4"

# Validate arguments
if [ -z "$BIN_PATH" ] || [ -z "$LOG_FILE" ] || [ -z "$PID_FILE" ]; then
    echo "Error: Missing arguments."
    echo "Usage: $0 <bin_path> <args> <log_file> <pid_file>"
    exit 1
fi

# Ensure the binary is executable
chmod +x "$BIN_PATH"

# Start the process in the background with nohup
# We use 'sh -c' to ensure clean redirection and PID capture
# 1. nohup detaches from terminal
# 2. > "$LOG_FILE" 2>&1 redirects stdout and stderr to log
# 3. & puts it in background
# 4. echo $! > "$PID_FILE" writes the PID of the background process
nohup "$BIN_PATH" $ARGS > "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"

# Wait a brief moment to ensure it didn't crash immediately (e.g. invalid args)
sleep 0.2

# Check if process is still running
if kill -0 $PID 2>/dev/null; then
    echo "Success: Started $BIN_PATH with PID $PID"
    exit 0
else
    echo "Error: Process $PID died immediately after start."
    echo "Check log file: $LOG_FILE"
    # Dump last few lines of log to stdout for debugging
    tail -n 5 "$LOG_FILE" 2>/dev/null || true
    exit 1
fi
`
	return "start_agent_linux.sh", script
}

func (l *Linux) ReadFile(path string) string {
	if strings.HasPrefix(path, "/") || strings.HasPrefix(path, "~") || strings.HasPrefix(path, "$") {
		return fmt.Sprintf("cat \"%s\"", path)
	}
	cleanPath := strings.TrimPrefix(path, "./")
	return fmt.Sprintf("cat ~/%s", cleanPath)
}

func (l *Linux) GetBinaryName(name string) string {
	return name
}

func (l *Linux) GetMD5UtilityName() string {
	return "md5-util"
}
