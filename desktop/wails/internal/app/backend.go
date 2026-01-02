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

// CheckRemoteVersion returns the version string of the remote backend or "unknown"
func (a *App) CheckRemoteVersion(profileJSON string) (string, error) {
	var p TunnelProfile
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

	// Exec: dev-server --version
	// We need to assume the binary is in the standard location or check PATH?
	// The install puts it in ~/%s (RemoteBinDir)
	// Let's try executing it directly from there.
	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, fmt.Sprintf("~/%s/%s --version", RemoteBinDir, RemoteBinaryName))

	out, err := createSilentCmd("ssh", cmdArgs...).Output()
	if err != nil {
		// Try fallback? Or just return unknown
		// Maybe it's an old version that doesn't support --version?
		// In that case, it might fail or print nothing useful.
		return "unknown", nil
	}
	return strings.TrimSpace(string(out)), nil
}

// DetectRemoteOS attempts to determine the remote operating system and architecture
func (a *App) DetectRemoteOS(profileJSON string) (string, error) {
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

	// Strategy: Exec a single compound command to probe OS and Arch
	// We want output like "Linux x86_64" or "Darwin arm64" or "Windows..."
	// "uname -sm" works on Linux and Mac.
	// On Windows, uname might not exist, but we can try it first.

	probeCmd := "uname -sm || echo 'windows-check'"

	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, probeCmd)

	outBytes, err := createSilentCmd("ssh", cmdArgs...).Output()
	if err != nil {
		// If SSH fails completely
		return "", fmt.Errorf("ssh probe failed: %w", err)
	}
	output := strings.TrimSpace(string(outBytes))

	// Parse Output
	// Linux x86_64 -> linux/amd64
	// Darwin arm64 -> darwin/arm64
	// Darwin x86_64 -> darwin/amd64

	outputLower := strings.ToLower(output)

	if strings.Contains(outputLower, "linux") {
		arch := "amd64" // default
		if strings.Contains(outputLower, "aarch64") || strings.Contains(outputLower, "arm64") {
			arch = "arm64"
		}
		// We only support amd64 linux for now based on Makefile, but let's return truth
		return fmt.Sprintf("linux/%s", arch), nil
	}

	if strings.Contains(outputLower, "darwin") {
		arch := "amd64"
		if strings.Contains(outputLower, "arm64") {
			arch = "arm64"
		}
		return fmt.Sprintf("darwin/%s", arch), nil
	}

	// Windows detection fallback
	// If uname failed or printed "windows-check", we assume it might be windows.
	// Try a windows specific command to confirm.
	if strings.Contains(outputLower, "windows-check") || output == "" {
		winArgs := append([]string{}, sshBaseArgs...)
		winArgs = append(winArgs, target, "cmd /c ver")
		if validOut, err := createSilentCmd("ssh", winArgs...).Output(); err == nil {
			if strings.Contains(strings.ToLower(string(validOut)), "windows") {
				// Assume amd64 for Windows for now
				return "windows/amd64", nil
			}
		}
	}

	return "unknown", nil
}

