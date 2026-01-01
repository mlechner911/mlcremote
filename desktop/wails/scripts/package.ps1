# Package distribution
$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$wailsDir = Split-Path $scriptDir -Parent

# 1. Build
Write-Host "Building MLCRemote..."
Set-Location $wailsDir
wails build
if ($LASTEXITCODE -ne 0) { exit 1 }

# 2. Prepare Dist Folder
$distDir = "$wailsDir\dist_package"
if (Test-Path $distDir) { Remove-Item -Recurse -Force $distDir }
New-Item -ItemType Directory -Path $distDir | Out-Null

# 3. Copy Artifacts
Copy-Item "$wailsDir\build\bin\MLCRemote.exe" $distDir
Copy-Item "$scriptDir\install.ps1" $distDir

# 4. Zip
$projectRootDistStr = "$wailsDir\..\..\dist"
$projectRootDist = [System.IO.Path]::GetFullPath($projectRootDistStr)

if (-not (Test-Path $projectRootDist)) {
    New-Item -ItemType Directory -Path $projectRootDist -Force | Out-Null
}

$zipPath = "$projectRootDist\MLCRemote-Installer.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path "$distDir\*" -DestinationPath $zipPath

Write-Host ""
Write-Host "Package created at: $zipPath"
