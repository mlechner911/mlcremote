
Add-Type -AssemblyName System.Drawing

$pngPath = "c:\development\mlcremote\desktop\wails\build\appicon.png"
$icoPath = "c:\development\mlcremote\desktop\wails\build\windows\icon.ico"

try {
    Write-Host "Reading PNG from $pngPath"
    $srcImage = [System.Drawing.Image]::FromFile($pngPath)
    
    # Resize to 256x256 (standard large icon size)
    $bitmap = New-Object System.Drawing.Bitmap(256, 256)
    $graph = [System.Drawing.Graphics]::FromImage($bitmap)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.DrawImage($srcImage, 0, 0, 256, 256)
    
    # Get HIcon
    $hIcon = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)

    # Save
    Write-Host "Saving ICO to $icoPath"
    $fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
    $icon.Save($fs)
    $fs.Close()
    
    # Cleanup
    [System.Drawing.Interop.PLib]::DestroyIcon($hIcon) | Out-Null
    $srcImage.Dispose()
    $bitmap.Dispose()
    $graph.Dispose()
    $icon.Dispose()
    
    Write-Host "Success!"
} catch {
    Write-Error "Conversion failed: $_"
    exit 1
}
