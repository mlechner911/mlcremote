package backend

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/mlechner911/mlcremote/desktop/wails/internal/remotesystem"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
)

// DetectRemoteOS attempts to determine the remote operating system and architecture.
// It connects via SSH and runs probing commands (uname, ver) to identify the platform.
// Returns the detected OS and Architecture enums, or an error if detection fails.
func (m *Manager) DetectRemoteOS(profileJSON string) (remotesystem.RemoteOS, remotesystem.RemoteArch, error) {
	target, sshBaseArgs, err := m.prepareSSHArgs(profileJSON)
	if err != nil {
		return remotesystem.OSUnknown, remotesystem.UnknownArch, err
	}

	probeCmd := remotesystem.ProbeCommand

	cmdArgs := append([]string{}, sshBaseArgs...)
	cmdArgs = append(cmdArgs, target, probeCmd)

	cmd := createSilentCmd("ssh", cmdArgs...)
	outBytes, err := cmd.CombinedOutput()
	output := strings.TrimSpace(string(outBytes))

	fmt.Printf("[DEBUG] DetectRemoteOS: 'uname' probe output: %q\n", output)

	if err != nil {
		if strings.Contains(output, "Permission denied") || strings.Contains(output, "publickey") {
			return remotesystem.OSUnknown, remotesystem.UnknownArch, fmt.Errorf("ssh: permission denied")
		}
		if strings.Contains(err.Error(), "exit status 255") {
			return remotesystem.OSUnknown, remotesystem.UnknownArch, fmt.Errorf("ssh-unreachable: %s", output)
		}
		fmt.Printf("[DEBUG] DetectRemoteOS: 'uname' returned error: %v (continuing to fallback)\n", err)
	}

	if os, arch := remotesystem.ParseOS(output); os != remotesystem.OSUnknown {
		return os, arch, nil
	}

	fmt.Println("[DEBUG] DetectRemoteOS: Trying Windows fallback 'cmd /c ver'...")
	winArgs := append([]string{}, sshBaseArgs...)
	winArgs = append(winArgs, target, "cmd /c ver")
	if validOut, err := createSilentCmd("ssh", winArgs...).Output(); err == nil {
		fmt.Printf("[DEBUG] DetectRemoteOS: Fallback output: %q\n", string(validOut))
		os, arch := remotesystem.ParseOS(string(validOut))
		return os, arch, nil
	} else {
		fmt.Printf("[DEBUG] DetectRemoteOS: Fallback failed: %v\n", err)
	}

	return remotesystem.OSUnknown, remotesystem.UnknownArch, nil
}

func getRemoteSystem(osType remotesystem.RemoteOS) remotesystem.Remote {
	if strings.HasPrefix(string(osType), "windows") {
		return &remotesystem.Windows{}
	}
	if osType == remotesystem.OSDarwin {
		return &remotesystem.Darwin{}
	}
	return &remotesystem.Linux{}
}

