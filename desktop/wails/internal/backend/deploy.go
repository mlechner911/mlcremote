package backend

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/fs"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
)

// DetectRemoteOS attempts to determine the remote operating system and architecture
func (m *Manager) DetectRemoteOS(profileJSON string) (string, error) {
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

	probeCmd := "uname -sm || echo 'windows-check'"

	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, probeCmd)

	cmd := createSilentCmd("ssh", cmdArgs...)
	outBytes, err := cmd.CombinedOutput()
	output := strings.TrimSpace(string(outBytes))

	if err != nil {
		// Check for auth errors in output
		if strings.Contains(output, "Permission denied") || strings.Contains(output, "publickey") {
			return "", fmt.Errorf("ssh: permission denied")
		}
		if strings.Contains(err.Error(), "exit status 255") {
			return "", fmt.Errorf("ssh-unreachable: %s", output)
		}
		return "", fmt.Errorf("ssh probe failed: %s (%w)", output, err)
	}

	outputLower := strings.ToLower(output)

	if strings.Contains(outputLower, "linux") {
		arch := "amd64" // default
		if strings.Contains(outputLower, "aarch64") || strings.Contains(outputLower, "arm64") {
			arch = "arm64"
		}
		return fmt.Sprintf("linux/%s", arch), nil
	}

	if strings.Contains(outputLower, "darwin") {
		arch := "amd64"
		if strings.Contains(outputLower, "arm64") {
			arch = "arm64"
		}
		return fmt.Sprintf("darwin/%s", arch), nil
	}

	if strings.Contains(outputLower, "windows-check") || output == "" {
		winArgs := append([]string{}, sshBaseArgs...)
		winArgs = append(winArgs, target, "cmd /c ver")
		if validOut, err := createSilentCmd("ssh", winArgs...).Output(); err == nil {
			if strings.Contains(strings.ToLower(string(validOut)), "windows") {
				return "windows/amd64", nil
			}
		}
	}

	return "unknown", nil
}

