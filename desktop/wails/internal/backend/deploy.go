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
	"unicode"

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

	fmt.Printf("[DEBUG] DetectRemoteOS: 'uname' probe output: %q\n", output)

	if err != nil {
		// Check for auth errors in output
		if strings.Contains(output, "Permission denied") || strings.Contains(output, "publickey") {
			return "", fmt.Errorf("ssh: permission denied")
		}
		if strings.Contains(err.Error(), "exit status 255") {
			return "", fmt.Errorf("ssh-unreachable: %s", output)
		}
		// Don't fail immediately, try fallback if unkown error?
		// But usually exit status 255 is bad.
		// If just command failed (exit 1), we continue to fallback.
		fmt.Printf("[DEBUG] DetectRemoteOS: 'uname' returned error: %v (continuing to fallback)\n", err)
	}

	outputLower := strings.ToLower(output)

	if strings.Contains(outputLower, "linux") {
		arch := "amd64" // default
		if strings.Contains(outputLower, "aarch64") || strings.Contains(outputLower, "arm64") {
			arch = "arm64"
		}
		return fmt.Sprintf("linux/%s", arch), nil
	}

	// Detect Git Bash / Cygwin / MSYS (Windows)
	// Example output: "MINGW64_NT-10.0-19045 x86_64"
	if strings.Contains(outputLower, "mingw") || strings.Contains(outputLower, "msys") || strings.Contains(outputLower, "cygwin") {
		arch := "amd64"
		if strings.Contains(outputLower, "aarch64") || strings.Contains(outputLower, "arm64") {
			arch = "arm64"
		}
		return fmt.Sprintf("windows/%s", arch), nil
	}

	if strings.Contains(outputLower, "darwin") {
		arch := "amd64"
		if strings.Contains(outputLower, "arm64") {
			arch = "arm64"
		}
		return fmt.Sprintf("darwin/%s", arch), nil
	}

	// Probe succeeded with fallback echo? Matches "windows-check"
	if strings.Contains(outputLower, "windows-check") {
		return "windows/amd64", nil
	}

	// Fallback: If we haven't identified Linux/Darwin/Mingw, it might be Windows (Cmd or PowerShell)
	// where 'uname' failed (e.g. "Syntaxfehler" or "Command not found").
	// We explicitly try to invoke cmd.exe to check the version.
	fmt.Println("[DEBUG] DetectRemoteOS: Trying Windows fallback 'cmd /c ver'...")
	winArgs := append([]string{}, sshBaseArgs...)
	winArgs = append(winArgs, target, "cmd /c ver")
	if validOut, err := createSilentCmd("ssh", winArgs...).Output(); err == nil {
		fmt.Printf("[DEBUG] DetectRemoteOS: Fallback output: %q\n", string(validOut))
		if strings.Contains(strings.ToLower(string(validOut)), "windows") {
			return "windows/amd64", nil
		}
	} else {
		fmt.Printf("[DEBUG] DetectRemoteOS: Fallback failed: %v\n", err)
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

	// Closure for running remote commands via SSH
	runRemote := func(cmd string) (string, error) {
		args := append([]string{}, sshBaseArgs...)
		args = append(args, target, cmd)
		out, err := createSilentCmd("ssh", args...).CombinedOutput()
		return strings.TrimSpace(string(out)), err
	}

	remoteSys := getRemoteSystem(targetOS)
	home := remoteSys.GetHomeDir()

	remoteBinDir := remoteSys.JoinPath(".mlcremote", "bin")
	remoteFrontendDir := remoteSys.JoinPath(".mlcremote", "frontend")
	binName := remoteSys.GetBinaryName("dev-server")
	md5Name := remoteSys.GetMD5UtilityName()

	// 1. Cleanup Stale / Zombie Processes
	if !forceNew {
		fmt.Println("Cleaning up potential zombie processes...")
		runRemote(remoteSys.FallbackKill(binName))
		// Cleanup old logs
		runRemote(remoteSys.Remove(remoteSys.JoinPath(".mlcremote", "startup_err.log")))
		runRemote(remoteSys.Remove(remoteSys.JoinPath(".mlcremote", "current.log.err")))
		runRemote(remoteSys.Remove(remoteSys.JoinPath(".mlcremote", "current.log")))
		time.Sleep(1 * time.Second)
	}

	// 2. Check Existing Session
	if !forceNew {
		if conn, ok := m.checkExistingSession(runRemote, remoteSys); ok {
			fmt.Println("Found existing valid session.")
			return conn, nil
		}
	}

	// 3. Upload Assets
	tmpDir, err := os.MkdirTemp("", "mlcremote-install")
	if err != nil {
		return "setup-failed", fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	scpArgs := append([]string{}, sshBaseArgs...) // Copy base args
	if err := m.uploadAssets(runRemote, remoteSys, target, scpArgs, tmpDir, remoteBinDir, remoteFrontendDir, binName, md5Name, targetOS, targetArch, token, forceNew); err != nil {
		return "setup-failed", err
	}

	// 4. Start Backend & Verify
	return m.startBackend(runRemote, remoteSys, home, remoteBinDir, binName, token, forceNew)
}

// --------------------------------------------------------------------------------
// Helper Functions
// --------------------------------------------------------------------------------

func (m *Manager) checkExistingSession(runRemote func(string) (string, error), remoteSys remotesystem.Remote) (string, bool) {
	pidFile := remoteSys.JoinPath(".mlcremote", "pid")
	if out, err := runRemote(remoteSys.ReadFile(pidFile)); err == nil {
		pidStr := strings.TrimSpace(out)
		if pidStr != "" {
			if _, err := runRemote(remoteSys.IsProcessRunning(pidStr)); err == nil {
				// Running! Reuse token.
				tokenFile := remoteSys.JoinPath(".mlcremote", "token")
				if tokenOut, err := runRemote(remoteSys.ReadFile(tokenFile)); err == nil && tokenOut != "" {
					cleanToken := strings.TrimSpace(tokenOut)
					cleanToken = strings.Map(func(r rune) rune {
						if unicode.IsPrint(r) {
							return r
						}
						return -1
					}, cleanToken)
					if fields := strings.Fields(cleanToken); len(fields) > 0 {
						cleanToken = fields[0]
					}
					// Default to 8443 for existing sessions
					return fmt.Sprintf("deployed:8443:%s", cleanToken), true
				}
			} else {
				fmt.Println("checkExistingSession: Stale PID, cleaning up.")
				runRemote(remoteSys.Remove(pidFile))
				runRemote(remoteSys.Remove(remoteSys.JoinPath(".mlcremote", "token")))
			}
		}
	}
	return "", false
}

func (m *Manager) uploadAssets(runRemote func(string) (string, error), remoteSys remotesystem.Remote, target string, scpArgs []string, tmpDir, remoteBinDir, remoteFrontendDir, binName, md5Name, targetOS, targetArch, token string, forceNew bool) error {
	// Read dev-server locally
	devServerContent, err := fs.ReadFile(m.payload, fmt.Sprintf("assets/payload/%s/%s/%s", targetOS, targetArch, binName))
	if err != nil {
		return fmt.Errorf("payload binary not found for %s/%s: %w", targetOS, targetArch, err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, binName), devServerContent, 0755); err != nil {
		return fmt.Errorf("failed to write backend binary to tmp: %w", err)
	}

	// Read md5-util locally
	if md5Name != "" {
		md5Content, err := fs.ReadFile(m.payload, fmt.Sprintf("assets/payload/%s/%s/%s", targetOS, targetArch, md5Name))
		if err == nil {
			os.WriteFile(filepath.Join(tmpDir, md5Name), md5Content, 0755)
		} else {
			fmt.Printf("Warning: md5-util not found in payload for %s/%s\n", targetOS, targetArch)
		}
	}

	// Ensure remote directories exist
	runRemote(remoteSys.Mkdir(remoteBinDir))
	runRemote(remoteSys.Mkdir(remoteFrontendDir))

	// Check MD5 to skip binary upload
	skipBinary := false
	localSum := fmt.Sprintf("%x", md5.Sum(devServerContent))
	home := remoteSys.GetHomeDir()

	hashCmd, hashParser := remoteSys.FileHash(remoteSys.JoinPath(home, remoteBinDir, binName)) // Use home-based path for check
	if out, err := runRemote(hashCmd); err == nil {
		remoteSum := hashParser(out)
		if strings.EqualFold(remoteSum, localSum) {
			fmt.Println("Binary up to date, skipping upload.")
			skipBinary = true
		}
	}

	if !skipBinary {
		// Remove old binary
		runRemote(remoteSys.Remove(remoteSys.JoinPath(remoteBinDir, binName)))

		// SCP Binaries
		scpBinArgs := append([]string{}, scpArgs...)
		scpBinArgs = append(scpBinArgs, filepath.Join(tmpDir, binName), fmt.Sprintf("%s:~/%s/%s", target, remoteBinDir, binName))
		if out, err := createSilentCmd("scp", scpBinArgs...).CombinedOutput(); err != nil {
			return fmt.Errorf("scp binary failed: %s", string(out))
		}

		// SCP MD5 Util (if needed)
		if md5Name != "" {
			if _, err := os.Stat(filepath.Join(tmpDir, md5Name)); err == nil {
				runRemote(remoteSys.Remove(remoteSys.JoinPath(remoteBinDir, md5Name)))
				scpMd5Args := append([]string{}, scpArgs...)
				scpMd5Args = append(scpMd5Args, filepath.Join(tmpDir, md5Name), fmt.Sprintf("%s:~/%s/%s", target, remoteBinDir, md5Name))
				createSilentCmd("scp", scpMd5Args...).Run()
				runRemote(fmt.Sprintf("chmod +x ~/%s/%s", remoteBinDir, md5Name))
			}
			runRemote(fmt.Sprintf("chmod +x ~/%s/%s", remoteBinDir, binName))
		}
	}

	// Upload Startup Script
	if scriptName, scriptContent := remoteSys.GetStartupScript(); scriptName != "" {
		scriptTmp := filepath.Join(tmpDir, scriptName)
		if err := os.WriteFile(scriptTmp, []byte(scriptContent), 0644); err == nil {
			runRemote(remoteSys.Remove(remoteSys.JoinPath(".mlcremote", scriptName)))
			scpScriptArgs := append([]string{}, scpArgs...)
			scpScriptArgs = append(scpScriptArgs, scriptTmp, fmt.Sprintf("%s:~/.mlcremote/%s", target, scriptName))
			if out, err := createSilentCmd("scp", scpScriptArgs...).CombinedOutput(); err != nil {
				return fmt.Errorf("scp script failed: %s", string(out))
			}
		} else {
			return fmt.Errorf("failed to write script temp: %w", err)
		}
	}

	// Upload Frontend
	shouldUploadFrontend := true
	localIndex, err := fs.ReadFile(m.payload, "assets/payload/frontend-dist/index.html")
	if err == nil {
		idxPath := remoteSys.JoinPath(remoteFrontendDir, "index.html")
		if out, err := runRemote(remoteSys.ReadFile(idxPath)); err == nil {
			if strings.TrimSpace(out) == strings.TrimSpace(string(localIndex)) {
				fmt.Println("Frontend already up to date.")
				shouldUploadFrontend = false
			}
		}
	}

	if shouldUploadFrontend {
		fmt.Println("Uploading frontend assets...")
		frontendTmp := filepath.Join(tmpDir, "frontend")
		os.MkdirAll(frontendTmp, 0755)
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

		runRemote(remoteSys.Remove(remoteSys.JoinPath(remoteFrontendDir, "*")))
		scpFrontArgs := append([]string{}, scpArgs...)
		scpFrontArgs = append(scpFrontArgs, "-r", frontendTmp, fmt.Sprintf("%s:~/.mlcremote/", target))
		if out, err := createSilentCmd("scp", scpFrontArgs...).CombinedOutput(); err != nil {
			fmt.Printf("Warning: frontend upload failed: %s\n", string(out))
		}
	}

	// Meta file
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

	return nil
}

func (m *Manager) startBackend(runRemote func(string) (string, error), remoteSys remotesystem.Remote, home, remoteBinDir, binName, token string, forceNew bool) (string, error) {
	if token == "" {
		return "failed", fmt.Errorf("backend token is required")
	}

	authArg := fmt.Sprintf("-token=%s", token)
	targetPort := 8443
	portArg := "-port=8443"
	if forceNew {
		targetPort = 0
		portArg = "-port=0"
	}
	hostArg := "-host=127.0.0.1"

	logFile := "current.log"
	if forceNew {
		logFile = fmt.Sprintf("session-%d.log", time.Now().Unix())
	}

	pidFile := remoteSys.JoinPath(home, ".mlcremote", "pid")

	startCmd := remoteSys.StartProcess(
		remoteSys.JoinPath(home, remoteBinDir, binName),
		fmt.Sprintf("%s %s %s", authArg, portArg, hostArg),
		remoteSys.JoinPath(home, ".mlcremote", logFile),
		pidFile,
	)

	fmt.Printf("[DEBUG] START CMD: %s\n", startCmd)
	if out, err := runRemote(startCmd); err == nil {
		fmt.Printf("[DEBUG] START OUTPUT: %s\n", out)
	} else {
		fmt.Printf("[DEBUG] START ERROR: %v | OUTPUT: %s\n", err, out)
	}

	// Verification Phase
	time.Sleep(3 * time.Second)

	pidPath := remoteSys.JoinPath(".mlcremote", "pid")
	logPath := remoteSys.JoinPath(".mlcremote", logFile)

	startWait := time.Now()
	pidFound := false

	for time.Since(startWait) < 15*time.Second {
		// Check PID
		if out, err := runRemote(remoteSys.ReadFile(pidPath)); err == nil {
			pidStr := strings.TrimSpace(out)
			if pidStr != "" {
				pidFound = true

				// Debug: Check if process is alive
				isRunning := false
				if _, err := runRemote(remoteSys.IsProcessRunning(pidStr)); err == nil {
					isRunning = true
				} else {
					fmt.Printf("DEBUG: PID %s found but process not running (crashed).\n", pidStr)
				}

				// Check Log
				if out, err := runRemote(remoteSys.ReadFile(logPath)); err == nil {
					if isRunning && strings.TrimSpace(out) == "" {
						fmt.Printf("DEBUG: Process %s running, log empty (buffering?).\n", pidStr)
					}
					if strings.Contains(out, "Server started") {
						fmt.Printf("Backend started successfully! PID: %s (verified via log).\n", pidStr)

						// Dynamic Port parsing (simplified for now to match current logic needs)
						if targetPort == 0 {
							lines := strings.Split(out, "\n")
							for _, line := range lines {
								if strings.Contains(line, "Server started on http://") {
									parts := strings.Split(line, ":")
									if len(parts) >= 3 {
										pStr := strings.TrimSpace(parts[len(parts)-1])
										// Handle comma or extra text
										endIdx := strings.IndexAny(pStr, " ,")
										if endIdx != -1 {
											pStr = pStr[:endIdx]
										}
										if p, err := strconv.Atoi(pStr); err == nil {
											targetPort = p
										}
									}
								}
							}
						}
						fmt.Printf("Backend listening on port: %d\n", targetPort)

						// Read Token
						tokenFile := remoteSys.JoinPath(".mlcremote", "token")
						if tokenOut, err := runRemote(remoteSys.ReadFile(tokenFile)); err == nil && tokenOut != "" {
							cleanToken := strings.TrimSpace(tokenOut)
							cleanToken = strings.Map(func(r rune) rune {
								if unicode.IsPrint(r) {
									return r
								}
								return -1
							}, cleanToken)
							if fields := strings.Fields(cleanToken); len(fields) > 0 {
								cleanToken = fields[0]
							}
							return fmt.Sprintf("deployed:%d:%s", targetPort, cleanToken), nil
						}
					}
				}
			}
		}
		time.Sleep(500 * time.Millisecond)
	}

	if !pidFound {
		return "startup-failed", fmt.Errorf("backend failed to write PID file (timeout)")
	}

	// Failure Report
	logContent := ""
	fmt.Printf("Reading log file %s...\n", logPath)
	if out, err := runRemote(remoteSys.ReadFile(logPath)); err == nil {
		logContent = out
	}

	// Check stderr log (current.log.err)
	if logContent == "" || !strings.Contains(logContent, "Server started") {
		fmt.Printf("Log potentially missing info. Reading stderr file %s.err...\n", logPath)
		if out, err := runRemote(remoteSys.ReadFile(logPath + ".err")); err == nil && strings.TrimSpace(out) != "" {
			logContent += "\n\n--- Stderr details (current.log.err) ---\n" + out
		}
	}

	errLogPath := remoteSys.JoinPath(".mlcremote", "startup_err.log")
	if out, err := runRemote(remoteSys.ReadFile(errLogPath)); err == nil && strings.TrimSpace(out) != "" {
		logContent += "\n\n--- Startup Error details (startup_err.log) ---\n" + out
	}
	return "startup-failed", fmt.Errorf("backend process died or timed out. Log output:\n%s", logContent)
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
	if out, err := runRemote(remoteSys.ReadFile(pidFile)); err == nil {
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