// DeployAgent ensures the correct binary and assets are on the remote host.
func (m *Manager) DeployAgent(profileJSON string, targetOS remotesystem.RemoteOS, targetArch remotesystem.RemoteArch, token string, forceNew bool) (string, error) {
	target, sshBaseArgs, err := m.prepareSSHArgs(profileJSON)
	if err != nil {
		return "", err
	}

	runRemote := func(cmd string) (string, error) {
		args := append([]string{}, sshBaseArgs...)
		args = append(args, target, cmd)
		out, err := createSilentCmd("ssh", args...).CombinedOutput()
		return strings.TrimSpace(string(out)), err
	}

	remoteSys := getRemoteSystem(targetOS)
	home := remoteSys.GetHomeDir()

	remoteBinDir := remoteSys.JoinPath(RemoteBinDir)
	remoteFrontendDir := remoteSys.JoinPath(RemoteFrontendDir)
	binName := remoteSys.GetBinaryName(RemoteBinaryName)
	md5Name := remoteSys.GetMD5UtilityName()

	// 0. Pre-check: If session exists, is the binary up to date?
	if !forceNew {
		isUpToDate, _ := m.verifyRemoteBinary(runRemote, remoteSys, home, remoteBinDir, binName, targetOS, targetArch)
		if !isUpToDate {
			forceNew = true
		}
	}

	// 1. Cleanup Stale / Zombie Processes
	if !forceNew {
		m.cleanupRemoteState(runRemote, remoteSys, binName)
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

	scpArgs := append([]string{}, sshBaseArgs...)
	if err := m.uploadAssets(runRemote, remoteSys, target, scpArgs, tmpDir, remoteBinDir, remoteFrontendDir, binName, md5Name, targetOS, targetArch, token, forceNew); err != nil {
		return "setup-failed", err
	}

	// 4. Start Backend & Verify
	var p ssh.TunnelProfile
	json.Unmarshal([]byte(profileJSON), &p)

	res, err := m.startBackend(runRemote, remoteSys, home, remoteBinDir, binName, token, p.RootPath, forceNew)
	if err != nil && !forceNew {
		fmt.Printf("Startup on default port failed (%v). Retrying with random port...\n", err)
		return m.startBackend(runRemote, remoteSys, home, remoteBinDir, binName, token, p.RootPath, true)
	}
	return res, err
}

func (m *Manager) checkExistingSession(runRemote func(string) (string, error), remoteSys remotesystem.Remote) (string, bool) {
	pidFile := remoteSys.JoinPath(RemoteBaseDir, PidFile)
	if out, err := runRemote(remoteSys.ReadFile(pidFile)); err == nil {
		pidStr := strings.TrimSpace(out)
		if pidStr != "" {
			if _, err := runRemote(remoteSys.IsProcessRunning(pidStr)); err == nil {
				tokenFile := remoteSys.JoinPath(RemoteBaseDir, TokenFile)
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
					return fmt.Sprintf("deployed:8443:%s", cleanToken), true
				}
			} else {
				fmt.Println("checkExistingSession: Stale PID, cleaning up.")
				runRemote(remoteSys.Remove(pidFile))
				runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, TokenFile)))
			}
		}
	}
	return "", false
}