// DeployAgent ensures the correct binary and assets are on the remote host.
// It generates a secure token if one is not provided (though in this implementation the token is passed in).
// The function handles checking MD5 checksums to avoid unnecessary uploads.
func (m *Manager) DeployAgent(profileJSON string, osArch string, token string) (string, error) {
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "failed", fmt.Errorf("invalid profile JSON: %w", err)
	}

	parts := strings.Split(osArch, "/")
	if len(parts) != 2 {
		return "failed", fmt.Errorf("invalid os/arch format: %s", osArch)
	}
	targetOS, targetArch := parts[0], parts[1]

	tmpDir, err := ioutil.TempDir("", "mlcremote-install")
	if err != nil {
		return "setup-failed", fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	binName := "dev-server"
	if targetOS == "windows" {
		binName = "dev-server.exe"
	}

	payloadPath := fmt.Sprintf("assets/payload/%s/%s/%s", targetOS, targetArch, binName)

	binContent, err := fs.ReadFile(m.payload, payloadPath)
	if err != nil {
		return "setup-failed", fmt.Errorf("payload binary not found for %s: %w", osArch, err)
	}

	binPath := filepath.Join(tmpDir, binName)
	if err := ioutil.WriteFile(binPath, binContent, 0755); err != nil {
		return "setup-failed", fmt.Errorf("failed to write backend binary: %w", err)
	}

	// Make directories
	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	remoteBinDir := ".mlcremote/bin"
	remoteFrontendDir := ".mlcremote/frontend"

	mkdirCmd := fmt.Sprintf("mkdir -p ~/%s ~/%s", remoteBinDir, remoteFrontendDir)
	if targetOS == "windows" {
		mkdirCmd = "mkdir .mlcremote\\bin .mlcremote\\frontend 2>NUL || echo OK"
	}

	mkdirArgs := append([]string{}, sshBaseArgs...)
	mkdirArgs = append(mkdirArgs, target, mkdirCmd)
	_ = createSilentCmd("ssh", mkdirArgs...).Run()

	// Check MD5
	skipBinary := false
	localSum := fmt.Sprintf("%x", md5.Sum(binContent))

	var remoteSumCmd string
	if targetOS == "linux" {
		remoteSumCmd = fmt.Sprintf("md5sum ~/%s/%s | awk '{print $1}'", remoteBinDir, binName)
	} else if targetOS == "darwin" {
		remoteSumCmd = fmt.Sprintf("md5 -q ~/%s/%s", remoteBinDir, binName)
	} else if targetOS == "windows" {
		remoteSumCmd = fmt.Sprintf("powershell -Command \"(Get-FileHash -Algorithm MD5 .mlcremote\\bin\\%s).Hash\"", binName)
	}

	if remoteSumCmd != "" {
		sumArgs := append([]string{}, sshBaseArgs...)
		sumArgs = append(sumArgs, target, remoteSumCmd)
		if out, err := createSilentCmd("ssh", sumArgs...).Output(); err == nil {
			remoteSum := strings.TrimSpace(string(out))
			if strings.EqualFold(remoteSum, localSum) {
				fmt.Println("Binary up to date, skipping upload.")
				skipBinary = true
			}
		}
	}

	// Upload Logic
	scpArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		scpArgs = append(scpArgs, "-i", p.IdentityFile)
	}

	killCmd := fmt.Sprintf("systemctl --user stop %s 2>/dev/null; pkill -f %s || true", ServiceName, binName)
	if targetOS == "windows" {
		killCmd = fmt.Sprintf("taskkill /IM %s /F || echo OK", binName)
	}
	killArgs := append([]string{}, sshBaseArgs...)
	killArgs = append(killArgs, target, killCmd)
	_ = createSilentCmd("ssh", killArgs...).Run()

	time.Sleep(500 * time.Millisecond)

	if !skipBinary {
		scpBinArgs := append([]string{}, scpArgs...)
		scpBinArgs = append(scpBinArgs, binPath, fmt.Sprintf("%s:~/%s/%s", target, remoteBinDir, binName))
		if out, err := createSilentCmd("scp", scpBinArgs...).CombinedOutput(); err != nil {
			return "upload-failed", fmt.Errorf("scp binary failed: %s", string(out))
		}
	}

	fmt.Println("Frontend upload skipped (using local desktop view).")

	// Meta file
	metaContent := fmt.Sprintf(`{"version": "1.0.1", "updated": "%s", "os": "%s", "arch": "%s"}`, time.Now().Format(time.RFC3339), targetOS, targetArch)
	metaPath := filepath.Join(tmpDir, "install.json")
	_ = ioutil.WriteFile(metaPath, []byte(metaContent), 0644)

	scpMetaArgs := append([]string{}, scpArgs...)
	scpMetaArgs = append(scpMetaArgs, metaPath, fmt.Sprintf("%s:~/.mlcremote/install.json", target))
	_ = createSilentCmd("scp", scpMetaArgs...).Run()

	if targetOS != "windows" {
		chmodArgs := append([]string{}, sshBaseArgs...)
		chmodArgs = append(chmodArgs, target, fmt.Sprintf("chmod +x ~/%s/%s", remoteBinDir, binName))
		_ = createSilentCmd("ssh", chmodArgs...).Run()
	}

	// Start the backend
	fmt.Println("Starting remote backend...")
	var startCmd string
	authArg := "--no-auth"
	if token != "" {
		authArg = fmt.Sprintf("-token=%s", token)
	}

	if targetOS == "windows" {
		// Use PowerShell to start hidden and detached
		startCmd = fmt.Sprintf("powershell -Command \"Start-Process -FilePath .mlcremote\\bin\\%s -ArgumentList '%s' -WindowStyle Hidden\"", binName, authArg)
	} else {
		// Linux/Darwin: nohup
		// We use running inside the home directory context usually, but explicit path is safer
		startCmd = fmt.Sprintf("nohup ~/%s/%s %s > ~/%s/current.log 2>&1 &", remoteBinDir, binName, authArg, remoteBinDir)
	}

	startArgs := append([]string{}, sshBaseArgs...)
	startArgs = append(startArgs, target, startCmd)
	if err := createSilentCmd("ssh", startArgs...).Run(); err != nil {
		fmt.Printf("Warning: failed to start backend: %v\n", err)
	} else {
		fmt.Println("Backend started.")
		// Give it a moment to bind port
		time.Sleep(1 * time.Second)
	}

	return "deployed", nil
}

// SaveIdentityFile writes a base64-encoded private key payload to a temp file and returns the path.
func (m *Manager) SaveIdentityFile(b64 string, filename string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", err
	}

	tmpDir := os.TempDir() // or use UserConfigDir
	path := filepath.Join(tmpDir, filename)

	// Write with 0600 permissions
	if err := os.WriteFile(path, decoded, 0600); err != nil {
		return "", err
	}
	return path, nil
}