// DeployAgent ensures the correct binary and assets are on the remote host
// osArch is the string returned by DetectRemoteOS (e.g. "linux/amd64", "windows/amd64")
func (a *App) DeployAgent(profileJSON string, osArch string) (string, error) {
	var p TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "failed", fmt.Errorf("invalid profile JSON: %w", err)
	}

	parts := strings.Split(osArch, "/")
	if len(parts) != 2 {
		return "failed", fmt.Errorf("invalid os/arch format: %s", osArch)
	}
	targetOS, targetArch := parts[0], parts[1]

	// 1. Prepare Payload
	tmpDir, err := ioutil.TempDir("", "mlcremote-install")
	if err != nil {
		return "setup-failed", fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// A. Identify Correct Binary Source
	// Map "linux/amd64" -> "assets/payload/linux/amd64/dev-server"
	// Map "windows/amd64" -> "assets/payload/windows/amd64/dev-server.exe"

	binName := "dev-server"
	if targetOS == "windows" {
		binName = "dev-server.exe"
	}

	payloadPath := fmt.Sprintf("assets/payload/%s/%s/%s", targetOS, targetArch, binName)

	binContent, err := fs.ReadFile(a.payload, payloadPath)
	if err != nil {
		return "setup-failed", fmt.Errorf("payload binary not found for %s: %w", osArch, err)
	}

	binPath := filepath.Join(tmpDir, binName)
	if err := ioutil.WriteFile(binPath, binContent, 0755); err != nil {
		return "setup-failed", fmt.Errorf("failed to write backend binary: %w", err)
	}

	// B. Extract Frontend Assets (Common)
	frontendSrcDir := "assets/payload/frontend-dist"
	frontendTmpDir := filepath.Join(tmpDir, "frontend")
	if err := os.MkdirAll(frontendTmpDir, 0755); err != nil {
		return "setup-failed", fmt.Errorf("failed to create frontend temp dir: %w", err)
	}

	// ... WalkDir and copy logic (Assuming same as before, simplified for this snippet) ...
	// REUSING existing frontend extraction logic
	err = fs.WalkDir(a.payload, frontendSrcDir, func(fpath string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relPath := strings.TrimPrefix(fpath, frontendSrcDir)
		relPath = strings.TrimPrefix(relPath, "/")
		if relPath == "" || relPath == "." {
			return nil
		}
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
		return "setup-failed", fmt.Errorf("failed to extract frontend: %w", err)
	}

	// 2. Prepare Remote Environment
	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	// Remote Paths handling for Windows vs Unix
	// We assume standard unix-like paths for SCP even on Windows (OpenSSH usually handles / ~ /)
	// But mkdir might need care on Windows CMD.
	// Simplification: We assume OpenSSH + Git Bash or standard execution on Windows often supports mkdir.
	// If not, we might need OS specific mkdir.

	remoteBinDir := ".mlcremote/bin"
	remoteFrontendDir := ".mlcremote/frontend"

	mkdirCmd := fmt.Sprintf("mkdir -p ~/%s ~/%s", remoteBinDir, remoteFrontendDir)
	// On Windows CMD, `mkdir` works but `-p` might not. "mkdir a\b" works.
	if targetOS == "windows" {
		// Try powershell or cmd safe mkdir
		mkdirCmd = "mkdir .mlcremote\\bin .mlcremote\\frontend 2>NUL || echo OK"
	}

	mkdirArgs := append([]string{}, sshBaseArgs...)
	mkdirArgs = append(mkdirArgs, target, mkdirCmd)
	_ = createSilentCmd("ssh", mkdirArgs...).Run()

	// 3. Upload Binary
	scpArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		scpArgs = append(scpArgs, "-i", p.IdentityFile)
	}

	// kill existing if running (agent mode cleanup or update)
	// Linux/Mac: pkill. Windows: taskkill
	killCmd := fmt.Sprintf("pkill -f %s || true", binName)
	if targetOS == "windows" {
		killCmd = fmt.Sprintf("taskkill /IM %s /F || echo OK", binName)
	}
	killArgs := append([]string{}, sshBaseArgs...)
	killArgs = append(killArgs, target, killCmd)
	_ = createSilentCmd("ssh", killArgs...).Run()

	// Wait buffer
	time.Sleep(500 * time.Millisecond)

	scpBinArgs := append([]string{}, scpArgs...)
	scpBinArgs = append(scpBinArgs, binPath, fmt.Sprintf("%s:~/%s/%s", target, remoteBinDir, binName))
	if out, err := createSilentCmd("scp", scpBinArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("scp binary failed: %s", string(out))
	}

	// 3.5 Upload Frontend (Atomic Swap or Overwrite)
	// For simplicity in Agent Mode, simple recursive copy is often okay, but let's stick to cleaning old first
	// to avoid stale files.

	// Quick clean old frontend
	cleanCmd := fmt.Sprintf("rm -rf ~/%s/*", remoteFrontendDir) // * to keep dir
	if targetOS == "windows" {
		cleanCmd = "del /S /Q .mlcremote\\frontend\\* || echo OK"
	}
	cleanArgs := append([]string{}, sshBaseArgs...)
	cleanArgs = append(cleanArgs, target, cleanCmd)
	_ = createSilentCmd("ssh", cleanArgs...).Run()

	scpFrontendArgs := append([]string{}, scpArgs...)
	scpFrontendArgs = append(scpFrontendArgs, "-r", fmt.Sprintf("%s/.", frontendTmpDir), fmt.Sprintf("%s:~/%s", target, remoteFrontendDir))
	if out, err := createSilentCmd("scp", scpFrontendArgs...).CombinedOutput(); err != nil {
		return "upload-failed", fmt.Errorf("scp frontend failed: %s", string(out))
	}

	// 4. Create metadata file (install.json)
	// We write this LOCALLY then upload
	metaContent := fmt.Sprintf(`{"version": "1.0.0", "updated": "%s", "os": "%s", "arch": "%s"}`, time.Now().Format(time.RFC3339), targetOS, targetArch)
	metaPath := filepath.Join(tmpDir, "install.json")
	_ = ioutil.WriteFile(metaPath, []byte(metaContent), 0644)

	scpMetaArgs := append([]string{}, scpArgs...)
	scpMetaArgs = append(scpMetaArgs, metaPath, fmt.Sprintf("%s:~/.mlcremote/install.json", target))
	_ = createSilentCmd("scp", scpMetaArgs...).Run()

	// 5. Unix: Make Executable
	if targetOS != "windows" {
		chmodArgs := append([]string{}, sshBaseArgs...)
		chmodArgs = append(chmodArgs, target, fmt.Sprintf("chmod +x ~/%s/%s", remoteBinDir, binName))
		_ = createSilentCmd("ssh", chmodArgs...).Run()
	}

	return "deployed", nil
}

// IsServerRunning checks if the backend is already active on the remote host
func (a *App) IsServerRunning(profileJSON string, osString string) (bool, error) {
	var p TunnelProfile
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

	// OS String comes from DetectRemoteOS e.g. "linux/amd64" or "windows/amd64"
	targetOS := "linux"
	if strings.Contains(osString, "/") {
		targetOS = strings.Split(osString, "/")[0]
	} else if osString == "windows" {
		targetOS = "windows"
	}

	var checkCmd string

	// 1. Logic for Linux: Preferred systemd check, fallback to pgrep
	if targetOS == "linux" {
		// Check systemd service first
		checkCmd = fmt.Sprintf("systemctl --user is-active %s || pgrep -f %s", ServiceName, RemoteBinaryName)
	} else if targetOS == "darwin" {
		// MacOS: pgrep
		checkCmd = fmt.Sprintf("pgrep -f %s", RemoteBinaryName)
	} else if targetOS == "windows" {
		// Windows: tasklist
		checkCmd = "tasklist /FI \"IMAGENAME eq dev-server.exe\" | findstr \"dev-server.exe\""
	} else {
		return false, nil
	}

	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, checkCmd)

	err := createSilentCmd("ssh", cmdArgs...).Run()

	// Exit code 0 means active/found
	return err == nil, nil
}

// Legacy stub to satisfy compiler until refactor complete, or we can just remove InstallBackend
func (a *App) InstallBackend(profileJSON string) (string, error) {
	return a.DeployAgent(profileJSON, "linux/amd64") // Default fallback
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
