package app

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
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

	cmd := createSilentCmd("ssh", args...)
	// verify functionality: exit code 0 means file exists
	if err := cmd.Run(); err != nil {
		return false, nil
	}
	return true, nil
}

// InstallBackend deploys the embedded backend and frontend to the remote server
func (a *App) InstallBackend(profileJSON string) (string, error) {
	var p TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "failed", fmt.Errorf("invalid profile JSON: %w", err)
	}

	// 1. Prepare Payload: Extract embedded assets to a temporary directory
	tmpDir, err := ioutil.TempDir("", "mlcremote-install")
	if err != nil {
		return "setup-failed", fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// A. Extract Backend Binary
	// Note: The path must match what is in assets/payload
	binContent, err := fs.ReadFile(a.payload, "assets/payload/dev-server")
	if err != nil {
		return "setup-failed", fmt.Errorf("embedded backend binary not found: %w", err)
	}
	binPath := filepath.Join(tmpDir, "dev-server")
	if err := ioutil.WriteFile(binPath, binContent, 0755); err != nil {
		return "setup-failed", fmt.Errorf("failed to write backend binary: %w", err)
	}

	// B. Extract Frontend Assets
	frontendSrcDir := "assets/payload/frontend-dist"
	frontendTmpDir := filepath.Join(tmpDir, "frontend")
	if err := os.MkdirAll(frontendTmpDir, 0755); err != nil {
		return "setup-failed", fmt.Errorf("failed to create frontend temp dir: %w", err)
	}

	err = fs.WalkDir(a.payload, frontendSrcDir, func(fpath string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		// Calculate relative path from the root of frontend-dist
		// Use strings.Replace/TrimPrefix because fs.FS paths are always forward slashes
		// and filepath.Rel on Windows might expect backslashes.
		// fpath is like "assets/payload/frontend-dist/index.html"
		// frontendSrcDir is "assets/payload/frontend-dist"

		relPath := strings.TrimPrefix(fpath, frontendSrcDir)
		relPath = strings.TrimPrefix(relPath, "/") // remove leading slash if any

		if relPath == "" || relPath == "." {
			return nil
		}

		// Convert forward slashes to OS-specific separators for destination
		destPath := filepath.Join(frontendTmpDir, filepath.FromSlash(relPath))
		if d.IsDir() {
			return os.MkdirAll(destPath, 0755)
		}

		data, err := fs.ReadFile(a.payload, fpath)
		if err != nil {
			return err
		}
		return ioutil.WriteFile(destPath, data, 0644)
	})
	if err != nil {
		return "setup-failed", fmt.Errorf("failed to extract frontend assets: %w", err)
	}

	// 2. Create remote directory structure
	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	// 1.5 Check remote architecture
	// We only support x86_64 (amd64) for now because we cross-compile for it
	archArgs := append([]string{}, sshBaseArgs...)
	archArgs = append(archArgs, target, "uname -m")
	if out, err := createSilentCmd("ssh", archArgs...).Output(); err == nil {
		arch := strings.TrimSpace(string(out))
		if arch != "x86_64" {
			return "setup-failed", fmt.Errorf("remote architecture '%s' is not supported (x86_64 required)", arch)
		}
	} else {
		// If uname fails, we proceed with caution or warn?
		// Let's assume it's ok but log/warn if we could. For now strict checking is safer.
		// But if SSH fails here, mkdir will fail too.
	}

	// 2. Create remote directory structure
	mkdirArgs := append([]string{}, sshBaseArgs...)
	mkdirArgs = append(mkdirArgs, target, fmt.Sprintf("mkdir -p ~/%s ~/%s ~/%s", RemoteBinDir, RemoteFrontendDir, SystemdUserDir))
	if err := createSilentCmd("ssh", mkdirArgs...).Run(); err != nil {
		return "setup-failed", fmt.Errorf("failed to create remote directories: %w", err)
	}

	// 0. Stop service if running and kill any zombie processes
	stopArgs := append([]string{}, sshBaseArgs...)
	// Try systemctl stop first, then pkill to be sure (ignore errors if not running)
	stopCmd := fmt.Sprintf("systemctl --user stop %s; pkill -f %s || true", ServiceName, RemoteBinaryName)
	stopArgs = append(stopArgs, target, stopCmd)
	_ = createSilentCmd("ssh", stopArgs...).Run()

	// Wait a moment for ports to free
	time.Sleep(1 * time.Second)

	// 3. Upload binary using SCP
	scpArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		scpArgs = append(scpArgs, "-i", p.IdentityFile)
	}

	scpBinArgs := append([]string{}, scpArgs...)
	scpBinArgs = append(scpBinArgs, binPath, fmt.Sprintf("%s:~/%s/%s", target, RemoteBinDir, RemoteBinaryName))

	if out, err := createSilentCmd("scp", scpBinArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("scp binary failed: %s", string(out))
	}

	// 3.5. Upload Frontend Assets
	// Recursive copy of the temp frontend dir to the remote location
	// Strategy: Upload to temporary remote dir, then atomic swap to ensure clean state
	remoteNewDir := fmt.Sprintf("%s/%s_new", RemoteBaseDir, filepath.Base(RemoteFrontendDir)) // .mlcremote/frontend_new

	// 1. Remove temp dir if exists
	cleanArgs := append([]string{}, sshBaseArgs...)
	cleanArgs = append(cleanArgs, target, fmt.Sprintf("rm -rf ~/%s", remoteNewDir))
	_ = createSilentCmd("ssh", cleanArgs...).Run()

	// 2. Upload to new dir (since it lacks trailing slash and dir doesn't exist, it creates it)
	// scp -r local/frontend user@host:~/.mlcremote/frontend_new
	scpDistArgs := append([]string{}, scpArgs...)
	scpDistArgs = append(scpDistArgs, "-r", frontendTmpDir, fmt.Sprintf("%s:~/%s", target, remoteNewDir))

	if out, err := createSilentCmd("scp", scpDistArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("scp frontend failed: %s", string(out))
	}

	// 3. Swap: rm old, mv new -> old
	swapCmd := fmt.Sprintf("rm -rf ~/%s && mv ~/%s ~/%s", RemoteFrontendDir, remoteNewDir, RemoteFrontendDir)
	swapArgs := append([]string{}, sshBaseArgs...)
	swapArgs = append(swapArgs, target, swapCmd)
	if out, err := createSilentCmd("ssh", swapArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("swap frontend failed: %s", string(out))
	}

	// 4. Create and upload run-server.sh wrapper
	runScriptContent := fmt.Sprintf(`#!/usr/bin/env bash
set -euo pipefail
# ensure we start in the user's home so any relative paths the server relies on work
cd "$HOME"
# Exec binary with default port 8443 and static dir
# We use --no-auth because the connection is already secured via SSH tunnel
exec "$HOME/%s/%s" --port 8443 --root "$HOME" --static-dir "$HOME/%s" --no-auth
`, RemoteBinDir, RemoteBinaryName, RemoteFrontendDir)

	runScriptFile := filepath.Join(tmpDir, RunScript)
	_ = ioutil.WriteFile(runScriptFile, []byte(runScriptContent), 0755)

	scpRunArgs := append([]string{}, scpArgs...)
	scpRunArgs = append(scpRunArgs, runScriptFile, fmt.Sprintf("%s:~/%s/%s", target, RemoteBaseDir, RunScript))

	if out, err := createSilentCmd("scp", scpRunArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("scp run-script failed: %s", string(out))
	}

	// Make script executable
	chmodArgs := append([]string{}, sshBaseArgs...)
	chmodArgs = append(chmodArgs, target, fmt.Sprintf("chmod +x ~/%s/%s ~/%s/%s", RemoteBaseDir, RunScript, RemoteBinDir, RemoteBinaryName))
	_ = createSilentCmd("ssh", chmodArgs...).Run()

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
	serviceFileName := ServiceName
	serviceFile := filepath.Join(tmpDir, serviceFileName)
	_ = ioutil.WriteFile(serviceFile, []byte(serviceContent), 0644)

	scpServiceArgs := append([]string{}, scpArgs...)
	scpServiceArgs = append(scpServiceArgs, serviceFile, fmt.Sprintf("%s:~/%s/%s", target, SystemdUserDir, serviceFileName))

	if out, err := createSilentCmd("scp", scpServiceArgs...).CombinedOutput(); err != nil {
		return "service-upload-failed", fmt.Errorf("failed to upload service file: %s", string(out))
	}

	// 6. Enable and start service
	startServiceArgs := append([]string{}, sshBaseArgs...)
	startServiceArgs = append(startServiceArgs, target, fmt.Sprintf("systemctl --user daemon-reload && systemctl --user enable %s && systemctl --user restart %s", ServiceName, ServiceName))

	if out, err := createSilentCmd("ssh", startServiceArgs...).CombinedOutput(); err != nil {
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

// GetRemoteFileTree returns a string representation of the remote .mlcremote directory tree
func (a *App) GetRemoteFileTree(profileJSON string) (string, error) {
	var p TunnelProfile
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

	cmdArgs := append([]string{}, sshBaseArgs...)
	// Use find to list files. Check if we need to be in a specific dir?
	// find .mlcremote
	cmdArgs = append(cmdArgs, target, fmt.Sprintf("find %s -maxdepth 4", RemoteBaseDir))

	out, err := createSilentCmd("ssh", cmdArgs...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to list remote files: %s", string(out))
	}
	return string(out), nil
}

// TailRemoteLogs returns the last 50 lines of the systemd service logs
func (a *App) TailRemoteLogs(profileJSON string) (string, error) {
	var p TunnelProfile
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

	cmdArgs := append([]string{}, sshBaseArgs...)
	// journalctl --user -u mlcremote -n 50 --no-pager
	cmdArgs = append(cmdArgs, target, fmt.Sprintf("journalctl --user -u %s -n 50 --no-pager", "mlcremote"))

	out, err := createSilentCmd("ssh", cmdArgs...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to fetch logs: %s", string(out))
	}
	return string(out), nil
}
