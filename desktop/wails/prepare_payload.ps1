#
# Prepare Payload
# 

$ErrorActionPreference = "Stop"

$wailsDir = "c:\development\mlcremote\desktop\wails"
$backendDir = "c:\development\mlcremote\backend"
$frontendDir = "c:\development\mlcremote\frontend"
$rootDir = "c:\development\mlcremote"
$payloadDir = "$wailsDir\assets\payload"

# Ensure payload directory exists
if (!(Test-Path $payloadDir)) {
    New-Item -ItemType Directory -Force -Path $payloadDir
}

# 0. Generate Icons (Local)
Write-Host "Generating Icons..."
Set-Location "$rootDir\cmd\icon-gen"
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -o "icon-gen.exe" .
if ($LASTEXITCODE -ne 0) { Write-Error "Icon Gen build failed"; exit 1 }

# Run tool
./icon-gen.exe --manifest "$rootDir\icons\icons.yml" --raw "$rootDir\icons\raw" --out "$frontendDir\src\generated" --prefix icon
if ($LASTEXITCODE -ne 0) { Write-Error "Icon generation failed"; exit 1 }
Write-Host "Icons generated."

# 1. Build Linux Backend
Write-Host "Building Linux Backend..."
$env:GOOS = "linux"
$env:GOARCH = "amd64"
Set-Location $backendDir
go build -ldflags "-s -w" -o "$payloadDir\dev-server" ./cmd/dev-server
if ($LASTEXITCODE -ne 0) { Write-Error "Backend build failed"; exit 1 }
Write-Host "Backend built."

# 2. Build Frontend
Write-Host "Building IDE Frontend..."
Set-Location $frontendDir
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed"; exit 1 }

# Copy Frontend Dist
$frontendPayloadDir = "$payloadDir\frontend-dist"
if (Test-Path $frontendPayloadDir) { Remove-Item -Recurse -Force $frontendPayloadDir }
Copy-Item -Recurse "$frontendDir\dist" $frontendPayloadDir
Write-Host "Frontend copied."

# Reset Env
$env:GOOS = $null
$env:GOARCH = $null

Write-Host "Payload preparation complete."
