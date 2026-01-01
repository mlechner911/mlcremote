$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path "$scriptDir\.."
$manifest = "$repoRoot\icons\icons.yml"
$rawDir = "$repoRoot\icons\raw"
$outDir = "$repoRoot\frontend\src\generated"
$binDir = "$repoRoot\bin"
$bin = "$binDir\icon-gen.exe"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Force -Path $binDir | Out-Null
}

Write-Host "Building icon-gen binary..."
Push-Location "$repoRoot\cmd\icon-gen"
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -o $bin .
if ($LASTEXITCODE -ne 0) { Write-Error "icon-gen build failed"; exit 1 }
Pop-Location

Write-Host "Generating icons..."
& $bin --manifest $manifest --raw $rawDir --out $outDir --prefix icon
if ($LASTEXITCODE -ne 0) { Write-Error "Icon generation failed"; exit 1 }

Write-Host "Icons generated."
