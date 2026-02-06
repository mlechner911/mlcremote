package backend

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/remotesystem"
)

// CheckBackend checks if the dev-server binary exists on the remote host
func (m *Manager) CheckBackend(profileJSON string) (bool, error) {
	cmd := fmt.Sprintf("test -f ~/%s/%s", RemoteBinDir, RemoteBinaryName)
	if _, err := m.runSSH(profileJSON, cmd); err != nil {
		return false, nil
	}
	return true, nil
}

// CheckRemoteVersion returns the version string of the remote backend or "unknown"
func (m *Manager) CheckRemoteVersion(profileJSON string) (string, error) {
	os, _, err := m.DetectRemoteOS(profileJSON)
	if err != nil {
		return "unknown", err
	}
	return m.CheckRemoteVersionWithOS(profileJSON, os)
}

// CheckRemoteVersionWithOS returns the version string of the remote backend using known OS
func (m *Manager) CheckRemoteVersionWithOS(profileJSON string, osType remotesystem.RemoteOS) (string, error) {
	sys := getRemoteSystem(osType)
	binName := sys.GetBinaryName(RemoteBinaryName)

	var remotePath string
	if strings.HasPrefix(string(osType), "windows") {
		// Windows cmd.exe style path construction
		remotePath = fmt.Sprintf("%%USERPROFILE%%\\%s\\bin\\%s", RemoteBaseDir, binName)
	} else {
		// Unix style pathing (Standard)
		remotePath = fmt.Sprintf("$HOME/%s/bin/%s", RemoteBaseDir, binName)
	}

	cmd := fmt.Sprintf("\"%s\" --version", remotePath)
	out, err := m.runSSH(profileJSON, cmd)
	if err != nil {
		return "unknown", nil
	}
	return strings.TrimSpace(out), nil
}

// IsServerRunning checks if the backend is already active on the remote host
func (m *Manager) IsServerRunning(profileJSON string, osString string) (bool, error) {
	targetOS := "linux"
	if strings.Contains(osString, "/") {
		targetOS = strings.Split(osString, "/")[0]
	} else {
		targetOS = osString
	}

	var checkCmd string
	if targetOS == "linux" {
		checkCmd = fmt.Sprintf("pgrep -f \"%s.*--no-auth\"", RemoteBinaryName)
	} else if targetOS == "darwin" {
		checkCmd = fmt.Sprintf("pgrep -f \"%s.*--no-auth\"", RemoteBinaryName)
	} else if strings.HasPrefix(targetOS, "windows") {
		// handle both with and without .exe just in case
		checkCmd = fmt.Sprintf("tasklist /FI \"IMAGENAME eq %s.exe\" | findstr %s.exe", RemoteBinaryName, RemoteBinaryName)
	}

	if checkCmd == "" {
		return false, nil
	}

	if _, err := m.runSSH(profileJSON, checkCmd); err != nil {
		return false, nil
	}
	return true, nil
}

// GetRemoteFileTree returns a string representation of the remote .mlcremote directory tree
func (m *Manager) GetRemoteFileTree(profileJSON string) (string, error) {
	// ls -R ~/.mlcremote
	cmd := "ls -R .mlcremote || echo 'No .mlcremote found'"
	out, err := m.runSSH(profileJSON, cmd)
	if err != nil {
		return "", err
	}
	return out, nil
}

// TailRemoteLogs returns the last 50 lines of the systemd service logs
func (m *Manager) TailRemoteLogs(profileJSON string) (string, error) {
	// Try common log locations/commands (Tail for Linux/Mac, PowerShell for Windows)
	// We use a chained command to support multiple platforms
	cmd := "tail -n 50 ~/.mlcremote/current.log 2>/dev/null || powershell -Command \"Get-Content .mlcremote/current.log -Tail 50\" 2>NUL || type .mlcremote\\current.log 2>NUL"

	out, err := m.runSSH(profileJSON, cmd)
	if err != nil {
		return "", err
	}
	return out, nil
}

// SessionInfo contains details about the running remote backend
type SessionInfo struct {
	Running bool   `json:"running"`
	Version string `json:"version"`
	Updated string `json:"updated"`
	Token   string `json:"token"`
}

// GetRemoteSession checks if the backend is running and retrieves version/token info
func (m *Manager) GetRemoteSession(profileJSON string) (*SessionInfo, error) {
	info := &SessionInfo{Running: false}

	// 1. Check process
	// pgrep for Linux/Mac, tasklist for Windows.
	// We chain them to support either OS without knowing it yet (simplification).
	checkCmd := fmt.Sprintf("pgrep -f \"%s.*--no-auth\" || (tasklist /FI \"IMAGENAME eq %s\" | findstr %s)", RemoteBinaryName, RemoteBinaryName, RemoteBinaryName)

	if _, err := m.runSSH(profileJSON, checkCmd); err != nil {
		return info, nil // Not running
	}
	info.Running = true

	// 2. Read install.json for version
	catCmd := "cat .mlcremote/install.json 2>/dev/null || type .mlcremote\\install.json 2>NUL"
	if out, err := m.runSSH(profileJSON, catCmd); err == nil {
		// Ignore error if unmarshall fails
		_ = json.Unmarshal([]byte(out), &info)
	}

	// 3. Read token
	tokenCmd := "cat .mlcremote/token 2>/dev/null || type .mlcremote\\token 2>NUL"
	if out, err := m.runSSH(profileJSON, tokenCmd); err == nil {
		info.Token = strings.TrimSpace(out)
	}

	return info, nil
}
