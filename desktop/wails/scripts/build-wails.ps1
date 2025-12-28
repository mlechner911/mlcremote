Param()
Set-StrictMode -Version Latest
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $scriptDir\..
Write-Output "Building frontend..."
Push-Location frontend
npm ci
npm run build:desktop
Pop-Location
Write-Output "Building Wails app..."
wails build
Write-Output "Done"
Pop-Location