func (m *Manager) uploadAssets(runRemote func(string) (string, error), remoteSys remotesystem.Remote, target string, scpArgs []string, tmpDir, remoteBinDir, remoteFrontendDir, binName, md5Name string, targetOS remotesystem.RemoteOS, targetArch remotesystem.RemoteArch, token string, forceNew bool) error {
	assetOS := targetOS
	if strings.HasPrefix(string(targetOS), "windows") {
		assetOS = remotesystem.OSWindows
	}

	devServerContent, err := fs.ReadFile(m.payload, fmt.Sprintf("assets/payload/%s/%s/%s", assetOS, targetArch, binName))
	if err != nil {
		return fmt.Errorf("payload binary not found for %s/%s: %w", assetOS, targetArch, err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, binName), devServerContent, 0755); err != nil {
		return fmt.Errorf("failed to write backend binary to tmp: %w", err)
	}

	if md5Name != "" {
		md5Content, err := fs.ReadFile(m.payload, fmt.Sprintf("assets/payload/%s/%s/%s", assetOS, targetArch, md5Name))
		if err == nil {
			os.WriteFile(filepath.Join(tmpDir, md5Name), md5Content, 0755)
		} else {
			fmt.Printf("Warning: md5-util not found in payload for %s/%s\n", targetOS, targetArch)
		}
	}

	runRemote(remoteSys.Mkdir(remoteBinDir))
	runRemote(remoteSys.Mkdir(remoteFrontendDir))

	skipBinary := false
	localSum := fmt.Sprintf("%x", md5.Sum(devServerContent))
	home := remoteSys.GetHomeDir()

	hashCmd, hashParser := remoteSys.FileHash(remoteSys.JoinPath(home, remoteBinDir, binName))
	if out, err := runRemote(hashCmd); err == nil {
		remoteSum := hashParser(out)
		if strings.EqualFold(remoteSum, localSum) {
			fmt.Println("Binary up to date, skipping upload.")
			skipBinary = true
		}
	}

	if !skipBinary {
		fmt.Println("Ensuring remote process is stopped before update...")
		runRemote(remoteSys.FallbackKill(binName))
		time.Sleep(1 * time.Second)

		runRemote(remoteSys.Remove(remoteSys.JoinPath(remoteBinDir, binName)))
		runRemote(remoteSys.Rename(
			remoteSys.JoinPath(remoteBinDir, binName),
			remoteSys.JoinPath(remoteBinDir, binName+".old"),
		))

		scpBinArgs := append([]string{}, scpArgs...)
		scpBinArgs = append(scpBinArgs, filepath.Join(tmpDir, binName), fmt.Sprintf("%s:~/%s/%s", target, remoteBinDir, binName))
		if out, err := createSilentCmd("scp", scpBinArgs...).CombinedOutput(); err != nil {
			return fmt.Errorf("scp binary failed: %s", string(out))
		}

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

	// Upload startup script
	scriptName, scriptContent := remoteSys.GetStartupScript()
	if scriptName != "" {
		if scriptContent == "" {
			// Content is empty, read from assets/payload/{scriptName}
			// Use path.Join (forward slashes) for embed.FS, NOT filepath.Join (OS specific)
			embedKey := path.Join("assets", "payload", scriptName)
			if content, err := fs.ReadFile(m.payload, embedKey); err == nil {
				scriptContent = string(content)
			} else {
				// DEBUG: List all files in assets/payload to see what's wrong
				fmt.Printf("DEBUG: Failed to read %s. Available assets:\n", embedKey)
				fs.WalkDir(m.payload, "assets/payload", func(path string, d fs.DirEntry, err error) error {
					fmt.Println(" -", path)
					return nil
				})
				return fmt.Errorf("failed to read script asset %s: %w", scriptName, err)
			}
		}

		scriptTmp := filepath.Join(tmpDir, scriptName)
		if err := os.WriteFile(scriptTmp, []byte(scriptContent), 0644); err == nil {
			runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, scriptName)))
			scpScriptArgs := append([]string{}, scpArgs...)
			scpScriptArgs = append(scpScriptArgs, scriptTmp, fmt.Sprintf("%s:~/%s/%s", target, RemoteBaseDir, scriptName))
			if out, err := createSilentCmd("scp", scpScriptArgs...).CombinedOutput(); err != nil {
				return fmt.Errorf("scp script failed: %s", string(out))
			}
			// Important: Ensure script is executable
			runRemote(fmt.Sprintf("chmod +x ~/%s/%s", RemoteBaseDir, scriptName))
		} else {
			return fmt.Errorf("failed to write script temp: %w", err)
		}
	}

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

	metaContent := fmt.Sprintf(`{"version": "%s", "updated": "%s", "os": "%s", "arch": "%s"}`, AgentVersion, time.Now().Format(time.RFC3339), targetOS, targetArch)
	metaPath := filepath.Join(tmpDir, InstallMetaFile)
	os.WriteFile(metaPath, []byte(metaContent), 0644)
	scpMetaArgs := append([]string{}, scpArgs...)
	scpMetaArgs = append(scpMetaArgs, metaPath, fmt.Sprintf("%s:~/%s/%s", target, RemoteBaseDir, InstallMetaFile))
	createSilentCmd("scp", scpMetaArgs...).Run()

	if token != "" && !forceNew {
		tokenPath := filepath.Join(tmpDir, TokenFile)
		os.WriteFile(tokenPath, []byte(token), 0600)
		scpTokenArgs := append([]string{}, scpArgs...)
		scpTokenArgs = append(scpTokenArgs, tokenPath, fmt.Sprintf("%s:~/%s/%s", target, RemoteBaseDir, TokenFile))
		createSilentCmd("scp", scpTokenArgs...).Run()
	}

	return nil
}

