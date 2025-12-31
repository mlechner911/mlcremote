package app

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// CheckBackend checks if the dev-server binary exists on the remote host
func (a *App) CheckBackend(profileJSON string) (bool, error) {
	var p TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return false, fmt.Errorf("invalid profile JSON: %w", err)
	}
	if p.Host == "" || p.User == "" {
		return false, errors.New("missing user or host")
	}

	// Construct SSH command to check file existence
	args := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		args = append(args, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		args = append(args, p.ExtraArgs...)
	}
	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	// Check for the binary in the new location
	args = append(args, target, fmt.Sprintf("test -f ~/%s/%s", RemoteBinDir, RemoteBinaryName))

	cmd := exec.Command("ssh", args...)
	// verify functionality: exit code 0 means file exists
	if err := cmd.Run(); err != nil {
		return false, nil
	}
	return true, nil
}

// InstallBackend builds the backend locally and deploys it to the remote server
func (a *App) InstallBackend(profileJSON string) (string, error) {
	var p TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "failed", fmt.Errorf("invalid profile JSON: %w", err)
	}

	// 1. Cross-compile backend
	cwd, _ := os.Getwd()
	// Navigate up from desktop/wails to root, then to backend
	// Assuming cwd is .../desktop/wails
	backendRoot := filepath.Join(cwd, "..", "..", "backend")

	// Check if backendRoot exists to be sure
	if _, err := os.Stat(backendRoot); os.IsNotExist(err) {
		// Fallback: maybe we are running in dev mode differently?
		// Try relative to binary location if compiled?
		return "failed", fmt.Errorf("backend directory not found at %s", backendRoot)
	}

	binDir := filepath.Join(cwd, "..", "..", "bin")
	// Ensure bin dir exists
	_ = os.MkdirAll(binDir, 0755)

	destBinary := filepath.Join(binDir, "dev-server")

	// We run go build inside the backend directory so it picks up the go.mod there
	buildCmd := exec.Command("go", "build", "-ldflags", "-s -w", "-o", destBinary, "./cmd/dev-server")
	buildCmd.Dir = backendRoot
	buildCmd.Env = append(os.Environ(), "GOOS=linux", "GOARCH=amd64")

	if out, err := buildCmd.CombinedOutput(); err != nil {
		return "build-failed", fmt.Errorf("build failed: %s (dir: %s)", string(out), backendRoot)
	}

	binPath := destBinary // use absolute path for SCP

	// 2. Create remote directory structure
	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	mkdirArgs := append([]string{}, sshBaseArgs...)
	// Create ~/.mlcremote structure
	mkdirArgs = append(mkdirArgs, target, fmt.Sprintf("mkdir -p ~/%s ~/%s ~/%s", RemoteBinDir, RemoteFrontendDir, SystemdUserDir))
	if err := exec.Command("ssh", mkdirArgs...).Run(); err != nil {
		return "setup-failed", fmt.Errorf("failed to create remote directories: %w", err)
	}

	// 2.5 Stop service if running (ignore error if not exists)
	// This prevents "text file busy" when overwriting the binary
	stopArgs := append([]string{}, sshBaseArgs...)
	stopArgs = append(stopArgs, target, fmt.Sprintf("systemctl --user stop %s", ServiceName))
	_ = exec.Command("ssh", stopArgs...).Run()

	// 3. Upload binary using SCP
	scpArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		scpArgs = append(scpArgs, "-i", p.IdentityFile)
	}
	// Upload to ~/.mlcremote/bin/dev-server
	// We need to use scp args structure carefully
	scpBinArgs := append([]string{}, scpArgs...)
	scpBinArgs = append(scpBinArgs, binPath, fmt.Sprintf("%s:~/%s/%s", target, RemoteBinDir, RemoteBinaryName))

	if out, err := exec.Command("scp", scpBinArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("scp binary failed: %s", string(out))
	}

	// 3.5. Upload Frontend Assets
	// Ensure local dist exists (it should, we are running wails)
	frontendDist := filepath.Join(cwd, "frontend", "dist")
	if _, err := os.Stat(frontendDist); err == nil {
		scpDistArgs := append([]string{}, scpArgs...)
		// recursive copy
		scpDistArgs = append(scpDistArgs, "-r", frontendDist, fmt.Sprintf("%s:~/%s", target, RemoteFrontendDir))
		// first remove old frontend to be clean
		rmArgs := append([]string{}, sshBaseArgs...)
		rmArgs = append(rmArgs, target, fmt.Sprintf("rm -rf ~/%s && mkdir -p ~/%s", RemoteFrontendDir, RemoteFrontendDir))
		_ = exec.Command("ssh", rmArgs...).Run()

		if out, err := exec.Command("scp", scpDistArgs...).CombinedOutput(); err != nil {
			// ignore error? no, this is important
			fmt.Printf("warning: frontend upload failed: %s\n", string(out))
		}
	}

	// 4. Create and upload run-server.sh wrapper
	// We use text/template or just fmt.Sprintf if complex, but simple variable sub is fine.
	// Note: We use %h in systemd, but in bash we use $HOME.
	runScriptContent := fmt.Sprintf(`#!/usr/bin/env bash
set -euo pipefail
# ensure we start in the user's home so any relative paths the server relies on work
cd "$HOME"
# Exec binary with default port 8443 and static dir
# We use --no-auth because the connection is already secured via SSH tunnel
exec "$HOME/%s/%s" --port 8443 --root "$HOME" --static-dir "$HOME/%s" --no-auth
`, RemoteBinDir, RemoteBinaryName, RemoteFrontendDir)

	runScriptFile := RunScript
	_ = ioutil.WriteFile(runScriptFile, []byte(runScriptContent), 0755)
	defer os.Remove(runScriptFile)

	scpRunArgs := append([]string{}, scpArgs...)
	scpRunArgs = append(scpRunArgs, runScriptFile, fmt.Sprintf("%s:~/%s/%s", target, RemoteBaseDir, RunScript))

	if out, err := exec.Command("scp", scpRunArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("scp run-script failed: %s", string(out))
	}

	// Make script executable
	chmodArgs := append([]string{}, sshBaseArgs...)
	chmodArgs = append(chmodArgs, target, fmt.Sprintf("chmod +x ~/%s/%s ~/%s/%s", RemoteBaseDir, RunScript, RemoteBinDir, RemoteBinaryName))
	_ = exec.Command("ssh", chmodArgs...).Run()

	// 5. Create and upload systemd service file
	serviceContent := fmt.Sprintf(`[Unit]
Description=mlcremote user service
After=network.target

[Service]
Type=simple
ExecStart=%%h/%s/%s
Restart=on-failure

[Install]
WantedBy=default.target
`, RemoteBaseDir, RunScript)
	serviceFile := ServiceName
	_ = ioutil.WriteFile(serviceFile, []byte(serviceContent), 0644)
	defer os.Remove(serviceFile)

	scpServiceArgs := append([]string{}, scpArgs...)
	scpServiceArgs = append(scpServiceArgs, serviceFile, fmt.Sprintf("%s:~/%s/%s", target, SystemdUserDir, ServiceName))

	if out, err := exec.Command("scp", scpServiceArgs...).CombinedOutput(); err != nil {
		return "service-upload-failed", fmt.Errorf("failed to upload service file: %s", string(out))
	}

	// 6. Enable and start service
	// FORCE RESTART to ensure new configuration (e.g. --no-auth) picks up
	startServiceArgs := append([]string{}, sshBaseArgs...)
	startServiceArgs = append(startServiceArgs, target, fmt.Sprintf("systemctl --user daemon-reload && systemctl --user enable %s && systemctl --user restart %s", ServiceName, ServiceName))

	if out, err := exec.Command("ssh", startServiceArgs...).CombinedOutput(); err != nil {
		return "start-failed", fmt.Errorf("failed to start service: %s", string(out))
	}

	return "installed", nil
}

// SaveIdentityFile writes a base64-encoded private key payload to a temp file and returns the path.
func (a *App) SaveIdentityFile(b64 string, filename string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", fmt.Errorf("invalid base64 payload: %w", err)
	}
	tmpdir := os.TempDir()
	// sanitize filename
	outPath := fmt.Sprintf("%s/mlcremote-key-%d-%s", tmpdir, time.Now().UnixNano(), filename)
	if err := ioutil.WriteFile(outPath, data, 0600); err != nil {
		return "", fmt.Errorf("failed to write identity file: %w", err)
	}
	return outPath, nil
}
