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

	"github.com/mlechner911/mlcremote/desktop/wails/internal/config"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/remotesystem"
	"github.com/mlechner911/mlcremote/desktop/wails/internal/ssh"
)

// DetectRemoteOS attempts to determine the remote operating system and architecture.
// It connects via SSH and runs probing commands (uname, ver) to identify the platform.
// Returns the detected OS and Architecture enums, or an error if detection fails.
// DetectRemoteOS attempts to determine the remote operating system and architecture.
// It connects via SSH and runs probing commands (uname, ver) to identify the platform.
// Returns the detected OS and Architecture enums, or an error if detection fails.
func (m *Manager) DetectRemoteOS(profileJSON string) (remotesystem.RemoteOS, remotesystem.RemoteArch, error) {
	// Parse profile to generate cache key
	var p config.ConnectionProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return remotesystem.OSUnknown, remotesystem.UnknownArch, fmt.Errorf("invalid profile: %w", err)
	}
	// Use User and Host for cache key.
	cacheKey := fmt.Sprintf("%s@%s", p.User, p.Host)

	m.cacheMu.RLock()
	if cached, ok := m.osCache[cacheKey]; ok {
		m.cacheMu.RUnlock()
		fmt.Printf("[DEBUG] DetectRemoteOS: Using cached OS for %s: %s %s\n", cacheKey, cached.OS, cached.Arch)
		return cached.OS, cached.Arch, nil
	}
	m.cacheMu.RUnlock()

	probeCmd := remotesystem.ProbeCommand

	output, err := m.runSSH(profileJSON, probeCmd)
	output = strings.TrimSpace(output)

	fmt.Printf("[DEBUG] DetectRemoteOS: 'uname' probe output: %q\n", output)

	if err != nil {
		if strings.Contains(err.Error(), "passphrase required") {
			return remotesystem.OSUnknown, remotesystem.UnknownArch, err
		}
		if strings.Contains(err.Error(), "decryption password incorrect") || strings.Contains(err.Error(), "password incorrect") {
			return remotesystem.OSUnknown, remotesystem.UnknownArch, err
		}
		if strings.Contains(output, "Permission denied") || strings.Contains(output, "publickey") {
			return remotesystem.OSUnknown, remotesystem.UnknownArch, fmt.Errorf("ssh: permission denied")
		}
		if strings.Contains(err.Error(), "exit status 255") {
			return remotesystem.OSUnknown, remotesystem.UnknownArch, fmt.Errorf("ssh-unreachable: %s", output)
		}
		// m.runSSH returns err if command fails.
		fmt.Printf("[DEBUG] DetectRemoteOS: 'uname' returned error: %v (continuing to fallback)\n", err)
	}

	if os, arch := remotesystem.ParseOS(output); os != remotesystem.OSUnknown {
		m.cacheMu.Lock()
		m.osCache[cacheKey] = cachedOS{OS: os, Arch: arch}
		m.cacheMu.Unlock()
		return os, arch, nil
	}

	fmt.Println("[DEBUG] DetectRemoteOS: Trying Windows fallback 'cmd /c ver'...")
	if validOut, err := m.runSSH(profileJSON, "cmd /c ver"); err == nil {
		fmt.Printf("[DEBUG] DetectRemoteOS: Fallback output: %q\n", validOut)
		os, arch := remotesystem.ParseOS(validOut)
		m.cacheMu.Lock()
		m.osCache[cacheKey] = cachedOS{OS: os, Arch: arch}
		m.cacheMu.Unlock()
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
	// Prepare closure for running commands via Native SSH
	runRemote := func(cmd string) (string, error) {
		return m.runSSH(profileJSON, cmd)
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
			fmt.Println("[DEBUG] Hash check: Binary needs update")
			forceNew = true
		} else {
			fmt.Println("[DEBUG] Hash check: Binary is up-to-date, skipping upload")
		}
	}

	// 1. Cleanup Stale / Zombie Processes (always run to prevent port conflicts)
	m.cleanupRemoteState(runRemote, remoteSys, binName)
	// Wait longer to ensure port is released by OS
	time.Sleep(2 * time.Second)

	// 2. Check Existing Session (only if not forcing new deployment)
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

	if err := m.uploadAssets(runRemote, profileJSON, remoteSys, tmpDir, remoteBinDir, remoteFrontendDir, binName, md5Name, targetOS, targetArch, token, forceNew); err != nil {
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

func (m *Manager) uploadAssets(runRemote func(string) (string, error), profileJSON string, remoteSys remotesystem.Remote, tmpDir, remoteBinDir, remoteFrontendDir, binName, md5Name string, targetOS remotesystem.RemoteOS, targetArch remotesystem.RemoteArch, token string, forceNew bool) error {
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

	// Only check hash if we are not forcing a new deployment
	if !forceNew {
		hashCmd, hashParser := remoteSys.FileHash(remoteSys.JoinPath(home, remoteBinDir, binName))
		if out, err := runRemote(hashCmd); err == nil {
			remoteSum := hashParser(out)

			fmt.Printf("[DEBUG] Binary verification: Local=%s, Remote=%s\n", localSum, remoteSum)

			if strings.EqualFold(remoteSum, localSum) {
				fmt.Println("Binary up to date, skipping upload.")
				skipBinary = true
			}
		}
	} else {
		fmt.Println("ForceNew is set, skipping hash check and enforcing upload.")
	}

	if !skipBinary {
		fmt.Println("Ensuring remote process is stopped before update...")
		runRemote(remoteSys.FallbackKill(binName))
		time.Sleep(1 * time.Second)

		// Backup existing binary (if it exists) before uploading new one
		runRemote(remoteSys.Rename(
			remoteSys.JoinPath(remoteBinDir, binName),
			remoteSys.JoinPath(remoteBinDir, binName+".old"),
		))

		// Upload Binary
		// Target path construction: We used scp user@host:~/%s/%s before.
		// uploadSSH takes remotePath.
		// remotePath should be absolute or relative to home?
		// uploadSSH calls RunCommand with `cat > remotePath`.
		// If remotePath is relative, it depends on working dir.
		// SSH execution usually starts in HOME.
		// So `remoteBinDir/binName` (which is `.mlcremote/bin/dev-server`) is correct if no leading slash.
		// `remoteSys.JoinPath` behavior?
		// `remoteBinDir` is usually `.mlcremote/bin`.
		// Let's ensure it's correct.
		// Note: uploadSSH executes `cat > "remotePath"`.
		// Using relative path is safe if CWD is HOME.
		destPath := remoteSys.JoinPath(remoteBinDir, binName)
		// On Windows, JoinPath uses backslashes?
		// if remote connection is Windows, 'cat > .mlcremote\bin\dev-server' might be tricky if not quoted or if key mapping issue.
		// But we quote it in UploadFile.
		if err := m.uploadSSH(profileJSON, filepath.Join(tmpDir, binName), destPath, "0755"); err != nil {
			return fmt.Errorf("upload binary failed: %w", err)
		}

		if md5Name != "" {
			if _, err := os.Stat(filepath.Join(tmpDir, md5Name)); err == nil {
				runRemote(remoteSys.Remove(remoteSys.JoinPath(remoteBinDir, md5Name)))
				destMd5 := remoteSys.JoinPath(remoteBinDir, md5Name)
				m.uploadSSH(profileJSON, filepath.Join(tmpDir, md5Name), destMd5, "0755")
				// chmod not needed - uploadSSH already sets mode to 0755
			}
		}
	}

	// Always ensure binary is executable (fix for interrupted deployments)
	runRemote(fmt.Sprintf("chmod +x ~/%s/%s", remoteBinDir, binName))

	// Upload startup script
	scriptName, scriptContent := remoteSys.GetStartupScript()
	if scriptName != "" {
		if scriptContent == "" {
			embedKey := path.Join("assets", "payload", scriptName)
			if content, err := fs.ReadFile(m.payload, embedKey); err == nil {
				scriptContent = string(content)
			} else {
				fmt.Printf("DEBUG: Failed to read %s.\n", embedKey)
				return fmt.Errorf("failed to read script asset %s: %w", scriptName, err)
			}
		}

		scriptTmp := filepath.Join(tmpDir, scriptName)
		if err := os.WriteFile(scriptTmp, []byte(scriptContent), 0644); err == nil {
			runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, scriptName)))
			destScript := remoteSys.JoinPath(RemoteBaseDir, scriptName)
			if err := m.uploadSSH(profileJSON, scriptTmp, destScript, "0755"); err != nil {
				return fmt.Errorf("upload script failed: %w", err)
			}
			// chmod not needed - uploadSSH already sets mode to 0755
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

		// Collect file list to upload since uploadSSH handles single file
		type fileToUpload struct {
			local  string
			remote string
		}
		var uploads []fileToUpload

		fs.WalkDir(m.payload, "assets/payload/frontend-dist", func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			rel, _ := filepath.Rel("assets/payload/frontend-dist", path)
			dest := filepath.Join(frontendTmp, rel)
			os.MkdirAll(filepath.Dir(dest), 0755)
			content, _ := fs.ReadFile(m.payload, path)
			os.WriteFile(dest, content, 0644)

			// Map to remote path
			// rel uses OS separator. remoteFrontendDir also.
			// we need consistent remote path.
			// rel always uses forward slash in embed? No, standard FS.
			// But target remote path should use remoteSys.JoinPath.
			remoteRel := rel // assumes same logic
			remoteDest := remoteSys.JoinPath(remoteFrontendDir, remoteRel)
			uploads = append(uploads, fileToUpload{local: dest, remote: remoteDest})

			return nil
		})

		runRemote(remoteSys.Remove(remoteSys.JoinPath(remoteFrontendDir, "*")))

		// Upload each file
		// This is slower than recursive SCP used before (-r).
		// But native implementation is file-by-file via cat.
		// If many files, this is slow.
		// Frontend dist usually has minimal files (index.html, couple js/css).
		// React builds might have more.
		// Optimized approach: zip locally, upload zip, unzip remotely.
		// But remote might not have unzip.
		// For now, iterate.
		for _, u := range uploads {
			// Create directory if nested?
			// uploadSSH doesn't mkdir -p. caller must.
			// but we did mkdir remoteFrontendDir.
			// if subdirs exist, we might fail.
			// React build has 'assets/' subdir.
			// We should ensure parent dirs exist.
			// remoteDir := filepath.Dir(u.remote)
			// If remote is Linux and local is Windows, filepath.Dir uses backslash.
			// We should use forward slash logic for remote if Linux.
			// But we have 'remoteSys'.
			// But remoteSys.JoinPath etc.
			// Let's try running mkdir -p for each file parent?
			// runRemote("mkdir -p " + path.Dir(u.remote)) -- assuming unix style for now or simple structure.
			// Frontend dist usually flat or simple.

			if err := m.uploadSSH(profileJSON, u.local, u.remote, "0644"); err != nil {
				fmt.Printf("Warning: failed to upload %s: %v\n", u.remote, err)
			}
		}
	}

	metaContent := fmt.Sprintf(`{"version": "%s", "updated": "%s", "os": "%s", "arch": "%s"}`, AgentVersion, time.Now().Format(time.RFC3339), targetOS, targetArch)
	metaPath := filepath.Join(tmpDir, InstallMetaFile)
	os.WriteFile(metaPath, []byte(metaContent), 0644)
	m.uploadSSH(profileJSON, metaPath, remoteSys.JoinPath(RemoteBaseDir, InstallMetaFile), "0644")

	if token != "" && !forceNew {
		tokenPath := filepath.Join(tmpDir, TokenFile)
		os.WriteFile(tokenPath, []byte(token), 0600)
		m.uploadSSH(profileJSON, tokenPath, remoteSys.JoinPath(RemoteBaseDir, TokenFile), "0600")
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
	// if forceNew {
	// 	logFile = fmt.Sprintf("session-%d.log", time.Now().Unix())
	// }

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
	var p config.ConnectionProfile
	if err := json.Unmarshal([]byte(profileJSON), &p); err != nil {
		return fmt.Errorf("invalid profile: %w", err)
	}

	targetOS, _, err := m.DetectRemoteOS(profileJSON)
	if err != nil {
		fmt.Printf("KillRemoteServer warning: could not detect OS: %v. Defaulting to Linux.\n", err)
		targetOS = remotesystem.OSLinux
	}

	remoteSys := getRemoteSystem(targetOS)

	runRemote := func(cmd string) (string, error) {
		return m.runSSH(profileJSON, cmd)
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

	fmt.Printf("[DEBUG] Binary verification: Local=%s, Remote=%s\n", localSum, remoteSum)

	if !strings.EqualFold(remoteSum, localSum) {
		fmt.Printf("Remote binary hash mismatch (Local: %s, Remote: %s). Forcing update.\n", localSum, remoteSum)
		return false, nil
	}
	return true, nil
}

func (m *Manager) cleanupRemoteState(runRemote func(string) (string, error), remoteSys remotesystem.Remote, binName string) {
	fmt.Println("Cleaning up potential zombie processes...")

	// Show what's using port 8443 before cleanup
	if out, err := runRemote("lsof -ti:8443 2>/dev/null || netstat -tlnp 2>/dev/null | grep :8443 || ss -tlnp 2>/dev/null | grep :8443"); err == nil && out != "" {
		fmt.Printf("[DEBUG] Processes using port 8443 before cleanup: %s\n", strings.TrimSpace(out))
	}

	runRemote(remoteSys.FallbackKill(binName))
	// Additional cleanup: kill any process listening on port 8443 (try multiple methods)
	runRemote("lsof -ti:8443 | xargs -r kill -9 2>/dev/null || true")
	runRemote("fuser -k 8443/tcp 2>/dev/null || true")

	// Verify cleanup
	if out, err := runRemote("lsof -ti:8443 2>/dev/null || netstat -tlnp 2>/dev/null | grep :8443 || ss -tlnp 2>/dev/null | grep :8443"); err == nil && out != "" {
		fmt.Printf("[DEBUG] WARNING: Port 8443 still in use after cleanup: %s\n", strings.TrimSpace(out))
	} else {
		fmt.Println("[DEBUG] Port 8443 successfully freed")
	}

	runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, LogFileStartupErr)))
	runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, LogFileStderr)))
	runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, LogFileCurrent)))
}
