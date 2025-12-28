Param()
Set-StrictMode -Version Latest
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
# Ensure we run from desktop/wails
Push-Location $scriptDir\..
Write-Output "Working directory: $(Get-Location)"
Write-Output "Building frontend (appfrontend)..."
if (-Not (Test-Path .\appfrontend)) {
	Write-Error "appfrontend not found under $(Get-Location)"
	Pop-Location
	exit 1
}
Push-Location appfrontend
Write-Output "Frontend dir: $(Get-Location)"
npm ci
npm run build:desktop
Pop-Location
Write-Output "Building Wails app from: $(Get-Location)"
# show which wails.json would be used
if (Test-Path .\wails.json) { Write-Output "Using wails.json: $(Get-Location)\wails.json" } else { Write-Output "No wails.json at $(Get-Location)" }
wails build
Write-Output "Done"
Pop-Location
