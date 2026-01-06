$ErrorActionPreference = "Stop"

$BuildDist = "build/dist"

Write-Host "Packaging distribution into $BuildDist"

# Cleanup
if (Test-Path $BuildDist) {
    Remove-Item -Recurse -Force $BuildDist
}

# Create dirs
New-Item -ItemType Directory -Force -Path "$BuildDist/bin" | Out-Null
New-Item -ItemType Directory -Force -Path "$BuildDist/frontend" | Out-Null

# Copy Binaries
# Handle .exe extension if present
$DevServer = "bin/dev-server"
if (Test-Path "$DevServer.exe") { $DevServer = "$DevServer.exe" }

if (Test-Path $DevServer) {
    Copy-Item -Force $DevServer "$BuildDist/bin/"
} else {
    Write-Warning "dev-server binary not found at $DevServer"
}

$IconGen = "bin/icon-gen"
if (Test-Path "$IconGen.exe") { $IconGen = "$IconGen.exe" }
if (Test-Path $IconGen) {
    Copy-Item -Force $IconGen "$BuildDist/bin/"
}

# Copy Frontend
$FrontendDist = "frontend/dist"
if (Test-Path $FrontendDist) {
    Copy-Item -Recurse -Force "$FrontendDist/*" "$BuildDist/frontend/"
} else {
    Write-Error "No frontend dist found at $FrontendDist"
}

Write-Host "Packaged distribution to $BuildDist"
