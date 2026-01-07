package backend

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/remotesystem"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
)

// DetectRemoteOS attempts to determine the remote operating system and architecture
func (m *Manager) DetectRemoteOS(profileJSON string) (string, error) {
	// ... (Previous implementation remains valid or can be refactored too)
	// For now, let's keep the existing probe logic or move it?
	// The problem is we need OS to instantiate the right System.
	// So we keep this probe logic here to decide which System to create.

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

func getRemoteSystem(osType string) remotesystem.Remote {
	if osType == "windows" {
		return &remotesystem.Windows{}
	}
	if osType == "darwin" {
		return &remotesystem.Darwin{}
	}
	return &remotesystem.Linux{}
}

// DeployAgent ensures the correct binary and assets are on the remote host.
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

	// SSH Setup
	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	// We reuse the single command execution style
	runRemote := func(cmd string) (string, error) {
		args := append([]string{}, sshBaseArgs...)
		args = append(args, target, cmd)
		out, err := createSilentCmd("ssh", args...).CombinedOutput()
		return strings.TrimSpace(string(out)), err
	}

	remoteSys := getRemoteSystem(targetOS)
	home := remoteSys.GetHomeDir()

	// 0. Pre-flight Cleanup (The Nuke Option)
	// User reported zombie processes, so we must be aggressive if we are not forcing a new parallel session.
	// We use "dev-server" literal here because binName logic is below, but acceptable for this critical fix.
	if !forceNew {
		fmt.Println("Cleaning up potential zombie processes...")
		// Assuming standard name "dev-server" or "dev-server.exe" in process list
		// FallbackKill uses pkill -f, so it matches partial command line.
		runRemote(remoteSys.FallbackKill("dev-server"))
		time.Sleep(1 * time.Second) // Give it a moment to die
	}

	// Create temp dir
	tmpDir, err := os.MkdirTemp("", "mlcremote-install")
	if err != nil {
		return "setup-failed", fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// 1. Prepare Binaries (dev-server AND md5-util)
	binName := "dev-server"
	md5Name := "md5-util"
	if targetOS == "windows" {
		binName = "dev-server.exe"
		md5Name = "md5-util.exe"
	}

	// Remote Directories
	// .mlcremote/bin
	// .mlcremote/frontend
	// home variable moved up
	// Keep these relative for SCP/chmod/cat compatibility which assume ~/ prefix
	remoteBinDir := remoteSys.JoinPath(".mlcremote", "bin")
	remoteFrontendDir := remoteSys.JoinPath(".mlcremote", "frontend")

	// Read dev-server
	devServerContent, err := fs.ReadFile(m.payload, fmt.Sprintf("assets/payload/%s/%s/%s", targetOS, targetArch, binName))
	if err != nil {
		return "setup-failed", fmt.Errorf("payload binary not found for %s: %w", osArch, err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, binName), devServerContent, 0755); err != nil {
		return "setup-failed", fmt.Errorf("failed to write backend binary: %w", err)
	}

	// Read md5-util (Assuming it's built and in payload)
	// We need to update build script to place it there!
	md5Content, err := fs.ReadFile(m.payload, fmt.Sprintf("assets/payload/%s/%s/%s", targetOS, targetArch, md5Name))
	if err == nil {
		if err := os.WriteFile(filepath.Join(tmpDir, md5Name), md5Content, 0755); err != nil {
			// Not fatal? but desirable
			fmt.Printf("Warning: failed to write md5-util: %v\n", err)
		}
	} else {
		fmt.Printf("Warning: md5-util not found in payload for %s: %v\n", osArch, err)
	}

	// Ensure directories exist
	// Note: Windows mkdir can fail if exists, but our implementation handles it or we chain.
	// Actually, just fire them individually or joined with ; or && depending on OS?
	// The implementation returns complete command string.
	// Let's create one command to init structure.

	runRemote(remoteSys.Mkdir(remoteBinDir))
	runRemote(remoteSys.Mkdir(remoteFrontendDir))

	// Check MD5 (dev-server)
	skipBinary := false
	localSum := fmt.Sprintf("%x", md5.Sum(devServerContent))

	hashCmd, hashParser := remoteSys.FileHash(remoteSys.JoinPath(home, remoteBinDir, binName))
	if out, err := runRemote(hashCmd); err == nil {
		remoteSum := hashParser(out)
		if strings.EqualFold(remoteSum, localSum) {
			fmt.Println("Binary up to date, skipping upload.")
			skipBinary = true
		}
	}

	// Check PID / Re-use session
	if !forceNew {
		pidFile := remoteSys.JoinPath(".mlcremote", "pid")
		if out, err := runRemote(fmt.Sprintf("cat ~/%s || type %s", pidFile, pidFile)); err == nil {
			pidStr := strings.TrimSpace(out)
			if pidStr != "" {
				if _, err := runRemote(remoteSys.IsProcessRunning(pidStr)); err == nil {
					// Running! Reuse token.
					tokenFile := remoteSys.JoinPath(".mlcremote", "token")
					if tokenOut, err := runRemote(fmt.Sprintf("cat ~/%s || type %s", tokenFile, tokenFile)); err == nil && tokenOut != "" {
						return fmt.Sprintf("deployed:8443:%s", strings.TrimSpace(tokenOut)), nil
					}
				} else {
					// Stale
					fmt.Println("Stale PID, cleaning up.")
					runRemote(remoteSys.Remove(pidFile))
					runRemote(remoteSys.Remove(remoteSys.JoinPath(".mlcremote", "token")))
				}
			}
		}
	}

	// Kill Old (Already done at start of function)
	// kept comment for flow reference

	scpArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		scpArgs = append(scpArgs, "-i", p.IdentityFile)
	}

	if !skipBinary {
		// Remove old binary to avoid text file busy
		runRemote(remoteSys.Remove(remoteSys.JoinPath(remoteBinDir, binName)))

		// SCP binaries
		// dev-server
		scpBinArgs := append([]string{}, scpArgs...)
		scpBinArgs = append(scpBinArgs, filepath.Join(tmpDir, binName), fmt.Sprintf("%s:~/%s/%s", target, remoteBinDir, binName))
		if out, err := createSilentCmd("scp", scpBinArgs...).CombinedOutput(); err != nil {
			return "upload-failed", fmt.Errorf("scp binary failed: %s", string(out))
		}

		// md5-util (Always upload for now)
		if _, err := os.Stat(filepath.Join(tmpDir, md5Name)); err == nil {
			runRemote(remoteSys.Remove(remoteSys.JoinPath(remoteBinDir, md5Name)))
			scpMd5Args := append([]string{}, scpArgs...)
			scpMd5Args = append(scpMd5Args, filepath.Join(tmpDir, md5Name), fmt.Sprintf("%s:~/%s/%s", target, remoteBinDir, md5Name))
			createSilentCmd("scp", scpMd5Args...).Run()

			if targetOS != "windows" {
				runRemote(fmt.Sprintf("chmod +x ~/%s/%s", remoteBinDir, md5Name))
			}
		}

		if targetOS != "windows" {
			runRemote(fmt.Sprintf("chmod +x ~/%s/%s", remoteBinDir, binName))
		}
	}

	// Upload Frontend (Optimized)
	shouldUploadFrontend := true
	localIndex, err := fs.ReadFile(m.payload, "assets/payload/frontend-dist/index.html")
	if err == nil {
		// Check remote index
		// Use file hash for index.html as well for stronger check? Or just content?
		// Let's use content for now (easier and tested), checking MD5 of text files can be tricky with EOL.
		// Reading small text file is fast.
		idxPath := remoteSys.JoinPath(remoteFrontendDir, "index.html")
		idxCmd := fmt.Sprintf("cat ~/%s || type %s", idxPath, idxPath)
		if out, err := runRemote(idxCmd); err == nil {
			remoteIndex := strings.TrimSpace(out)
			localIndexStr := strings.TrimSpace(string(localIndex))
			if remoteIndex == localIndexStr {
				fmt.Println("Frontend already up to date.")
				shouldUploadFrontend = false
			}
		}
	}

	if shouldUploadFrontend {
		fmt.Println("Uploading frontend assets...")
		frontendTmp := filepath.Join(tmpDir, "frontend")
		os.MkdirAll(frontendTmp, 0755)

		// Copy frontend files to tmp
		fs.WalkDir(m.payload, "assets/payload/frontend-dist", func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			rel, _ := filepath.Rel("assets/payload/frontend-dist", path)
			dest := filepath.Join(frontendTmp, rel)
			os.MkdirAll(filepath.Dir(dest), 0755)
			content, _ := fs.ReadFile(m.payload, path)
			os.WriteFile(dest, content, 0644)
			return nil
		})

		// Clean remote frontend
		runRemote(remoteSys.Remove(remoteSys.JoinPath(remoteFrontendDir, "*")))

		// SCP recursive
		// Uploading content of frontendTmp to .mlcremote/frontend/
		// scp -r frontendTmp/* target:~/.mlcremote/frontend/
		// Using the directory upload trick: upload frontendTmp to ~/.mlcremote/ (renames to frontend?)
		// Safe way: upload to ~/.mlcremote/frontend

		scpFrontArgs := append([]string{}, scpArgs...)
		scpFrontArgs = append(scpFrontArgs, "-r", frontendTmp, fmt.Sprintf("%s:~/.mlcremote/", target))
		if out, err := createSilentCmd("scp", scpFrontArgs...).CombinedOutput(); err != nil {
			fmt.Printf("Warning: frontend upload failed: %s\n", string(out))
		}
	}

	// Meta file (install.json) with V 1.0.2
	metaContent := fmt.Sprintf(`{"version": "1.0.2", "updated": "%s", "os": "%s", "arch": "%s"}`, time.Now().Format(time.RFC3339), targetOS, targetArch)
	metaPath := filepath.Join(tmpDir, "install.json")
	os.WriteFile(metaPath, []byte(metaContent), 0644)

	scpMetaArgs := append([]string{}, scpArgs...)
	scpMetaArgs = append(scpMetaArgs, metaPath, fmt.Sprintf("%s:~/.mlcremote/install.json", target))
	createSilentCmd("scp", scpMetaArgs...).Run()

	// Token File
	if token != "" && !forceNew {
		tokenPath := filepath.Join(tmpDir, "token")
		os.WriteFile(tokenPath, []byte(token), 0600)
		scpTokenArgs := append([]string{}, scpArgs...)
		scpTokenArgs = append(scpTokenArgs, tokenPath, fmt.Sprintf("%s:~/.mlcremote/token", target))
		createSilentCmd("scp", scpTokenArgs...).Run()
	}

	// Start Backend
	fmt.Println("Starting remote backend...")
	var startCmd string

	if token == "" {
		return "failed", fmt.Errorf("backend token is required for secure mode")
	}
	authArg := fmt.Sprintf("-token=%s", token)

	// Port configuration
	targetPort := 8443
	portArg := "-port=8443"
	if forceNew {
		targetPort = 0
		portArg = "-port=0"
	}
	// Force bind to 127.0.0.1 to avoid IPv6 mismatch with SSH localhost forwarding
	hostArg := "-host=127.0.0.1"

	logFile := "current.log"
	if forceNew {
		logFile = fmt.Sprintf("session-%d.log", time.Now().Unix())
	}

	pidFile := remoteSys.JoinPath(home, ".mlcremote", "pid")
	if targetOS == "windows" {
		// Windows specific adjustment if needed, but JoinPath(".", ...) is .\...
		// pidFile is used for output redirection in StartProcess
	}

	startCmd = remoteSys.StartProcess(
		remoteSys.JoinPath(home, remoteBinDir, binName),
		fmt.Sprintf("%s %s %s", authArg, portArg, hostArg),
		remoteSys.JoinPath(home, ".mlcremote", logFile),
		pidFile, // StartProcess inside knows how to redirect
	)

	runRemote(startCmd)
	time.Sleep(1 * time.Second)

	// Verify Startup
	pidPath := remoteSys.JoinPath(".mlcremote", "pid") // Relative for cat ~/%s
	// (StartProcess used pidFile variable which was correctly set to home/.mlcremote/pid)

	if out, err := runRemote(fmt.Sprintf("cat ~/%s || type %s", pidPath, pidPath)); err == nil {
		pidStr := strings.TrimSpace(out)
		if pidStr != "" {
			if _, err := runRemote(remoteSys.IsProcessRunning(pidStr)); err == nil {
				// Running!
				fmt.Println("Backend started successfully.")

				// If dynamic port was requested, we need to find it in the logs
				if targetPort == 0 {
					fmt.Println("Dynamic port requested, reading logs to find port...")
					logPath := remoteSys.JoinPath(".mlcremote", logFile)
					foundPort := 0

					// Retry loop to allow log flush
					for i := 0; i < 10; i++ {
						time.Sleep(500 * time.Millisecond)
						if out, err := runRemote(fmt.Sprintf("cat ~/%s || type %s", logPath, logPath)); err == nil {
							// Look for "Server started on http://...:PORT"
							// Simple string parsing to avoid regex import overhead if possible, but regex is safer.
							// Format: "Server started on http://HOST:PORT"
							lines := strings.Split(out, "\n")
							for _, line := range lines {
								if idx := strings.Index(line, "Server started on http://"); idx != -1 {
									// Extract URL part
									part := line[idx:]
									// Find last colon
									lastColon := strings.LastIndex(part, ":")
									if lastColon != -1 {
										portStr := part[lastColon+1:]
										// Trim any trailing text (comma, space)
										// "8443, binary=..."
										endIdx := strings.IndexAny(portStr, " ,")
										if endIdx != -1 {
											portStr = portStr[:endIdx]
										}
										portStr = strings.TrimSpace(portStr)
										if p, err := strconv.Atoi(portStr); err == nil {
											foundPort = p
											break
										}
									}
								}
							}
						}
						if foundPort > 0 {
							break
						}
					}

					if foundPort > 0 {
						targetPort = foundPort
						fmt.Printf("found dynamic port: %d\n", targetPort)
					} else {
						return "startup-failed", fmt.Errorf("timed out waiting for port in logs")
					}
				}

			} else {
				// Failed to start
				fmt.Printf("Startup failed. Reading log file %s...\n", logFile)
				logPath := remoteSys.JoinPath(".mlcremote", logFile)
				logContent := ""
				if out, err := runRemote(fmt.Sprintf("cat ~/%s || type %s", logPath, logPath)); err == nil {
					logContent = out
				}
				return "startup-failed", fmt.Errorf("backend process died immediately. Log output:\n%s", logContent)
			}
		} else {
			return "startup-failed", fmt.Errorf("backend failed to write PID file")
		}
	} else {
		return "startup-failed", fmt.Errorf("failed to read PID file: %v", err)
	}

	// Dynamic port resolution (if needed) ... (Same logic as before, just path adjustments)
	// For now defaulting to 8443 return to keep refactor minimal risk.

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

