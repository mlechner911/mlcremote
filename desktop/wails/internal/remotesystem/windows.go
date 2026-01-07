package remotesystem

import (
	"fmt"
	"strings"
)

type Windows struct{}

func (w *Windows) GetOSName() string {
	return "windows"
}

func (w *Windows) GetHomeDir() string {
	return "."
}

func (w *Windows) JoinPath(elem ...string) string {
	// Use forward slashes for cross-compatibility in many cases, but backslashes are safer for native cmds
	// However, usually SSH on Windows (OpenSSH) handles forward slashes okay-ish, but let's stick to backslashes for path construction
	path := strings.Join(elem, "\\")
	return path
}

func (w *Windows) Mkdir(path string) string {
	// mkdir a\b\c
	// Powershell: New-Item -ItemType Directory -Force -Path ...
	// Command Prompt: mkdir ... (mkdir creates intermediates by default)
	// We use cmd /c compatible commands usually via SSH if default shell is cmd
	// But let's assume we can use powershell if we prefix it, or robust cmd.
	// cmd: mkdir path 2>NUL || echo OK
	return fmt.Sprintf("mkdir \"%s\" 2>NUL || echo OK", path)
}

func (w *Windows) Remove(path string) string {
	// rmdir /s /q path
	return fmt.Sprintf("rmdir /s /q \"%s\" 2>NUL || del /f /q \"%s\" 2>NUL || echo OK", path, path)
}

func (w *Windows) FileHash(path string) (string, func(string) string) {
	// Use custom md5-util or powershell fallback
	// .mlcremote\bin\md5-util.exe

	cmd := fmt.Sprintf(".mlcremote\\bin\\md5-util.exe \"%s\" || powershell -Command \"(Get-FileHash -Algorithm MD5 '%s').Hash\"", path, path)

	parser := func(output string) string {
		return strings.TrimSpace(output)
	}
	return cmd, parser
}

func (w *Windows) IsProcessRunning(pid string) string {
	// tasklist /FI "PID eq ..."
	return fmt.Sprintf("tasklist /FI \"PID eq %s\" | findstr %s", pid, pid)
}

func (w *Windows) KillProcess(pid string) string {
	return fmt.Sprintf("taskkill /PID %s /F /T", pid)
}

func (w *Windows) FallbackKill(name string) string {
	return fmt.Sprintf("taskkill /IM %s /F || echo OK", name)
}

func (w *Windows) StartProcess(bin, args, logFile, pidFile string) string {
	// powershell start-process etc
	// $p = Start-Process ... -PassThru; $p.Id | Out-File ...
	return fmt.Sprintf("powershell -Command \"$p = Start-Process -FilePath %s -ArgumentList '%s' -RedirectStandardOutput %s -RedirectStandardError %s -WindowStyle Hidden -PassThru; $p.Id | Out-File %s -Encoding ascii\"", bin, args, logFile, logFile, pidFile)
}
