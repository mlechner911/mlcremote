package backend

import (
	"fmt"
	"strings"
)

// note.. we have to do tzhis via ssh with our credentials, because thia is a remote process
//
// StopBackend kills the remote dev-server process using the stored PID
func (m *Manager) StopBackend(profileJSON string) (string, error) {
	// 1. Detect OS
	targetOS, _, err := m.DetectRemoteOS(profileJSON)
	if err != nil {
		return "", fmt.Errorf("failed to detect remote OS: %w", err)
	}

	// 2. Prepare SSH
	target, sshBaseArgs, err := m.prepareSSHArgs(profileJSON)
	if err != nil {
		return "", err
	}

	// 3. Get Remote System
	remoteSys := getRemoteSystem(targetOS)

	// Helper to run
	runRemote := func(cmd string) (string, error) {
		args := append([]string{}, sshBaseArgs...)
		args = append(args, target, cmd)
		out, err := createSilentCmd("ssh", args...).CombinedOutput()
		return strings.TrimSpace(string(out)), err
	}

	// 4. Read PID
	pidFile := remoteSys.JoinPath(RemoteBaseDir, PidFile)

	// Check if PID exists
	out, err := runRemote(remoteSys.ReadFile(pidFile))
	if err != nil || strings.TrimSpace(out) == "" {
		fmt.Println("StopBackend: PID file missing or empty, trying fallback kill...")
		runRemote(remoteSys.FallbackKill(RemoteBinaryName))
		runRemote(remoteSys.Remove(pidFile))
		return "stopped", nil
	}

	pidStr := strings.TrimSpace(out)

	// 5. Kill PID
	fmt.Printf("StopBackend: Killing PID %s\n", pidStr)
	runRemote(remoteSys.KillProcess(pidStr))

	// 6. Verify and Cleanup
	if _, err := runRemote(remoteSys.IsProcessRunning(pidStr)); err != nil {
		// Process is gone (err means not running)
		runRemote(remoteSys.Remove(pidFile))
		runRemote(remoteSys.Remove(remoteSys.JoinPath(RemoteBaseDir, TokenFile)))
		return "stopped", nil
	}

	// Process still running? Force kill or fallback
	fmt.Println("StopBackend: Process still running after kill, attempting fallback...")
	runRemote(remoteSys.FallbackKill(RemoteBinaryName))
	runRemote(remoteSys.Remove(pidFile))
	return "stopped (forced)", nil
}
