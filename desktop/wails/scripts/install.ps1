# MLCRemote Installer Script

$ErrorActionPreference = "Stop"

$appName = "MLCRemote"
$exeName = "MLCRemote.exe"
$installDir = "$env:LOCALAPPDATA\$appName"
$sourceExe = Join-Path $PSScriptRoot $exeName

# 1. Check source
if (-not (Test-Path $sourceExe)) {
    Write-Error "Installer Error: $exeName not found in current directory. Please extract the entire ZIP archive first."
    Read-Host "Press Enter to exit..."
    exit 1
}

# 2. Create Install Directory
Write-Host "Installing to $installDir..."
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# 3. Copy Executable
Copy-Item -Path $sourceExe -Destination "$installDir\$exeName" -Force
Write-Host "Executable installed."

# 4. Create Shortcuts
$wsh = New-Object -ComObject WScript.Shell

# Desktop Shortcut
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = "$desktopPath\$appName.lnk"
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$installDir\$exeName"
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = "MLCRemote Desktop"
$shortcut.Save()
Write-Host "Desktop shortcut created."

# Start Menu Shortcut
$programsPath = [System.Environment]::GetFolderPath('StartMenu')
$startMenuDir = "$programsPath\Programs\$appName"
if (-not (Test-Path $startMenuDir)) {
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
}
$smShortcutPath = "$startMenuDir\$appName.lnk"
$smShortcut = $wsh.CreateShortcut($smShortcutPath)
$smShortcut.TargetPath = "$installDir\$exeName"
$smShortcut.WorkingDirectory = $installDir
$smShortcut.Description = "MLCRemote Desktop"
$smShortcut.Save()
Write-Host "Start Menu shortcut created."

Write-Host ""
Write-Host "Installation Complete! You can now launch MLCRemote from your Desktop."
Write-Host ""
Read-Host "Press Enter to close..."