func (m *Manager) startBackend(runRemote func(string) (string, error), remoteSys remotesystem.Remote, home, remoteBinDir, binName, token, rootPath string, forceNew bool) (string, error) {
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

	// Append root arg if specified
	rootArg := ""
	if rootPath != "" {
		rootArg = fmt.Sprintf("-root=\"%s\"", rootPath)
	}

	logFile := LogFileCurrent
	if forceNew {
		logFile = fmt.Sprintf("session-%d.log", time.Now().Unix())
	}

	pidFile := remoteSys.JoinPath(home, RemoteBaseDir, PidFile)

	startCmd := remoteSys.StartProcess(
		remoteSys.JoinPath(home, remoteBinDir, binName),
		fmt.Sprintf("%s %s %s %s", authArg, portArg, hostArg, rootArg),
		remoteSys.JoinPath(home, RemoteBaseDir, logFile),
		pidFile,
	)

	fmt.Printf("[DEBUG] START CMD: %s\n", startCmd)
	if out, err := runRemote(startCmd); err == nil {
		fmt.Printf("[DEBUG] START OUTPUT: %s\n", out)
	} else {
		fmt.Printf("[DEBUG] START ERROR: %v | OUTPUT: %s\n", err, out)
	}

	time.Sleep(3 * time.Second)

	pidPath := remoteSys.JoinPath(RemoteBaseDir, PidFile)
	logPath := remoteSys.JoinPath(RemoteBaseDir, logFile)

	startWait := time.Now()
	pidFound := false

	for time.Since(startWait) < 15*time.Second {
		if out, err := runRemote(remoteSys.ReadFile(pidPath)); err == nil {
			pidStr := strings.TrimSpace(out)
			if pidStr != "" {
				pidFound = true

				isRunning := false
				if _, err := runRemote(remoteSys.IsProcessRunning(pidStr)); err == nil {
					isRunning = true
				} else {
					fmt.Printf("DEBUG: PID %s found but process not running (crashed).\n", pidStr)
				}

				if out, err := runRemote(remoteSys.ReadFile(logPath)); err == nil {
					if isRunning && strings.TrimSpace(out) == "" {
						fmt.Printf("DEBUG: Process %s running, log empty (buffering?).\n", pidStr)
					}
					if strings.Contains(out, "Server started") {
						fmt.Printf("Backend started successfully! PID: %s (verified via log).\n", pidStr)

						if targetPort == 0 {
							lines := strings.Split(out, "\n")
							for _, line := range lines {
								if strings.Contains(line, "Server started on http://") {
									parts := strings.Split(line, ":")
									if len(parts) >= 3 {
										pStr := strings.TrimSpace(parts[len(parts)-1])
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
						return fmt.Sprintf("deployed:%d:%s", targetPort, token), nil
					}
				}
			}
		}
		time.Sleep(500 * time.Millisecond)
	}

	if !pidFound {
		return "startup-failed", fmt.Errorf("backend failed to write PID file (timeout)")
	}

	time.Sleep(500 * time.Millisecond)
	logContent := ""
	fmt.Printf("Reading log file %s...\n", logPath)
	if out, err := runRemote(remoteSys.ReadFile(logPath)); err == nil {
		logContent = out
	}

	if logContent == "" || !strings.Contains(logContent, "Server started") {
		fmt.Printf("Log potentially missing info. Reading stderr file %s.err...\n", logPath)
		if out, err := runRemote(remoteSys.ReadFile(logPath + ".err")); err == nil && strings.TrimSpace(out) != "" {
			logContent += "\n\n--- Stderr details (current.log.err) ---\n" + out
		}
	}

	errLogPath := remoteSys.JoinPath(RemoteBaseDir, LogFileStartupErr)
	if out, err := runRemote(remoteSys.ReadFile(errLogPath)); err == nil && strings.TrimSpace(out) != "" {
		logContent += "\n\n--- Startup Error details (startup_err.log) ---\n" + out
	}

	if strings.Contains(strings.ToLower(logContent), "address already in use") || strings.Contains(strings.ToLower(logContent), "bind: only one usage of each socket address") {
		return "startup-failed", fmt.Errorf("backend failed to start: Port %d is already in use.\nPlease stop the existing process or use a different port.\n\nLog: %s", targetPort, logContent)
	}

	return "startup-failed", fmt.Errorf("backend process died or timed out. Log output:\n%s", logContent)
}

func (m *Manager) SaveIdentityFile(b64 string, filename string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", err
	}

	tmpDir := os.TempDir()
	path := filepath.Join(tmpDir, filename)

	if err := os.WriteFile(path, decoded, 0600); err != nil {
		return "", err
	}
	return path, nil
}

func (m *Manager) KillRemoteServer(profileJSON string) error {
	var p ssh.TunnelProfile
	json.Unmarshal([]byte(profileJSON), &p)

	targetOS, _, err := m.DetectRemoteOS(profileJSON)
	if err != nil {
		fmt.Printf("KillRemoteServer warning: could not detect OS: %v. Defaulting to Linux.\n", err)
		targetOS = remotesystem.OSLinux
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

	pidFile := remoteSys.JoinPath(RemoteBaseDir, PidFile)
	if out, err := runRemote(remoteSys.ReadFile(pidFile)); err == nil {
		pidStr := strings.TrimSpace(out)
		if pidStr != "" {
			fmt.Printf("Killing PID: %s\n", pidStr)
			runRemote(remoteSys.KillProcess(pidStr))

			if _, err := runRemote(remoteSys.IsProcessRunning(pidStr)); err != nil {
				runRemote(remoteSys.Remove(pidFile))
				runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, TokenFile)))
				return nil
			}
		}
	}

	runRemote(remoteSys.FallbackKill(RemoteBinaryName))
	runRemote(remoteSys.Remove(pidFile))
	return nil
}

func (m *Manager) prepareSSHArgs(profileJSON string) (string, []string, error) {
	var p ssh.TunnelProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return "", nil, fmt.Errorf("invalid profile JSON: %w", err)
	}

	target := fmt.Sprintf("%s@%s", p.User, p.Host)
	sshBaseArgs := []string{"-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no"}
	if p.IdentityFile != "" {
		sshBaseArgs = append(sshBaseArgs, "-i", p.IdentityFile)
	}
	if len(p.ExtraArgs) > 0 {
		sshBaseArgs = append(sshBaseArgs, p.ExtraArgs...)
	}
	return target, sshBaseArgs, nil
}

