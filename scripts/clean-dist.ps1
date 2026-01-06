if (Test-Path "build/dist") {
    Write-Host "Cleaning build/dist..."
    Remove-Item -Recurse -Force "build/dist"
}
