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

	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, fmt.Sprintf("~/%s/%s --version", RemoteBinDir, RemoteBinaryName))

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

	// journalctl --user -u mlcremote.service -n 50 --no-pager
	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, fmt.Sprintf("journalctl --user -u %s -n 50 --no-pager", ServiceName))

	out, err := createSilentCmd("ssh", cmdArgs...).Output()
	if err != nil {
		return "", err
	}
	return string(out), nil
}
