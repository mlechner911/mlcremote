package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
)

// CheckBackend checks if the dev-server binary exists on the remote host
func (m *Manager) CheckBackend(profileJSON string) (bool, error) {
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return false, fmt.Errorf("invalid profile JSON: %w", err)
	}
	if p.Host == "" || p.User == "" {
		return false, errors.New("missing user or host")
	}

	args := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		args = append(args, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		args = append(args, p.ExtraArgs...)
	}
	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	args = append(args, target, fmt.Sprintf("test -f ~/%s/%s", RemoteBinDir, RemoteBinaryName))

	cmd := createSilentCmd("ssh", args...)
	if err := cmd.Run(); err != nil {
		return false, nil
	}
	return true, nil
}

// CheckRemoteVersion returns the version string of the remote backend or "unknown"
func (m *Manager) CheckRemoteVersion(profileJSON string) (string, error) {
	osArch, err := m.DetectRemoteOS(profileJSON)
	if err != nil {
		return "unknown", err
	}
	parts := strings.Split(osArch, "/")
	return m.CheckRemoteVersionWithOS(profileJSON, parts[0])
}

// CheckRemoteVersionWithOS returns the version string of the remote backend using known OS
func (m *Manager) CheckRemoteVersionWithOS(profileJSON string, osType string) (string, error) {
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "", fmt.Errorf("invalid profile JSON: %w", err)
	}
	if p.Host == "" || p.User == "" {
		return "", errors.New("missing user or host")
	}

	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	sys := getRemoteSystem(osType)
	binName := sys.GetBinaryName(RemoteBinaryName)

	var remotePath string
	if osType == "windows" {
		// Windows cmd.exe style path construction.
		// We use %USERPROFILE% because typical SSH sessions on Windows spawn cmd.exe or unexpanded shells
		// where '~' is not recognized. This ensures we target the correct absolute path.
		remotePath = fmt.Sprintf("%%USERPROFILE%%\\.mlcremote\\bin\\%s", binName)
	} else {
		// Unix style pathing (Standard)
		remotePath = fmt.Sprintf("$HOME/.mlcremote/bin/%s", binName)
	}

	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, fmt.Sprintf("\"%s\" --version", remotePath))

	out, err := createSilentCmd("ssh", cmdArgs...).Output()
	if err != nil {
		return "unknown", nil
	}
	return strings.TrimSpace(string(out)), nil
}

// IsServerRunning checks if the backend is already active on the remote host
func (m *Manager) IsServerRunning(profileJSON string, osString string) (bool, error) {
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return false, fmt.Errorf("invalid profile JSON: %w", err)
	}

	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	targetOS := "linux"
	if strings.Contains(osString, "/") {
		targetOS = strings.Split(osString, "/")[0]
	} else if osString == "windows" {
		targetOS = "windows"
	}

	var checkCmd string
	if targetOS == "linux" {
		checkCmd = fmt.Sprintf("pgrep -f \"%s.*--no-auth\"", RemoteBinaryName)
	} else if targetOS == "darwin" {
		checkCmd = fmt.Sprintf("pgrep -f \"%s.*--no-auth\"", RemoteBinaryName)
	} else if targetOS == "windows" {
		checkCmd = fmt.Sprintf("tasklist /FI \"IMAGENAME eq %s\" | findstr %s", RemoteBinaryName, RemoteBinaryName)
	}

	if checkCmd == "" {
		return false, nil
	}

	args := append([]string{}, sshBaseArgs...)
	args = append(args, target, checkCmd)

	if err := createSilentCmd("ssh", args...).Run(); err != nil {
		return false, nil
	}
	return true, nil
}

// GetRemoteFileTree returns a string representation of the remote .mlcremote directory tree
func (m *Manager) GetRemoteFileTree(profileJSON string) (string, error) {
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "", fmt.Errorf("invalid profile JSON: %w", err)
	}

	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	// ls -R ~/.mlcremote
	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, "ls -R .mlcremote || echo 'No .mlcremote found'")

	out, err := createSilentCmd("ssh", cmdArgs...).Output()
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// TailRemoteLogs returns the last 50 lines of the systemd service logs
func (m *Manager) TailRemoteLogs(profileJSON string) (string, error) {
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "", fmt.Errorf("invalid profile JSON: %w", err)
	}

	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	// Try common log locations/commands (Tail for Linux/Mac, PowerShell for Windows)
	// We use a chained command to support multiple platforms
	cmd := "tail -n 50 .mlcremote/current.log 2>/dev/null || powershell -Command \"Get-Content .mlcremote/current.log -Tail 50\" 2>NUL || type .mlcremote\\current.log 2>NUL"

	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, cmd)

	out, err := createSilentCmd("ssh", cmdArgs...).CombinedOutput()
	if err != nil {
		return "", err
	}
	return string(out), nil
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
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return nil, fmt.Errorf("invalid profile JSON: %w", err)
	}

	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	info := &SessionInfo{Running: false}

	// 1. Check process
	// pgrep for Linux/Mac, tasklist for Windows.
	// We chain them to support either OS without knowing it yet (simplification).
	checkCmd := fmt.Sprintf("pgrep -f \"%s.*--no-auth\" || (tasklist /FI \"IMAGENAME eq %s\" | findstr %s)", RemoteBinaryName, RemoteBinaryName, RemoteBinaryName)

	// We run check first. If it fails, running is false.
	checkArgs := append([]string{}, sshBaseArgs...)
	checkArgs = append(checkArgs, target, checkCmd)

	if err := createSilentCmd("ssh", checkArgs...).Run(); err != nil {
		return info, nil // Not running
	}
	info.Running = true

	// 2. Read install.json for version
	catCmd := "cat .mlcremote/install.json 2>/dev/null || type .mlcremote\\install.json 2>NUL"
	args := append([]string{}, sshBaseArgs...)
	args = append(args, target, catCmd)

	if out, err := createSilentCmd("ssh", args...).Output(); err == nil {
		// Ignore error if unmarshall fails
		_ = json.Unmarshal(out, &info)
	}

	// 3. Read token
	tokenCmd := "cat .mlcremote/token 2>/dev/null || type .mlcremote\\token 2>NUL"
	tokenArgs := append([]string{}, sshBaseArgs...)
	tokenArgs = append(tokenArgs, target, tokenCmd)
	if out, err := createSilentCmd("ssh", tokenArgs...).Output(); err == nil {
		info.Token = strings.TrimSpace(string(out))
	}

	return info, nil
}