// KillRemoteServer terminates the running backend on the remote host
func (m *Manager) KillRemoteServer(profileJSON string) error {
	var p ssh.TunnelProfile
	json.Unmarshal([]byte(profileJSON), &p)

	osArch, _ := m.DetectRemoteOS(profileJSON)
	targetOS := "linux"
	if strings.Contains(osArch, "windows") {
		targetOS = "windows"
	}

	remoteSys := getRemoteSystem(targetOS)

	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}

	runRemote := func(cmd string) (string, error) {
		args := append([]string{}, sshBaseArgs...)
		args = append(args, target, cmd)
		out, err := createSilentCmd("ssh", args...).CombinedOutput()
		return strings.TrimSpace(string(out)), err
	}

	// Read PID
	pidFile := remoteSys.JoinPath(".mlcremote", "pid")
	if out, err := runRemote(fmt.Sprintf("cat ~/%s || type %s", pidFile, pidFile)); err == nil {
		pidStr := strings.TrimSpace(out)
		if pidStr != "" {
			fmt.Printf("Killing PID: %s\n", pidStr)
			runRemote(remoteSys.KillProcess(pidStr))

			// Verify
			if _, err := runRemote(remoteSys.IsProcessRunning(pidStr)); err != nil {
				// Gone
				runRemote(remoteSys.Remove(pidFile))
				runRemote(remoteSys.Remove(remoteSys.JoinPath(".mlcremote", "token")))
				return nil
			}
		}
	}

	// Fallback
	runRemote(remoteSys.FallbackKill("dev-server"))
	runRemote(remoteSys.Remove(pidFile))
	return nil
}