func (m *Manager) verifyRemoteBinary(runRemote func(string) (string, error), remoteSys remotesystem.Remote, home, remoteBinDir, binName string, targetOS remotesystem.RemoteOS, targetArch remotesystem.RemoteArch) (bool, error) {
	// Read local binary to get hash
	assetOS := targetOS
	if strings.HasPrefix(string(targetOS), "windows") {
		assetOS = remotesystem.OSWindows
	}
	devServerContent, err := fs.ReadFile(m.payload, fmt.Sprintf("assets/payload/%s/%s/%s", assetOS, targetArch, binName))
	if err != nil {
		// If we can't read local binary, we can't verify, so we assume we need to deploy (or fail later)
		return false, nil
	}

	localSum := fmt.Sprintf("%x", md5.Sum(devServerContent))
	hashCmd, hashParser := remoteSys.FileHash(remoteSys.JoinPath(home, remoteBinDir, binName))

	out, err := runRemote(hashCmd)
	if err != nil {
		return false, nil
	}

	remoteSum := hashParser(out)
	if !strings.EqualFold(remoteSum, localSum) {
		fmt.Printf("Remote binary hash mismatch (Local: %s, Remote: %s). Forcing update.\n", localSum, remoteSum)
		return false, nil
	}

	return true, nil
}

func (m *Manager) cleanupRemoteState(runRemote func(string) (string, error), remoteSys remotesystem.Remote, binName string) {
	fmt.Println("Cleaning up potential zombie processes...")
	runRemote(remoteSys.FallbackKill(binName))
	runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, LogFileStartupErr)))
	runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, LogFileStderr)))
	runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, LogFileCurrent)))
}
