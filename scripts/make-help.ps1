$files = @("Makefile", "Makefile.win", "Makefile.unix")
Get-Content $files -ErrorAction SilentlyContinue | 
    Select-String "^## " | 
    ForEach-Object { 
        $line = $_.Line -replace "^## ", ""
        Write-Host $line 
    }
