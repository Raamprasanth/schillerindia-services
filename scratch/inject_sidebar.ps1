$files = Get-ChildItem -Path "frontend/public" -Filter "*.html"

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    
    # Check if we already injected
    if ($content -match 'scsr\.html') {
        continue
    }

    $replace1 = '    <a class="nav-item" href="cdr.html"><span class="ico">&#128274;</span> Closed DR</a>'
    $with1 = $replace1 + "`r`n" + '    <a class="nav-item" href="scsr.html"><span class="ico">&#128221;</span> SR</a>' + "`r`n" + '    <a class="nav-item" href="sccsr.html"><span class="ico">&#9989;</span> Closed SR</a>'
    
    $replace2 = '    <a class="nav-item active" href="cdr.html"><span class="ico">&#128274;</span> Closed DR</a>'
    $with2 = $replace2 + "`r`n" + '    <a class="nav-item" href="scsr.html"><span class="ico">&#128221;</span> SR</a>' + "`r`n" + '    <a class="nav-item" href="sccsr.html"><span class="ico">&#9989;</span> Closed SR</a>'

    $newContent = $content.Replace($replace1, $with1).Replace($replace2, $with2)
    
    if ($newContent -ne $content) {
        Set-Content -Path $f.FullName -Value $newContent -NoNewline
        Write-Host "Updated $($f.Name)"
    }
}
