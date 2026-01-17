package remotesystem

import (
	"fmt"
	"strings"
)

type Darwin struct{}

func (d *Darwin) GetOSName() string {
	return "darwin"
}

func (d *Darwin) GetHomeDir() string {
	return "$HOME"
}

func (d *Darwin) JoinPath(elem ...string) string {
	return strings.Join(elem, "/")
}

func (d *Darwin) Mkdir(path string) string {
	return fmt.Sprintf("mkdir -p \"%s\"", path)
}

func (d *Darwin) Remove(path string) string {
	return fmt.Sprintf("rm -rf \"%s\"", path)
}

func (d *Darwin) Rename(src, dst string) string {
	return fmt.Sprintf("mv -f \"%s\" \"%s\"", src, dst)
}

func (d *Darwin) FileHash(path string) (string, func(string) string) {
	// macOS uses 'md5 -q' for quiet output (just hash)
	// Try md5-util first (if deployed), then fallback to system md5
	cmd := fmt.Sprintf("~/.mlcremote/bin/md5-util \"%s\" || md5 -q \"%s\"", path, path)

	parser := func(output string) string {
		return strings.TrimSpace(output)
	}
	return cmd, parser
}

func (d *Darwin) IsProcessRunning(pid string) string {
	return fmt.Sprintf("kill -0 %s", pid)
}

func (d *Darwin) KillProcess(pid string) string {
	return fmt.Sprintf("kill -9 %s", pid)
}

func (d *Darwin) FallbackKill(name string) string {
	return fmt.Sprintf("pkill -9 -f %s || true", name)
}

func (d *Darwin) StartProcess(bin, args, logFile, pidFile string) string {
	// Execute the uploaded shell script.
	scriptPath := "~/.mlcremote/start_agent_darwin.sh"
	return fmt.Sprintf("sh %s \"%s\" \"%s\" \"%s\" \"%s\"", scriptPath, bin, args, logFile, pidFile)
}

func (d *Darwin) GetStartupScript() (string, string) {
	script := `#!/bin/sh
#
# MLCRemote Agent Startup Script (macOS)
# --------------------------------------
# This script handles the robust startup of the mlcremote-server binary on macOS.
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
#   ./start_agent_darwin.sh /path/to/bin "-arg1 -arg2" /path/to/log /path/to/pid

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

# macOS specific: Remove quarantine attribute if present to avoid popups
# (Though usually SSH executions bypass UI gatekeeper, this is safety)
xattr -d com.apple.quarantine "$BIN_PATH" 2>/dev/null || true

# Start the process in the background with nohup
# We use 'sh -c' to ensure clean redirection and PID capture
nohup "$BIN_PATH" $ARGS > "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"

# Wait a brief moment to ensure it didn't crash immediately
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
	return "start_agent_darwin.sh", script
}

func (d *Darwin) ReadFile(path string) string {
	if strings.HasPrefix(path, "/") || strings.HasPrefix(path, "~") || strings.HasPrefix(path, "$") {
		return fmt.Sprintf("cat \"%s\"", path)
	}
	cleanPath := strings.TrimPrefix(path, "./")
	return fmt.Sprintf("cat ~/%s", cleanPath)
}

func (d *Darwin) GetBinaryName(name string) string {
	return name
}

func (d *Darwin) GetMD5UtilityName() string {
	return "md5-util"
}
