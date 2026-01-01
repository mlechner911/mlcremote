
Add-Type -AssemblyName System.Drawing

$pngPath = "c:\development\mlcremote\desktop\wails\build\appicon.png"
$icoPath = "c:\development\mlcremote\desktop\wails\build\windows\icon.ico"

$bitmap = [System.Drawing.Bitmap]::FromFile($pngPath)
# Create a new icon from the bitmap handle
$handle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($handle)

# Save the icon
$fileStream = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fileStream)

$fileStream.Close()
$bitmap.Dispose()
[System.Drawing.Interop.PLib]::DestroyIcon($handle)
Write-Host "Converted PNG to ICO: $icoPath"
