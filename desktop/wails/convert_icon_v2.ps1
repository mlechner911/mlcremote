
Add-Type -AssemblyName System.Drawing

$pngPath = "c:\development\mlcremote\desktop\wails\build\appicon.png"
$icoPath = "c:\development\mlcremote\desktop\wails\build\windows\icon.ico"

try {
    Write-Host "Reading PNG from $pngPath"
    $bitmap = [System.Drawing.Bitmap]::FromFile($pngPath)
    
    # Create a new icon from the bitmap handle
    $handle = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($handle)

    # Save the icon
    Write-Host "Saving ICO to $icoPath"
    $fileStream = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
    $icon.Save($fileStream)
    $fileStream.Flush()
    $fileStream.Close()
    
    $icon.Dispose()
    $bitmap.Dispose()
    
    Write-Host "Success!"
} catch {
    Write-Error "Failed to convert icon: $_"
    exit 1
}
