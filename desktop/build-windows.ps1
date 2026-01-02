<#
.SYNOPSIS
  Build helper for Windows (PowerShell) to build the Wails desktop app.

.DESCRIPTION
  Installs frontend dependencies, builds the frontend (Vite), and runs
  `wails build` from the desktop project root. Intended to be run from
  PowerShell on Windows.

.PARAMETER NoFrontend
  If supplied, frontend install/build steps are skipped.

.PARAMETER WailsPath
  Optional full path to wails.exe. If not supplied the script looks for
  `wails` on PATH and in common Go bin locations.

.EXAMPLE
  .\build-windows.ps1

.EXAMPLE
  .\build-windows.ps1 -NoFrontend

.EXAMPLE
  .\build-windows.ps1 -WailsPath C:\Users\mlc\go\bin\wails.exe
#>

param(
  [switch]$NoFrontend,
  [string]$WailsPath = ""
)

Set-StrictMode -Version Latest
Write-Host "[build-windows.ps1] Starting..."

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path -Path $ScriptDir
# Frontend is at root/frontend, which is ../frontend relative to desktop/
$FrontendDir = Join-Path $ScriptDir '..\frontend'

function Find-Wails {
  param([string]$override)
  if ($override -and (Test-Path $override)) { return (Resolve-Path $override).Path }
  try { $cmd = Get-Command wails -ErrorAction Stop; return $cmd.Path } catch {}
  # Check common go bin locations
  $candidates = @(
    "$env:GOPATH\bin\wails.exe",
    "$env:GOPATH\bin\wails",
    "$env:USERPROFILE\go\bin\wails.exe",
    "$env:USERPROFILE\go\bin\wails"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return (Resolve-Path $c).Path }
  }
  return $null
}

$WailsExe = Find-Wails -override $WailsPath
if (-not $WailsExe) {
  Write-Error "wails CLI not found. Install with: go install github.com/wailsapp/wails/v2/cmd/wails@latest`nEnsure %USERPROFILE%\go\bin is on PATH or pass -WailsPath."
  exit 1
}

Write-Host "[build-windows.ps1] Using wails: $WailsExe"

if (-not $NoFrontend) {
  if (-not (Test-Path $FrontendDir)) {
    Write-Error "Frontend directory not found: $FrontendDir"
    exit 1
  }
  Push-Location $FrontendDir
  try {
    Write-Host "[build-windows.ps1] Running npm install in $FrontendDir"
    npm install
    Write-Host "[build-windows.ps1] Running npm run build"
    npm run build
  }
  catch {
    Write-Error "Frontend build failed: $_"
    Pop-Location
    exit 1
  }
  Pop-Location
}
else {
  Write-Host "[build-windows.ps1] Skipping frontend build (--NoFrontend supplied)"
}

# Run wails build from the desktop/wails directory (where wails.json lives)
$WailsProjectDir = Join-Path $ScriptDir 'wails'
Push-Location $WailsProjectDir
try {
  Write-Host "[build-windows.ps1] Running: $WailsExe build"
  # use -s to skip frontend build since we just did it (optional, but saves time if logic above is kept)
  & $WailsExe build -s -tags "desktop,production"
}
catch {
  Write-Error "wails build failed: $_"
  Pop-Location
  exit 1
}
Pop-Location

Write-Host "[build-windows.ps1] Build completed successfully."

# Package into ZIP
$BinFile = Join-Path $WailsProjectDir 'build\bin\MLCRemote.exe'
if (Test-Path $BinFile) {
  $DistDir = Join-Path $ScriptDir '..\dist'
  if (-not (Test-Path $DistDir)) { New-Item -ItemType Directory -Path $DistDir | Out-Null }
    
  $ZipPath = Join-Path $DistDir "MLCRemote-Windows.zip"
  Write-Host "[build-windows.ps1] Packaging $BinFile to $ZipPath..."
    
  Compress-Archive -Path $BinFile -DestinationPath $ZipPath -Force
  Write-Host "[build-windows.ps1] ZIP created at $ZipPath"
}
else {
  Write-Warning "Could not find MLCRemote.exe at $BinFile. Skipping zip."
}
