$ErrorActionPreference = "Stop"

# Add NSIS to PATH (common locations)
$nsisPath = "C:\Program Files (x86)\NSIS"
if (Test-Path $nsisPath) {
    try {
        $fso = New-Object -ComObject Scripting.FileSystemObject
        $shortPath = $fso.GetFolder($nsisPath).ShortPath
        Write-Host "Adding NSIS to PATH (Short): $shortPath"
        $env:PATH = "$shortPath;$env:PATH"
    }
    catch {
        Write-Warning "Could not get short path: $_"
        Write-Host "Adding NSIS to PATH (Long): $nsisPath"
        $env:PATH = "$nsisPath;$env:PATH"
    }
}
else {
    Write-Warning "NSIS not found at $nsisPath. 'wails build -nsis' might fail if makensis is not in PATH."
}

# Verify makensis is found
try {
    $cmd = Get-Command "makensis" -ErrorAction Stop
    Write-Host "Found makensis at: $($cmd.Source)"
    & makensis /VERSION
}
catch {
    Write-Error "makensis NOT FOUND in PATH!"
}

# Set location to Wails project root (script is in scripts/, so go up two levels)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$wailsDir = Join-Path $scriptDir ".."
Set-Location $wailsDir

Write-Host "Building Wails app with NSIS installer..."
# Try to build with webkit2_41 tag first, fallback to others if needed
wails build -nsis -tags "desktop,production,webkit2_41" -v 2
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Build with webkit2_41 failed, trying webkit2..."
    wails build -nsis -tags "desktop,production,webkit2" -v 2
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Build with webkit2 failed, trying default..."
        wails build -nsis -tags "desktop,production" -v 2
    }
}
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
Write-Host "Build complete."
