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

func (w *Windows) ReadFile(path string) string {
	// Clean relative paths
	cleanPath := strings.TrimPrefix(path, ".\\")
	// Use absolute path with %USERPROFILE% to ensure we read what the script wrote
	return fmt.Sprintf("type \"%%USERPROFILE%%\\%s\"", cleanPath)
}

func (w *Windows) GetBinaryName(name string) string {
	return name + ".exe"
}

func (w *Windows) GetMD5UtilityName() string {
	return ""
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

func (w *Windows) Rename(src, dst string) string {
	// move /Y src dst
	// Wrap in cmd /c if needed, but usually direct command works via SSH if shell is cmd
	// We handle potential cross-drive moves by copy+del if move fails? No, simpler first.
	return fmt.Sprintf("move /Y \"%s\" \"%s\" 2>NUL || echo OK", src, dst)
}

func (w *Windows) FileHash(path string) (string, func(string) string) {
	// Use native PowerShell Get-FileHash to avoid AV false positives with unsigned binaries
	cmd := fmt.Sprintf("powershell -Command \"(Get-FileHash -Algorithm MD5 '%s').Hash\"", path)

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

func (w *Windows) GetStartupScript() (string, string) {
	script := `param(
    [string]$Bin,
    [string]$ArgsList,
    [string]$LogFile,
    [string]$PidFile
)

$ErrorActionPreference = "Stop"

try {
    # Resolve all paths to absolute using USERPROFILE
    $Bin = Join-Path $env:USERPROFILE ($Bin -replace '^\.\\', '')
    $LogFile = Join-Path $env:USERPROFILE ($LogFile -replace '^\.\\', '')
    $PidFile = Join-Path $env:USERPROFILE ($PidFile -replace '^\.\\', '')
    
    # Define quote char to avoid escaping hell and Go raw string conflicts
    $q = [char]34
    
    # Cmd: cmd /c ""Bin" Args > "Log" 2>&1"
    # We wrap the command for cmd /c in outer quotes, and inner paths in quotes.
    $CmdLine = "cmd /c $q$q$Bin$q $ArgsList > $q$LogFile$q 2>&1$q"

    Write-Output "DEBUG: Launching via WMI"
    Write-Output "DEBUG: Cmd=$CmdLine"

    # Pass CurrentDirectory ($env:USERPROFILE) as second argument to Create
    $Result = Invoke-WmiMethod -Class Win32_Process -Name Create -ArgumentList $CmdLine, $env:USERPROFILE
    
    if ($Result.ReturnValue -eq 0) {
        $Result.ProcessId | Out-File -Encoding ascii $PidFile
        Write-Output "DEBUG: Success PID=$($Result.ProcessId)"
    } else {
        throw "WMI Launch Failed: ReturnValue=$($Result.ReturnValue)"
    }
} catch {
    $ErrLog = Join-Path $env:USERPROFILE ".mlcremote\startup_err.log"
    "DEBUG VARIABLES:" | Out-File -Encoding ascii $ErrLog
    "Bin: '$Bin'" | Out-File -Encoding ascii -Append $ErrLog
    "LogFile: '$LogFile'" | Out-File -Encoding ascii -Append $ErrLog
    "LogErr: '$LogErr'" | Out-File -Encoding ascii -Append $ErrLog
    "Error:" | Out-File -Encoding ascii -Append $ErrLog
    $_ | Out-File -Encoding ascii -Append $ErrLog
    Write-Error $_
    exit 1
}`
	return "start_agent.ps1", script
}

func (w *Windows) StartProcess(bin, args, logFile, pidFile string) string {
	// Execute the uploaded PowerShell script.
	// We use -Command to allow dynamic path resolution of the script script.
	return fmt.Sprintf("powershell -ExecutionPolicy Bypass -Command \"$s = Join-Path $env:USERPROFILE '.mlcremote\\start_agent.ps1'; & $s -Bin '%s' -ArgsList '%s' -LogFile '%s' -PidFile '%s'\"", bin, args, logFile, pidFile)
}
