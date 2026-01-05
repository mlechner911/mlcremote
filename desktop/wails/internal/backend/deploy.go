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
	"strconv"
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
// It generates a secure session token if one is not provided (though in this implementation the token is passed in).
// The function handles checking MD5 checksums to avoid unnecessary uploads.
func (m *Manager) DeployAgent(profileJSON string, osArch string, token string, forceNew bool) (string, error) {
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

	// Check if already running (ONLY if not forcing new)
	if !forceNew {
		if running, _ := m.IsServerRunning(profileJSON, fmt.Sprintf("%s/%s", targetOS, targetArch)); running {
			// Try to read existing token
			tokenCmd := fmt.Sprintf("cat ~/%s/token", ".mlcremote")
			tokenArgs := append([]string{}, sshBaseArgs...)
			tokenArgs = append(tokenArgs, target, tokenCmd)
			if out, err := createSilentCmd("ssh", tokenArgs...).Output(); err == nil {
				existingToken := strings.TrimSpace(string(out))
				if existingToken != "" {
					fmt.Println("Backend already running, reusing session.")
					// Assume default port 8443 for existing sessions (unless we read port from somewhere else, but default is 8443)
					return fmt.Sprintf("deployed:8443:%s", existingToken), nil
				}
			}
			// If running but cannot read token, we proceed to restart (overwrite)
		}
	}

	// Upload Logic
	scpArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		scpArgs = append(scpArgs, "-i", p.IdentityFile)
	}

	// Kill Logic (ONLY if not forcing new)
	if !forceNew {
		killCmd := fmt.Sprintf("systemctl --user stop %s 2>/dev/null; pkill -f %s || true", ServiceName, binName)
		if targetOS == "windows" {
			killCmd = fmt.Sprintf("taskkill /IM %s /F || echo OK", binName)
		}
		killArgs := append([]string{}, sshBaseArgs...)
		killArgs = append(killArgs, target, killCmd)
		_ = createSilentCmd("ssh", killArgs...).Run()
		time.Sleep(500 * time.Millisecond)
	}

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

	// Save token to remote file for future sessions (ONLY if default session)
	// If forceNew, we don't overwrite the default token file, or we accept this new one becomes default?
	// Let's protect the default session if we are parallel.
	if token != "" && !forceNew {
		tokenPath := filepath.Join(tmpDir, "token")
		_ = ioutil.WriteFile(tokenPath, []byte(token), 0600)
		scpTokenArgs := append([]string{}, scpArgs...)
		scpTokenArgs = append(scpTokenArgs, tokenPath, fmt.Sprintf("%s:~/.mlcremote/token", target))
		_ = createSilentCmd("scp", scpTokenArgs...).Run()
	}

	// Start the backend
	fmt.Println("Starting remote backend...")
	var startCmd string
	authArg := "--no-auth"
	if token != "" {
		authArg = fmt.Sprintf("-token=%s", token)
	}

	// Port configuration
	targetPort := 8443
	portArg := "-port=8443"
	if forceNew {
		targetPort = 0 // Will resolve later
		portArg = "-port=0"
	}

	// Log file
	logFile := "current.log"
	if forceNew {
		logFile = fmt.Sprintf("session-%d.log", time.Now().Unix())
	}

	if targetOS == "windows" {
		// Use PowerShell to start hidden and detached
		startCmd = fmt.Sprintf("powershell -Command \"Start-Process -FilePath .mlcremote\\bin\\%s -ArgumentList '%s %s' -RedirectStandardOutput .mlcremote\\%s -RedirectStandardError .mlcremote\\%s -WindowStyle Hidden\"", binName, authArg, portArg, logFile, logFile)
	} else {
		// Linux/Darwin: nohup
		startCmd = fmt.Sprintf("nohup ~/%s/%s %s %s > ~/%s/%s 2>&1 &", remoteBinDir, binName, authArg, portArg, remoteBinDir, logFile)
	}

	startArgs := append([]string{}, sshBaseArgs...)
	startArgs = append(startArgs, target, startCmd)
	if err := createSilentCmd("ssh", startArgs...).Run(); err != nil {
		fmt.Printf("Warning: failed to start backend: %v\n", err)
	} else {
		fmt.Println("Backend started.")
		// give it a moment to startup
		time.Sleep(1 * time.Second)
	}

	// If dynamic port, read log to find it
	if forceNew {
		// Grep logic
		// Access URL: http://...:PORT
		// Linux: grep -o "Access URL.*" ~/.mlcremote/LOG
		// Windows: Select-String ...
		fmt.Println("Resolving dynamic port from logs...")

		// Attempt parsing for up to 5 seconds
		resolvedPort := 0
		for i := 0; i < 5; i++ {
			time.Sleep(1 * time.Second)

			var grepCmd string
			if targetOS == "windows" {
				grepCmd = fmt.Sprintf("powershell -Command \"Select-String -Path .mlcremote\\%s -Pattern 'Access URL'\"", logFile)
			} else {
				grepCmd = fmt.Sprintf("grep 'Access URL' ~/%s/%s", remoteBinDir, logFile)
			}

			grepArgs := append([]string{}, sshBaseArgs...)
			grepArgs = append(grepArgs, target, grepCmd)

			if out, err := createSilentCmd("ssh", grepArgs...).Output(); err == nil {
				output := string(out)
				// Format: Access URL: http://HOST:PORT/?token=...
				// Simple parse: find ":PORT"
				// Or regex
				// Let's assume standard log format.
				// Extract digits after http://HOST:
				// Splitting by ":" might be easier. "http" ":" "//HOST" ":" "PORT/..."

				// Example: http://localhost:54321/?token=...
				// Example: http://localhost:54321/

				if idx := strings.LastIndex(output, ":"); idx != -1 {
					// This finds the last colon, which might be in token or query? No, token is hex.
					// URL might have query params.
					// "http://localhost:54321/?token=..." -> Last colon is before port if token has no colons.
					// But token is hex, no colons.
					// ipv6? we bind to localhost/127.0.0.1 or 0.0.0.0.

					// Better strategy: Use regex if I could import regexp in this context, yes I can.
					// Just extract string between last colon and slash?
					// "http://localhost:54321/"

					// Let's just iterate parts
					parts := strings.Split(output, ":")
					// http, //localhost, 54321/?token=...
					if len(parts) >= 3 {
						portPart := parts[len(parts)-1] // "54321/?token=..." or "54321\r\n"
						// Clean up
						portPart = strings.Split(portPart, "/")[0]
						portPart = strings.TrimSpace(portPart)
						if p, err := strconv.Atoi(portPart); err == nil && p > 0 {
							resolvedPort = p
							break
						}
					}
				}
			}
		}

		if resolvedPort > 0 {
			return fmt.Sprintf("deployed:%d:%s", resolvedPort, token), nil
		}
		return "setup-failed", fmt.Errorf("failed to resolve dynamic port from logs")
	}

	return fmt.Sprintf("deployed:%d:%s", targetPort, token), nil
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

// KillRemoteSession terminates the running backend on the remote host
func (m *Manager) KillRemoteSession(profileJSON string) error {
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return fmt.Errorf("invalid profile JSON: %w", err)
	}

	// Detect OS to know how to kill
	osArch, err := m.DetectRemoteOS(profileJSON)
	if err != nil {
		return err // Cannot proceed if we can't talk to host
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
	if strings.Contains(osArch, "/") {
		targetOS = strings.Split(osArch, "/")[0]
	}

	binName := "dev-server"
	if targetOS == "windows" {
		binName = "dev-server.exe"
	}

	// Kill Logic
	killCmd := fmt.Sprintf("systemctl --user stop %s 2>/dev/null; pkill -f %s || true", ServiceName, binName)
	if targetOS == "windows" {
		killCmd = fmt.Sprintf("taskkill /IM %s /F || echo OK", binName)
	}
	killArgs := append([]string{}, sshBaseArgs...)
	killArgs = append(killArgs, target, killCmd)

	output, err := createSilentCmd("ssh", killArgs...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to kill process: %s (%w)", string(output), err)
	}
	return nil
}
